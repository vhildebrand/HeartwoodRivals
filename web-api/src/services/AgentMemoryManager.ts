import { Pool, PoolClient } from 'pg';
import { createClient } from 'redis';
import OpenAI from 'openai';

interface Memory {
  id?: number;
  agent_id: string;
  memory_type: 'observation' | 'reflection' | 'plan' | 'metacognition';
  content: string;
  importance_score: number;
  emotional_relevance: number;
  tags: string[];
  related_agents: string[];
  related_players: string[];
  location: string;
  timestamp?: Date;
  embedding?: number[];
}

interface MemoryRetrievalOptions {
  agent_id: string;
  query_embedding?: number[];
  memory_types?: string[];
  limit?: number;
  min_importance?: number;
  recent_hours?: number;
  include_similarity?: boolean;
}

export class AgentMemoryManager {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private openai: OpenAI;
  private readonly EMBEDDING_DIMENSION = 1536;
  private readonly MEMORY_CACHE_TTL = 3600; // 1 hour

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    
    // Initialize OpenAI for embeddings
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Store a new memory for an agent with filtering
   */
  async storeMemory(memory: Memory): Promise<number> {
    // Apply importance-based filtering
    if (!this.shouldStoreMemory(memory.importance_score)) {
      console.log(`⏭️  Skipping low-importance memory (${memory.importance_score}) for ${memory.agent_id}`);
      return -1; // Return -1 to indicate memory was filtered out
    }

    // Check temporal filtering
    if (!(await this.shouldCreateMemoryTemporally(memory.agent_id, memory.content, memory.memory_type))) {
      console.log(`⏭️  Skipping temporally similar memory for ${memory.agent_id}`);
      return -1;
    }

    // Generate embedding for semantic similarity check
    const embedding = await this.generateEmbedding(memory.content);
    
    // Check semantic similarity filtering
    if (await this.isMemoryTooSimilar(memory.agent_id, memory.content, embedding)) {
      console.log(`⏭️  Skipping semantically similar memory for ${memory.agent_id}`);
      return -1;
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert the memory into the database
      const result = await client.query(
        `INSERT INTO agent_memories (
          agent_id, memory_type, content, importance_score, emotional_relevance,
          tags, related_agents, related_players, location, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          memory.agent_id,
          memory.memory_type,
          memory.content,
          memory.importance_score,
          memory.emotional_relevance,
          memory.tags,
          memory.related_agents,
          memory.related_players,
          memory.location,
          `[${embedding.join(',')}]` // Convert to PostgreSQL array format
        ]
      );
      
      await client.query('COMMIT');
      
      const memoryId = result.rows[0].id;
      
      // Cache the memory for quick access
      await this.cacheMemory(memoryId, memory);
      
      // Trigger reflection if needed
      await this.checkReflectionTrigger(memory.agent_id);
      
      console.log(`✅ Stored memory ${memoryId} for ${memory.agent_id}: "${memory.content.substring(0, 50)}..."`);
      
      return memoryId;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve memories for an agent with semantic similarity search
   */
  async retrieveMemories(options: MemoryRetrievalOptions): Promise<Memory[]> {
    const {
      agent_id,
      query_embedding,
      memory_types,
      limit = 10,
      min_importance = 0,
      recent_hours,
      include_similarity = false
    } = options;

    // Check cache first
    const cacheKey = `agent_memories:${agent_id}:${JSON.stringify(options)}`;
    const cachedResult = await this.redisClient.get(cacheKey);
    
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    let query = `
      SELECT 
        id, agent_id, memory_type, content, importance_score, 
        emotional_relevance, tags, related_agents, related_players, 
        location, timestamp
        ${query_embedding && include_similarity ? 
          `, (embedding <-> '[${query_embedding.join(',')}]') as similarity` : ''}
      FROM agent_memories 
      WHERE agent_id = $1
    `;

    const params: any[] = [agent_id];
    let paramIndex = 2;

    // Add filters
    if (memory_types && memory_types.length > 0) {
      query += ` AND memory_type = ANY($${paramIndex})`;
      params.push(memory_types);
      paramIndex++;
    }

    if (min_importance > 0) {
      query += ` AND importance_score >= $${paramIndex}`;
      params.push(min_importance);
      paramIndex++;
    }

    if (recent_hours) {
      query += ` AND timestamp >= NOW() - INTERVAL '${recent_hours} hours'`;
    }

    // Order by relevance or recency
    if (query_embedding) {
      query += ` ORDER BY embedding <-> '[${query_embedding.join(',')}]'`;
    } else {
      query += ` ORDER BY timestamp DESC`;
    }

    query += ` LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    
    const memories: Memory[] = result.rows.map(row => ({
      id: row.id,
      agent_id: row.agent_id,
      memory_type: row.memory_type,
      content: row.content,
      importance_score: row.importance_score,
      emotional_relevance: row.emotional_relevance,
      tags: row.tags,
      related_agents: row.related_agents,
      related_players: row.related_players,
      location: row.location,
      timestamp: row.timestamp,
      ...(row.similarity && { similarity: row.similarity })
    }));

    // Cache the result
    await this.redisClient.setEx(cacheKey, this.MEMORY_CACHE_TTL, JSON.stringify(memories));

    return memories;
  }

  /**
   * Generate contextual memories for agent decision making
   */
  async getContextualMemories(agent_id: string, context: string, limit: number = 15): Promise<Memory[]> {
    // Generate embedding for the context
    const contextEmbedding = await this.generateEmbedding(context);
    
    // Get a mix of recent, important, and relevant memories
    const recentMemories = await this.retrieveMemories({
      agent_id,
      limit: Math.floor(limit / 3),
      recent_hours: 24
    });

    const importantMemories = await this.retrieveMemories({
      agent_id,
      limit: Math.floor(limit / 3),
      min_importance: 7
    });

    const relevantMemories = await this.retrieveMemories({
      agent_id,
      query_embedding: contextEmbedding,
      limit: Math.floor(limit / 3),
      include_similarity: true
    });

    // Combine and deduplicate
    const allMemories = [...recentMemories, ...importantMemories, ...relevantMemories];
    const uniqueMemories = allMemories.filter((memory, index, self) => 
      index === self.findIndex(m => m.id === memory.id)
    );

    // Sort by composite score (recency + importance + relevance)
    return uniqueMemories
      .sort((a, b) => {
        const scoreA = this.calculateMemoryScore(a, context);
        const scoreB = this.calculateMemoryScore(b, context);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Store an observation from game events
   */
  async storeObservation(
    agent_id: string,
    observation: string,
    location: string,
    related_agents: string[] = [],
    related_players: string[] = [],
    importance: number = 5
  ): Promise<number> {
    const tags = this.extractTags(observation);
    
    const memory: Memory = {
      agent_id,
      memory_type: 'observation',
      content: observation,
      importance_score: importance,
      emotional_relevance: this.calculateEmotionalRelevance(observation),
      tags,
      related_agents,
      related_players,
      location
    };

    const result = await this.storeMemory(memory);
    
    // Log if memory was filtered out
    if (result === -1) {
      console.log(`🚫 Filtered observation for ${agent_id}: "${observation.substring(0, 50)}..."`);
    }
    
    return result;
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return zero vector as fallback
      return new Array(this.EMBEDDING_DIMENSION).fill(0);
    }
  }

  /**
   * Calculate a composite score for memory relevance with improved context awareness
   */
  private calculateMemoryScore(memory: Memory, context?: string): number {
    const now = new Date();
    const memoryTime = new Date(memory.timestamp || now);
    const hoursOld = (now.getTime() - memoryTime.getTime()) / (1000 * 60 * 60);
    
    // Recency score (decays over time)
    const recencyScore = Math.max(0, 10 - hoursOld / 24);
    
    // Importance score (1-10)
    const importanceScore = memory.importance_score || 5;
    
    // Emotional relevance (1-10)
    const emotionalScore = memory.emotional_relevance || 5;
    
    // Similarity score (if available)
    const similarityScore = (memory as any).similarity ? 
      (1 - (memory as any).similarity) * 10 : 5;
    
    // Context relevance boost
    let contextBoost = 1;
    if (context && memory.content) {
      // Give extra weight to conversation memories
      if (memory.content.includes('said to me') || memory.content.includes('told me') || 
          memory.content.includes('I responded')) {
        contextBoost = 1.5;
      }
      
      // Boost memories that contain words from the current context
      const contextWords = context.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      const memoryWords = memory.content.toLowerCase().split(/\s+/);
      const commonWords = contextWords.filter(word => memoryWords.includes(word));
      
      if (commonWords.length > 0) {
        contextBoost += 0.1 * commonWords.length;
      }
    }
    
    // Adjust weights to give more importance to similarity when available
    const weights = (memory as any).similarity ? 
      { recency: 0.2, importance: 0.3, emotional: 0.2, similarity: 0.3 } :
      { recency: 0.3, importance: 0.4, emotional: 0.2, similarity: 0.1 };
    
    const baseScore = (recencyScore * weights.recency) + 
                     (importanceScore * weights.importance) + 
                     (emotionalScore * weights.emotional) + 
                     (similarityScore * weights.similarity);
    
    return baseScore * contextBoost;
  }

  /**
   * Extract tags from observation content
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Common patterns to extract
    const patterns = [
      /player/i,
      /moved|walking|running/i,
      /talking|conversation/i,
      /entered|left/i,
      /crafting|building/i,
      /farming|planting/i,
      /blacksmith|merchant|farmer/i
    ];
    
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        tags.push(pattern.source.replace(/[^a-zA-Z]/g, ''));
      }
    });
    
    return tags;
  }

  /**
   * Calculate emotional relevance of an observation
   */
  private calculateEmotionalRelevance(content: string): number {
    let score = 5; // Default neutral
    
    // Positive emotional indicators
    if (/happy|smiled|excited|pleased|enjoyed/i.test(content)) {
      score += 2;
    }
    
    // Negative emotional indicators
    if (/sad|angry|frustrated|upset|worried/i.test(content)) {
      score += 2;
    }
    
    // Social interaction indicators
    if (/talked|conversation|greeted|waved/i.test(content)) {
      score += 1;
    }
    
    // Important events
    if (/entered|left|started|finished|completed/i.test(content)) {
      score += 1;
    }
    
    return Math.min(10, Math.max(1, score));
  }

  /**
   * Cache a memory for quick access
   */
  private async cacheMemory(memoryId: number, memory: Memory): Promise<void> {
    const cacheKey = `memory:${memoryId}`;
    await this.redisClient.setEx(cacheKey, this.MEMORY_CACHE_TTL, JSON.stringify(memory));
  }

  /**
   * Check if agent needs reflection based on cumulative importance scores
   * Following the Stanford paper approach: trigger when cumulative importance exceeds threshold
   */
  private async checkReflectionTrigger(agent_id: string): Promise<void> {
    try {
      // Get the last reflection time for this agent
      const lastReflectionResult = await this.pool.query(
        `SELECT MAX(timestamp) as last_reflection 
         FROM agent_memories 
         WHERE agent_id = $1 AND memory_type = 'reflection'`,
        [agent_id]
      );
      
      const lastReflection = lastReflectionResult.rows[0]?.last_reflection;
      const cutoffTime = lastReflection || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago if no reflection
      
      // Calculate cumulative importance score since last reflection
      const importanceResult = await this.pool.query(
        `SELECT SUM(importance_score) as cumulative_importance, COUNT(*) as memory_count
         FROM agent_memories 
         WHERE agent_id = $1 
         AND timestamp > $2 
         AND memory_type != 'reflection'`,
        [agent_id, cutoffTime]
      );
      
      const cumulativeImportance = parseFloat(importanceResult.rows[0]?.cumulative_importance || '0');
      const memoryCount = parseInt(importanceResult.rows[0]?.memory_count || '0');
      
      // Stanford paper suggests reflection threshold around 150-200 points
      const REFLECTION_THRESHOLD = 150;
      
      // Also ensure minimum number of memories (avoid reflecting on too little data)
      const MIN_MEMORIES_FOR_REFLECTION = 5;
      
      console.log(`💭 [REFLECTION] ${agent_id} - Cumulative importance: ${cumulativeImportance}, Memory count: ${memoryCount}`);
      
      if (cumulativeImportance >= REFLECTION_THRESHOLD && memoryCount >= MIN_MEMORIES_FOR_REFLECTION) {
        console.log(`🔄 [REFLECTION] Triggering reflection for ${agent_id} (importance: ${cumulativeImportance})`);
        
        // Queue reflection generation
        await this.queueReflectionGeneration(agent_id, cumulativeImportance);
      }
    } catch (error) {
      console.error(`❌ [REFLECTION] Error checking reflection trigger for ${agent_id}:`, error);
    }
  }

  /**
   * Queue reflection generation for an agent
   */
  private async queueReflectionGeneration(agent_id: string, cumulativeImportance: number): Promise<void> {
    try {
      // Add to Redis queue for reflection processing
      const reflectionData = {
        agent_id,
        cumulative_importance: cumulativeImportance,
        trigger_time: new Date().toISOString(),
        status: 'pending'
      };
      
      await this.redisClient.lPush(`reflection_queue:${agent_id}`, JSON.stringify(reflectionData));
      
      // Also add to global reflection processing queue
      await this.redisClient.lPush('global_reflection_queue', JSON.stringify(reflectionData));
      
      console.log(`📝 [REFLECTION] Queued reflection generation for ${agent_id}`);
    } catch (error) {
      console.error(`❌ [REFLECTION] Error queuing reflection for ${agent_id}:`, error);
    }
  }

  /**
   * Generate reflection for an agent based on recent memories
   * Following the Stanford paper approach: synthesize higher-level insights
   */
  async generateReflection(agent_id: string): Promise<void> {
    try {
      console.log(`💭 [REFLECTION] Starting reflection generation for ${agent_id}`);
      
      // Get recent memories since last reflection
      const recentMemories = await this.getMemoriesForReflection(agent_id);
      
      if (recentMemories.length < 5) {
        console.log(`⚠️ [REFLECTION] Not enough memories for reflection (${recentMemories.length} memories)`);
        return;
      }
      
      // Generate reflection using LLM
      const reflectionText = await this.generateReflectionText(agent_id, recentMemories);
      
      if (!reflectionText) {
        console.log(`❌ [REFLECTION] Failed to generate reflection text for ${agent_id}`);
        return;
      }
      
      // Calculate importance score for reflection (typically high)
      const importanceScore = this.calculateReflectionImportance(recentMemories);
      
      // Store reflection as a memory
      const reflectionMemory: Memory = {
        agent_id,
        memory_type: 'reflection',
        content: reflectionText,
        importance_score: importanceScore,
        emotional_relevance: 7, // Reflections are emotionally relevant
        tags: ['reflection', 'self_insight', 'pattern_recognition'],
        related_agents: this.extractRelatedAgents(recentMemories),
        related_players: this.extractRelatedPlayers(recentMemories),
        location: 'internal' // Reflections are internal thoughts
      };
      
      // Store reflection (skip normal filtering as reflections are always important)
      await this.storeReflectionMemory(reflectionMemory);
      
      console.log(`✅ [REFLECTION] Generated reflection for ${agent_id}: "${reflectionText.substring(0, 100)}..."`);
      
    } catch (error) {
      console.error(`❌ [REFLECTION] Error generating reflection for ${agent_id}:`, error);
    }
  }

  /**
   * Get memories for reflection analysis
   */
  private async getMemoriesForReflection(agent_id: string): Promise<Memory[]> {
    const lastReflectionResult = await this.pool.query(
      `SELECT MAX(timestamp) as last_reflection 
       FROM agent_memories 
       WHERE agent_id = $1 AND memory_type = 'reflection'`,
      [agent_id]
    );
    
    const lastReflection = lastReflectionResult.rows[0]?.last_reflection;
    const cutoffTime = lastReflection || new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get memories since last reflection, ordered by importance and recency
    const result = await this.pool.query(
      `SELECT id, agent_id, memory_type, content, importance_score, emotional_relevance,
              tags, related_agents, related_players, location, timestamp
       FROM agent_memories
       WHERE agent_id = $1 
       AND timestamp > $2 
       AND memory_type != 'reflection'
       ORDER BY importance_score DESC, timestamp DESC
       LIMIT 50`,
      [agent_id, cutoffTime]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      agent_id: row.agent_id,
      memory_type: row.memory_type,
      content: row.content,
      importance_score: row.importance_score,
      emotional_relevance: row.emotional_relevance,
      tags: row.tags,
      related_agents: row.related_agents,
      related_players: row.related_players,
      location: row.location,
      timestamp: row.timestamp
    }));
  }

  /**
   * Generate reflection text using LLM
   */
  private async generateReflectionText(agent_id: string, memories: Memory[]): Promise<string | null> {
    try {
      // Get agent information
      const agentResult = await this.pool.query(
        'SELECT name, constitution, personality_traits, primary_goal FROM agents WHERE id = $1',
        [agent_id]
      );
      
      if (agentResult.rows.length === 0) {
        console.error(`Agent ${agent_id} not found`);
        return null;
      }
      
      const agent = agentResult.rows[0];
      
      // Construct reflection prompt
      const memoryTexts = memories.map(m => `- ${m.content} (importance: ${m.importance_score})`).join('\n');
      
      const prompt = `You are ${agent.name}, a character in Heartwood Valley. 

Your core personality: ${agent.constitution}
Your goal: ${agent.primary_goal}
Your traits: ${agent.personality_traits?.join(', ') || 'None specified'}

Based on your recent experiences and memories, reflect on patterns, relationships, and insights. Generate a higher-level understanding of what's been happening in your life.

Recent memories:
${memoryTexts}

Generate a thoughtful reflection that synthesizes these experiences into a deeper insight. This should be a single, coherent thought that captures a pattern or realization about your relationships, activities, or situation. Keep it natural and in character.

Examples of good reflections:
- "I've noticed that I've been spending more time at the library lately - perhaps I'm seeking knowledge to help solve the town's problems"
- "My conversations with the townspeople suggest they're worried about the upcoming harvest"
- "I seem to be developing a closer relationship with Sarah - our daily conversations about farming are becoming more personal"

Your reflection:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are generating a personal reflection for an AI agent. Keep it concise, insightful, and in character.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const reflectionText = response.choices[0]?.message?.content?.trim();
      return reflectionText || null;
      
    } catch (error) {
      console.error(`Error generating reflection text for ${agent_id}:`, error);
      return null;
    }
  }

  /**
   * Calculate importance score for reflection
   */
  private calculateReflectionImportance(memories: Memory[]): number {
    if (memories.length === 0) return 7;
    
    // Reflections are generally important, but base it on the memories they synthesize
    const avgImportance = memories.reduce((sum, m) => sum + m.importance_score, 0) / memories.length;
    
    // Reflections are typically more important than the average of their constituent memories
    return Math.min(10, Math.max(7, Math.round(avgImportance + 2)));
  }

  /**
   * Extract related agents from memories
   */
  private extractRelatedAgents(memories: Memory[]): string[] {
    const agents = new Set<string>();
    memories.forEach(m => {
      if (m.related_agents) {
        m.related_agents.forEach(agent => agents.add(agent));
      }
    });
    return Array.from(agents);
  }

  /**
   * Extract related players from memories
   */
  private extractRelatedPlayers(memories: Memory[]): string[] {
    const players = new Set<string>();
    memories.forEach(m => {
      if (m.related_players) {
        m.related_players.forEach(player => players.add(player));
      }
    });
    return Array.from(players);
  }

  /**
   * Store reflection memory (bypassing normal filtering)
   */
  private async storeReflectionMemory(memory: Memory): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate embedding for the reflection
      const embedding = await this.generateEmbedding(memory.content);
      
      // Insert the reflection into the database
      await client.query(
        `INSERT INTO agent_memories (
          agent_id, memory_type, content, importance_score, emotional_relevance,
          tags, related_agents, related_players, location, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          memory.agent_id,
          memory.memory_type,
          memory.content,
          memory.importance_score,
          memory.emotional_relevance,
          memory.tags,
          memory.related_agents,
          memory.related_players,
          memory.location,
          `[${embedding.join(',')}]`
        ]
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ [REFLECTION] Stored reflection for ${memory.agent_id}: "${memory.content.substring(0, 50)}..."`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Consolidate related memories into summaries for better recall
   */
  async consolidatePlayerMemories(agent_id: string, player_id: string): Promise<void> {
    try {
      // Get all memories related to this player from the last 24 hours
      const recentMemories = await this.pool.query(
        `SELECT id, content, importance_score, timestamp
         FROM agent_memories
         WHERE agent_id = $1 
         AND related_players @> $2::text[]
         AND timestamp >= NOW() - INTERVAL '24 hours'
         ORDER BY timestamp ASC`,
        [agent_id, `{${player_id}}`]
      );

      if (recentMemories.rows.length < 3) {
        return; // Not enough memories to consolidate
      }

      // Group memories by conversation sessions (within 1 hour of each other)
      const sessions: Memory[][] = [];
      let currentSession: Memory[] = [];
      let lastTimestamp: Date | null = null;

      for (const row of recentMemories.rows) {
        const memory: Memory = {
          id: row.id,
          agent_id,
          memory_type: 'observation',
          content: row.content,
          importance_score: row.importance_score,
          emotional_relevance: 5,
          tags: [],
          related_agents: [],
          related_players: [player_id],
          location: 'conversation',
          timestamp: row.timestamp
        };

        if (lastTimestamp && 
            new Date(row.timestamp).getTime() - lastTimestamp.getTime() > 60 * 60 * 1000) {
          // More than 1 hour gap, start new session
          if (currentSession.length > 0) {
            sessions.push(currentSession);
          }
          currentSession = [memory];
        } else {
          currentSession.push(memory);
        }
        
        lastTimestamp = new Date(row.timestamp);
      }

      if (currentSession.length > 0) {
        sessions.push(currentSession);
      }

      // Consolidate each session that has 3+ memories
      for (const session of sessions) {
        if (session.length >= 3) {
          await this.consolidateMemorySession(agent_id, player_id, session);
        }
      }

      console.log(`✅ Consolidated ${sessions.length} memory sessions for ${agent_id} with ${player_id}`);
    } catch (error) {
      console.error(`❌ Error consolidating memories for ${agent_id}:`, error);
    }
  }

  /**
   * Consolidate a session of memories into a single summary
   */
  private async consolidateMemorySession(agent_id: string, player_id: string, memories: Memory[]): Promise<void> {
    try {
      const playerName = await this.getPlayerName(player_id);
      const memoryTexts = memories.map(m => m.content).join('\n- ');
      
      // Create consolidation summary
      const consolidatedContent = `Conversation summary with ${playerName}: ${memoryTexts}`;
      
      // Calculate average importance
      const avgImportance = memories.reduce((sum, m) => sum + m.importance_score, 0) / memories.length;
      
      // Create consolidated memory
      const consolidatedMemory: Memory = {
        agent_id,
        memory_type: 'observation',
        content: consolidatedContent,
        importance_score: Math.round(avgImportance + 1), // Slightly boost consolidated memories
        emotional_relevance: 6,
        tags: ['conversation', 'consolidated', 'summary'],
        related_agents: [],
        related_players: [player_id],
        location: 'conversation'
      };

      // Store consolidated memory
      await this.storeMemory(consolidatedMemory);
      
      // Mark original memories as consolidated (add tag)
      const memoryIds = memories.map(m => m.id).filter(id => id !== undefined);
      if (memoryIds.length > 0) {
        await this.pool.query(
          `UPDATE agent_memories 
           SET tags = array_append(tags, 'consolidated')
           WHERE id = ANY($1)`,
          [memoryIds]
        );
      }

      console.log(`📋 Consolidated ${memories.length} memories into summary for ${agent_id}`);
    } catch (error) {
      console.error(`❌ Error consolidating memory session:`, error);
    }
  }

  /**
   * Get memory statistics for an agent
   */
  async getMemoryStats(agent_id: string): Promise<{
    total_memories: number;
    recent_memories: number;
    memory_types: Record<string, number>;
    avg_importance: number;
  }> {
    const stats = await this.pool.query(`
      SELECT 
        COUNT(*) as total_memories,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_memories,
        memory_type,
        AVG(importance_score) as avg_importance
      FROM agent_memories 
      WHERE agent_id = $1
      GROUP BY memory_type
    `, [agent_id]);
    
    const memory_types: Record<string, number> = {};
    let total_memories = 0;
    let recent_memories = 0;
    let avg_importance = 0;
    
    stats.rows.forEach(row => {
      memory_types[row.memory_type] = parseInt(row.total_memories);
      total_memories += parseInt(row.total_memories);
      if (row.recent_memories) {
        recent_memories += parseInt(row.recent_memories);
      }
      avg_importance = parseFloat(row.avg_importance) || 0;
    });
    
    return {
      total_memories,
      recent_memories,
      memory_types,
      avg_importance
    };
  }

  /**
   * Check if memory should be stored based on importance threshold
   */
  private shouldStoreMemory(importance: number): boolean {
    return importance >= 4; // Skip low-importance observations
  }

  /**
   * Check if a memory should be created based on temporal filtering
   */
  private async shouldCreateMemoryTemporally(
    agent_id: string, 
    content: string, 
    memory_type: string
  ): Promise<boolean> {
    const recentMemories = await this.retrieveMemories({
      agent_id,
      memory_types: [memory_type],
      recent_hours: 1, // Check last hour
      limit: 5
    });

    // For movement memories, be more restrictive
    if (content.includes('walking') || content.includes('moving')) {
      const lastMemory = recentMemories[0];
      if (lastMemory && 
          (lastMemory.content.includes('walking') || lastMemory.content.includes('moving'))) {
        const timeDiff = new Date().getTime() - new Date(lastMemory.timestamp || new Date()).getTime();
        // Only allow new movement memory if 5 minutes have passed
        return timeDiff > 5 * 60 * 1000;
      }
    }

    // For other memories, check if very similar content exists in recent memory
    const similarRecent = recentMemories.find(m => {
      const similarity = this.calculateContentSimilarity(content, m.content);
      return similarity > 0.8; // 80% similar
    });

    return !similarRecent;
  }

  /**
   * Calculate dynamic similarity threshold based on memory availability
   */
  private async getDynamicSimilarityThreshold(agent_id: string, memory_type: string): Promise<number> {
    try {
      // Get recent memory count for this agent
      const recentMemoryCount = await this.pool.query(
        `SELECT COUNT(*) as count FROM agent_memories 
         WHERE agent_id = $1 
         AND memory_type = $2 
         AND timestamp >= NOW() - INTERVAL '6 hours'`,
        [agent_id, memory_type]
      );
      
      const count = parseInt(recentMemoryCount.rows[0]?.count || '0');
      
      // If we have very few memories, be more lenient
      if (count < 5) {
        return 0.25; // More lenient threshold
      } else if (count < 15) {
        return 0.20; // Moderate threshold
      } else {
        return 0.15; // Strict threshold (current)
      }
    } catch (error) {
      console.error('Error calculating dynamic similarity threshold:', error);
      return 0.15; // Fallback to current threshold
    }
  }

  /**
   * Check if a memory is too similar to existing memories using dynamic threshold
   */
  private async isMemoryTooSimilar(
    agent_id: string, 
    content: string, 
    embedding: number[]
  ): Promise<boolean> {
    try {
      // Get dynamic threshold based on memory availability
      const threshold = await this.getDynamicSimilarityThreshold(agent_id, 'observation');
      
      // Check semantic similarity with recent memories
      const similarMemories = await this.pool.query(`
        SELECT content, (embedding <-> $2) as similarity
        FROM agent_memories
        WHERE agent_id = $1 
        AND timestamp >= NOW() - INTERVAL '6 hours'
        ORDER BY similarity
        LIMIT 3
      `, [agent_id, `[${embedding.join(',')}]`]);

      // Use dynamic threshold instead of fixed 0.15
      const tooSimilar = similarMemories.rows.some(row => row.similarity < threshold);
      
      if (tooSimilar) {
        console.log(`🔍 Found similar memory: "${similarMemories.rows[0].content.substring(0, 50)}..." (similarity: ${similarMemories.rows[0].similarity}, threshold: ${threshold})`);
      }
      
      return tooSimilar;
    } catch (error) {
      console.error('Error checking semantic similarity:', error);
      return false; // On error, allow the memory to be stored
    }
  }

  /**
   * Calculate basic content similarity for temporal filtering
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  /**
   * Get conversation-specific memories for better recall of player details
   */
  async getConversationMemories(agent_id: string, player_id: string, limit: number = 8): Promise<Memory[]> {
    try {
      // Get player name for more targeted search
      const playerName = await this.getPlayerName(player_id);
      
      // Get recent memories involving this specific player with better targeting
      const result = await this.pool.query(
        `SELECT id, agent_id, memory_type, content, importance_score, emotional_relevance,
                tags, related_agents, related_players, location, timestamp,
                CASE 
                  WHEN related_players @> $2::text[] THEN 2
                  ELSE 0
                END as relevance_score
         FROM agent_memories
         WHERE agent_id = $1 
         AND related_players @> $2::text[]
         AND timestamp >= NOW() - INTERVAL '72 hours'
         ORDER BY relevance_score DESC, importance_score DESC, timestamp DESC
         LIMIT $3`,
        [agent_id, `{${player_id}}`, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        agent_id: row.agent_id,
        memory_type: row.memory_type,
        content: row.content,
        importance_score: row.importance_score,
        emotional_relevance: row.emotional_relevance,
        tags: row.tags,
        related_agents: row.related_agents,
        related_players: row.related_players,
        location: row.location,
        timestamp: row.timestamp
      }));
    } catch (error) {
      console.error(`Error retrieving conversation memories for ${agent_id}:`, error);
      return [];
    }
  }

  /**
   * Get player name from character ID with caching
   */
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