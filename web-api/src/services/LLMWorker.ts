import { Pool } from 'pg';
import { createClient } from 'redis';
import Queue from 'bull';
import OpenAI from 'openai';

export class LLMWorker {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private conversationQueue: Queue.Queue;
  private openai: OpenAI;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    });

    // Initialize conversation queue
    this.conversationQueue = new Queue('conversation', {
      redis: {
        host: 'redis',
        port: 6379,
      },
    });
  }

  async start() {
    // Process conversation jobs
    this.conversationQueue.process('processConversation', async (job: Queue.Job) => {
      return await this.processConversationJob(job.data);
    });

    console.log('LLMWorker: Started processing conversation jobs');
  }

  private async processConversationJob(jobData: any) {
    const { npcId, npcName, constitution, characterId, playerMessage, timestamp } = jobData;

    try {
      // Construct the prompt for the LLM
      const prompt = await this.constructPrompt(constitution, npcName, playerMessage);

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using the faster, cheaper model for Sprint 3
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: playerMessage
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      const npcResponse = completion.choices[0]?.message?.content?.trim();

      if (!npcResponse) {
        throw new Error('Empty response from OpenAI');
      }

      // Log the conversation to database
      await this.logConversation(characterId, npcId, playerMessage, npcResponse);

      // Return the response
      return {
        npcId,
        npcName,
        response: npcResponse,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Error processing conversation job:', error);
      throw error;
    }
  }

  private async constructPrompt(constitution: string, npcName: string, playerMessage: string): Promise<string> {
    // For Sprint 3, we only use base constitution (no memory or relationships)
    const prompt = `${constitution}

IMPORTANT INSTRUCTIONS:
- You are ${npcName}
- Stay in character at all times
- Respond only as ${npcName} would respond
- Keep responses under 2-3 sentences
- Use natural dialogue that fits your personality
- Do not break character or mention that you are an AI

The player approaches you and says: "${playerMessage}"

How do you respond?`;

    return prompt;
  }

  private async logConversation(characterId: string, npcId: string, playerMessage: string, npcResponse: string) {
    try {
      await this.pool.query(
        'INSERT INTO conversation_logs (initiator_type, initiator_id, recipient_type, recipient_id, message, response) VALUES ($1, $2, $3, $4, $5, $6)',
        ['player', characterId, 'agent', npcId, playerMessage, npcResponse]
      );
    } catch (error) {
      console.error('Error logging conversation:', error);
      // Don't throw here - logging failure shouldn't break the conversation
    }
  }
} 