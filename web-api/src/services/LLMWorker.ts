import { Pool } from 'pg';
import { createClient } from 'redis';
import Queue from 'bull';
import OpenAI from 'openai';
import { AgentMemoryManager } from './AgentMemoryManager';
import { ReputationManager } from './ReputationManager';
import { ThoughtSystemIntegration } from './ThoughtSystemIntegration';

export class LLMWorker {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private conversationQueue: Queue.Queue;
  private openai: OpenAI;
  private memoryManager: AgentMemoryManager;
  private reputationManager: ReputationManager;
  private thoughtSystemIntegration: ThoughtSystemIntegration;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    });

    // Initialize memory manager
    this.memoryManager = new AgentMemoryManager(pool, redisClient);

    // Initialize reputation manager
    this.reputationManager = new ReputationManager(pool, redisClient);
    
    // Initialize thought system integration
    this.thoughtSystemIntegration = new ThoughtSystemIntegration(pool, redisClient, this.memoryManager);

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
      // LIGHTWEIGHT MEMORY RECALL: Quick memory recall for conversation context
      console.log(`🧠 [LLM] Triggering memory recall for ${npcName}`);
      const memoryRecall = await this.triggerConversationMemoryRecall(npcId, playerMessage, characterId);
      
      // Construct the prompt for the LLM (including memory recall results)
      const prompt = await this.constructPrompt(constitution, npcName, playerMessage, npcId, characterId, memoryRecall);

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
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

      // *** POST-RESPONSE ANALYSIS: Check for gossip ***
      await this.analyzeConversationForGossip(npcId, characterId, playerMessage, npcResponse);

      // Return the response (conversation complete thoughts will be triggered separately)
      return {
        response: npcResponse,
        memoryRecall: memoryRecall
      };

    } catch (error) {
      console.error('Error in conversation processing:', error);
      throw error;
    }
  }

  /**
   * Trigger lightweight memory recall for conversation context
   */
  private async triggerConversationMemoryRecall(npcId: string, playerMessage: string, characterId: string): Promise<any> {
    try {
      const response = await fetch('http://localhost:3000/thought/conversation-recall', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: npcId,
          playerMessage,
          characterId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as any;
      return result.memoryRecall;
    } catch (error) {
      console.error('Error in conversation memory recall:', error);
      return {
        relevantMemories: 'Error recalling memories',
        reasoning: 'Memory recall failed',
        confidence: 1
      };
    }
  }

  /**
   * Trigger post-conversation scheduling thoughts
   */
  public async triggerPostConversationThoughts(npcId: string, conversationSummary: string, duration: number, importance: number = 5): Promise<void> {
    try {
      console.log(`📅 [LLM] Triggering post-conversation thoughts for ${npcId}`);
      
      const response = await fetch('http://localhost:3000/thought/conversation-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: npcId,
          conversationSummary,
          duration,
          importance
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as any;
      console.log(`✅ [LLM] Post-conversation thoughts completed for ${npcId}:`, result.thoughtResult?.decision);
    } catch (error) {
      console.error('Error in post-conversation thoughts:', error);
    }
  }

  private async constructPrompt(constitution: string, npcName: string, playerMessage: string, npcId?: string, characterId?: string, memoryRecall?: any): Promise<string> {
    let contextualMemories = '';
    let reputationContext = '';
    let memoryRecallContext = '';
    
    // Add memory recall results if available
    if (memoryRecall) {
      memoryRecallContext = `\n=== CONVERSATION-RELEVANT MEMORIES ===\n${memoryRecall.relevantMemories}\n=== END OF RELEVANT MEMORIES ===\n`;
    }
    
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

    // Get player reputation information
    if (characterId) {
      try {
        const playerReputation = await this.reputationManager.getPlayerReputation(characterId);
        if (playerReputation) {
          const reputationScore = playerReputation.reputation_score;
          let reputationDescription = '';
          
          if (reputationScore >= 75) {
            reputationDescription = 'This player has an excellent reputation in the community. They are known for their kindness and helpful nature.';
          } else if (reputationScore >= 60) {
            reputationDescription = 'This player has a good reputation. They are generally well-regarded by others.';
          } else if (reputationScore >= 40) {
            reputationDescription = 'This player has a neutral reputation. They are neither particularly well-known nor problematic.';
          } else if (reputationScore >= 25) {
            reputationDescription = 'This player has a somewhat poor reputation. Some community members have concerns about their behavior.';
          } else {
            reputationDescription = 'This player has a poor reputation in the community. They are known for problematic behavior.';
          }
          
          reputationContext = `\n=== PLAYER REPUTATION ===\n${reputationDescription} (Community standing: ${reputationScore}/100)\n=== END OF REPUTATION ===\n`;
        }
      } catch (error) {
        console.error(`Error retrieving reputation for player ${characterId}:`, error);
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
- Adjust your greeting and tone based on the player's reputation in the community

IMPORTANT: Here are your recent memories and experiences - use this information to respond:
${memoryRecallContext}
${contextualMemories}

${reputationContext}

The player approaches you and says: "${playerMessage}"

Based on your memories and knowledge of this player's reputation, how do you respond?`;

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

  /**
   * Analyze player's message for gossip and process accordingly
   * This implements the post-response analysis step from Sprint 3
   */
  private async analyzeConversationForGossip(
    npcId: string, 
    characterId: string, 
    playerMessage: string, 
    npcResponse: string
  ): Promise<void> {
    try {
      // Analyze the player's message for gossip
      const gossipAnalysis = await this.detectGossipInMessage(playerMessage, characterId, npcId);
      
      if (gossipAnalysis.detected && gossipAnalysis.subject_character_id) {
        console.log(`🗣️ [GOSSIP] Detected gossip from ${characterId} about ${gossipAnalysis.subject_character_id} to ${npcId}`);
        console.log(`🗣️ [GOSSIP] Sentiment: ${gossipAnalysis.sentiment}, Confidence: ${gossipAnalysis.confidence}`);
        
        // Get NPC's trust level with the gossiping player for credibility calculation
        const trustLevel = await this.getTrustLevel(npcId, characterId);
        const credibilityScore = this.calculateCredibilityScore(gossipAnalysis.confidence, trustLevel);
        
        // Log the gossip to database
        const gossipId = await this.reputationManager.logGossip({
          source_character_id: characterId,
          target_character_id: gossipAnalysis.subject_character_id,
          npc_listener_id: npcId,
          content: playerMessage,
          is_positive: gossipAnalysis.sentiment === 'positive',
          credibility_score: credibilityScore
        });
        
        // Store gossip as high-importance memory for the NPC
        await this.storeGossipMemory(npcId, characterId, gossipAnalysis, credibilityScore);
        
        // Update target's reputation based on gossip
        await this.processGossipReputationImpact(gossipAnalysis, credibilityScore);
        
        console.log(`✅ [GOSSIP] Processed gossip entry ${gossipId} with credibility ${credibilityScore}`);
      }
    } catch (error) {
      console.error('Error analyzing conversation for gossip:', error);
      // Don't throw - gossip analysis failure shouldn't break conversations
    }
  }

  /**
   * Detect gossip in player's message using LLM analysis
   */
  private async detectGossipInMessage(
    playerMessage: string, 
    speakerId: string, 
    listenerId: string
  ): Promise<{
    detected: boolean;
    subject_character_id: string | null;
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }> {
    try {
      const prompt = `You are analyzing a conversation to detect if a player is talking about another character (gossip).

PLAYER MESSAGE: "${playerMessage}"

Your task is to determine:
1. Is the player talking ABOUT another specific character/person?
2. If yes, what is the sentiment of what they're saying about that person?
3. How confident are you that this is gossip about a specific person?

Rules:
- Only consider it gossip if the player is talking ABOUT a specific person/character
- Direct conversations TO someone are not gossip
- General statements about groups are not gossip
- Must be about a specific individual

Common gossip patterns to look for:
- "X is really nice/mean/rude/kind"
- "I saw X doing Y"
- "X told me Z"
- "X is good/bad at something"
- "X has been acting strange"
- "X and Y are dating/fighting"

Respond with JSON format:
{
  "detected": true/false,
  "subject_name": "name of person being talked about" or null,
  "sentiment": "positive"/"negative"/"neutral",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}

Examples:
- "Bob is really helpful" → detected: true, subject_name: "Bob", sentiment: "positive"
- "I think Alice has been rude lately" → detected: true, subject_name: "Alice", sentiment: "negative"
- "Hello there!" → detected: false
- "How are you?" → detected: false
- "The weather is nice" → detected: false`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON response
      let cleanedResponse = response;
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      const analysis = JSON.parse(cleanedResponse.trim());
      
      // Map subject name to character ID (for now, use simple mapping)
      const subjectCharacterId = analysis.subject_name ? 
        this.mapCharacterNameToId(analysis.subject_name) : null;
      
      return {
        detected: analysis.detected || false,
        subject_character_id: subjectCharacterId,
        sentiment: analysis.sentiment || 'neutral',
        confidence: Math.max(0, Math.min(100, analysis.confidence || 0))
      };
      
    } catch (error) {
      console.error('Error detecting gossip in message:', error);
      return {
        detected: false,
        subject_character_id: null,
        sentiment: 'neutral',
        confidence: 0
      };
    }
  }

  /**
   * Get trust level between NPC and player for credibility calculation
   */
  private async getTrustLevel(npcId: string, characterId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        'SELECT trust_level FROM agent_player_relationships WHERE agent_id = $1 AND character_id = $2',
        [npcId, characterId]
      );
      
      return result.rows[0]?.trust_level || 50; // Default to neutral trust
    } catch (error) {
      console.error('Error getting trust level:', error);
      return 50; // Default to neutral trust
    }
  }

  /**
   * Calculate credibility score based on confidence and trust level
   */
  private calculateCredibilityScore(confidence: number, trustLevel: number): number {
    // Credibility = (confidence * trust_factor)
    // Trust factor ranges from 0.5 (low trust) to 1.5 (high trust)
    const trustFactor = 0.5 + (trustLevel / 100);
    const credibilityScore = Math.round(confidence * trustFactor);
    
    return Math.max(0, Math.min(100, credibilityScore));
  }

  /**
   * Store gossip as high-importance memory for the NPC
   */
  private async storeGossipMemory(
    npcId: string, 
    speakerId: string, 
    gossipAnalysis: any, 
    credibilityScore: number
  ): Promise<void> {
    try {
      const speakerName = await this.getPlayerName(speakerId);
      const subjectName = gossipAnalysis.subject_name || 'someone';
      
      const sentimentText = gossipAnalysis.sentiment === 'positive' ? 'positive things' : 
                           gossipAnalysis.sentiment === 'negative' ? 'negative things' : 'neutral things';
      
      const memoryContent = `${speakerName} told me ${sentimentText} about ${subjectName}. I found this ${credibilityScore >= 70 ? 'quite believable' : credibilityScore >= 40 ? 'somewhat believable' : 'not very believable'}.`;
      
      await this.memoryManager.storeObservationWithTags(
        npcId,
        memoryContent,
        'conversation',
        [], // related_agents
        [speakerId], // related_players
        9, // high importance for gossip
        ['gossip', 'conversation', gossipAnalysis.sentiment === 'positive' ? 'positive_gossip' : 'negative_gossip']
      );
      
      console.log(`💭 [GOSSIP] Stored gossip memory for ${npcId}: "${memoryContent}"`);
    } catch (error) {
      console.error('Error storing gossip memory:', error);
    }
  }

  /**
   * Process reputation impact from gossip
   */
  private async processGossipReputationImpact(
    gossipAnalysis: any, 
    credibilityScore: number
  ): Promise<void> {
    try {
      // Calculate reputation change based on sentiment and credibility
      const baseImpact = gossipAnalysis.sentiment === 'positive' ? 1 : 
                        gossipAnalysis.sentiment === 'negative' ? -1 : 0;
      
      // Scale impact by credibility (0-100) -> (0-1)
      const credibilityMultiplier = credibilityScore / 100;
      const reputationChange = Math.round(baseImpact * credibilityMultiplier * 2); // Max +/-2 points
      
      if (reputationChange !== 0 && gossipAnalysis.subject_character_id) {
        await this.reputationManager.updatePlayerReputation({
          character_id: gossipAnalysis.subject_character_id,
          score_change: reputationChange,
          reason: `Gossip impact (${gossipAnalysis.sentiment}, credibility: ${credibilityScore})`,
          source: 'gossip_analysis'
        });
        
        console.log(`📊 [GOSSIP] Updated reputation for ${gossipAnalysis.subject_character_id} by ${reputationChange} points`);
      }
    } catch (error) {
      console.error('Error processing gossip reputation impact:', error);
    }
  }

  /**
   * Map character name to character ID (simplified for now)
   */
  private mapCharacterNameToId(characterName: string): string | null {
    // For now, return a generated ID based on the name
    // In a real system, this would look up the actual character ID
    return `player_${characterName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }


} 