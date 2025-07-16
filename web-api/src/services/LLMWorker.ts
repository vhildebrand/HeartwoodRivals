import { Pool } from 'pg';
import { createClient } from 'redis';
import Queue from 'bull';
import OpenAI from 'openai';
import { AgentMemoryManager } from './AgentMemoryManager';

export class LLMWorker {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private conversationQueue: Queue.Queue;
  private openai: OpenAI;
  private memoryManager: AgentMemoryManager;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    });

    // Initialize memory manager
    this.memoryManager = new AgentMemoryManager(pool, redisClient);

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
      const prompt = await this.constructPrompt(constitution, npcName, playerMessage, npcId, characterId);

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

      // Store conversation as agent memory
      await this.storeConversationMemory(npcId, characterId, playerMessage, npcResponse);

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

  private async constructPrompt(constitution: string, npcName: string, playerMessage: string, npcId?: string, characterId?: string): Promise<string> {
    let contextualMemories = '';
    
    // For Sprint 5, include reflections and contextual memories
    if (npcId) {
      try {
        // Get reflections and contextual memories
        const contextualMemories_general = await this.memoryManager.getContextualMemories(npcId, playerMessage, 10);
        
        // Get conversation-specific memories for better player detail recall
        const conversationMemories = characterId ? 
          await this.memoryManager.getConversationMemories(npcId, characterId, 8) : 
          [];
        
        // Combine all memories
        const allMemories = [...contextualMemories_general, ...conversationMemories];
        
        if (allMemories.length > 0) {
          // Separate reflections from observations
          const reflections = allMemories.filter(m => m.memory_type === 'reflection');
          const observations = allMemories.filter(m => m.memory_type === 'observation');
          
          let memoryContext = '';
          
          if (reflections.length > 0) {
            memoryContext += '\n=== YOUR REFLECTIONS AND INSIGHTS ===\n';
            memoryContext += reflections.map(r => `- ${r.content}`).join('\n');
          }
          
          if (observations.length > 0) {
            memoryContext += '\n=== YOUR RECENT EXPERIENCES AND CONVERSATIONS ===\n';
            // Deduplicate and show most important conversation memories first
            const uniqueObservations = observations.filter((obs, index, self) => 
              index === self.findIndex(o => o.id === obs.id)
            );
            const sortedObservations = uniqueObservations.sort((a, b) => b.importance_score - a.importance_score);
            memoryContext += sortedObservations.slice(0, 8).map(o => `- ${o.content}`).join('\n');
          }
          
          memoryContext += '\n=== END OF MEMORIES ===\n';
          
          contextualMemories = memoryContext;
        }
      } catch (error) {
        console.error(`Error retrieving memories for ${npcName}:`, error);
      }
    }

    const prompt = `${constitution}

IMPORTANT INSTRUCTIONS:
- You are ${npcName}
- Stay in character at all times
- Respond only as ${npcName} would respond
- Keep responses under 2-3 sentences
- Use natural dialogue that fits your personality
- Do not break character or mention that you are an AI
- You have access to your memories and past conversations with this player
- Use the information from your experiences below to inform your response
- When the player references past conversations, you should remember and respond accordingly

IMPORTANT: Here are your recent memories and experiences - use this information to respond:
${contextualMemories}

The player approaches you and says: "${playerMessage}"

Based on your memories above, how do you respond?`;

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

  private async storeConversationMemory(npcId: string, characterId: string, playerMessage: string, npcResponse: string) {
    try {
      // Get player name from character ID or use fallback
      const playerName = await this.getPlayerName(characterId);
      
      // Store memory of the player's message (raw dialogue)
      await this.memoryManager.storeObservation(
        npcId,
        `${playerName} said to me: "${playerMessage}"`,
        'conversation', // location
        [], // related_agents
        [characterId], // related_players
        8 // importance - conversations are important
      );
      
      // Extract and store key facts from the player's message
      const extractedFacts = await this.extractKeyFacts(playerMessage, playerName);
      if (extractedFacts) {
        await this.memoryManager.storeObservation(
          npcId,
          extractedFacts,
          'conversation', // location
          [], // related_agents
          [characterId], // related_players
          9 // importance - key facts are more important than raw dialogue
        );
      }
      
      // Store memory of the agent's response
      await this.memoryManager.storeObservation(
        npcId,
        `I responded to ${playerName}: "${npcResponse}"`,
        'conversation', // location
        [], // related_agents
        [characterId], // related_players
        7 // importance - slightly less important than player's message
      );
      
      console.log(`💭 Stored conversation memory for agent ${npcId} with player ${playerName}`);
      
    } catch (error) {
      console.error('Error storing conversation memory:', error);
      // Don't throw here - memory storage failure shouldn't break the conversation
    }
  }

  private async extractKeyFacts(playerMessage: string, playerName: string): Promise<string | null> {
    try {
      // Simple pattern matching for common fact patterns
      const patterns = [
        // Name introduction: "Hello, I'm John" or "My name is John"
        /(?:hello|hi|hey).*?(?:i'm|i am|my name is|call me)\s+(\w+)/i,
        // Hobby/interest: "I love/like/enjoy X"
        /i\s+(?:love|like|enjoy|am into)\s+([^.!?]+)/i,
        // Food preference: "my favorite food is X"
        /my\s+favorite\s+food\s+is\s+([^.!?]+)/i,
        // Profession: "I'm a X" or "I work as X"
        /i(?:'m|am)\s+a\s+([^.!?]+)/i,
        // General facts: "I have X" or "I own X"
        /i\s+(?:have|own)\s+([^.!?]+)/i
      ];

      const facts = [];
      
      for (const pattern of patterns) {
        const match = playerMessage.match(pattern);
        if (match) {
          const fact = match[1]?.trim();
          if (fact) {
            if (pattern.source.includes('name')) {
              facts.push(`${fact} told me their name is ${fact}`);
            } else if (pattern.source.includes('love|like|enjoy')) {
              facts.push(`${playerName} told me they love ${fact}`);
            } else if (pattern.source.includes('favorite food')) {
              facts.push(`${playerName} told me their favorite food is ${fact}`);
            } else if (pattern.source.includes('profession')) {
              facts.push(`${playerName} told me they are a ${fact}`);
            } else if (pattern.source.includes('have|own')) {
              facts.push(`${playerName} told me they have ${fact}`);
            }
          }
        }
      }
      
      return facts.length > 0 ? facts.join('. ') : null;
      
    } catch (error) {
      console.error('Error extracting key facts:', error);
      return null;
    }
  }

  private async getPlayerName(characterId: string): Promise<string> {
    try {
      // Check cache first
      const cacheKey = `player_name:${characterId}`;
      const cached = await this.redisClient.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      // For now, use a simple fallback since we don't have a proper user system yet
      // In the future, this would look up the username from the characters/users table
      const playerName = `Player_${characterId}`;
      
      // Cache for 1 hour
      await this.redisClient.setEx(cacheKey, 3600, playerName);
      
      return playerName;
    } catch (error) {
      console.error('Error getting player name:', error);
      return `Player_${characterId.substring(0, 8)}`;
    }
  }
} 