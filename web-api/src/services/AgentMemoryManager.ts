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
      limit: limit / 3,
      recent_hours: 24
    });

    const importantMemories = await this.retrieveMemories({
      agent_id,
      limit: limit / 3,
      min_importance: 7
    });

    const relevantMemories = await this.retrieveMemories({
      agent_id,
      query_embedding: contextEmbedding,
      limit: limit / 3,
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
        const scoreA = this.calculateMemoryScore(a);
        const scoreB = this.calculateMemoryScore(b);
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
   * Calculate a composite score for memory relevance
   */
  private calculateMemoryScore(memory: Memory): number {
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
    
    return (recencyScore * 0.3) + (importanceScore * 0.4) + 
           (emotionalScore * 0.2) + (similarityScore * 0.1);
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
   * Check if agent needs reflection based on memory accumulation
   */
  private async checkReflectionTrigger(agent_id: string): Promise<void> {
    const recentMemoryCount = await this.pool.query(
      'SELECT COUNT(*) FROM agent_memories WHERE agent_id = $1 AND timestamp >= NOW() - INTERVAL \'24 hours\'',
      [agent_id]
    );
    
    const count = parseInt(recentMemoryCount.rows[0].count);
    
    // Trigger reflection if agent has accumulated many memories
    if (count > 0 && count % 20 === 0) {
      await this.redisClient.lPush(`reflection_queue:${agent_id}`, new Date().toISOString());
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
   * Check if a memory is too similar to existing memories using embeddings
   */
  private async isMemoryTooSimilar(
    agent_id: string, 
    content: string, 
    embedding: number[]
  ): Promise<boolean> {
    try {
      // Check semantic similarity with recent memories
      const similarMemories = await this.pool.query(`
        SELECT content, (embedding <-> $2) as similarity
        FROM agent_memories
        WHERE agent_id = $1 
        AND timestamp >= NOW() - INTERVAL '6 hours'
        ORDER BY similarity
        LIMIT 3
      `, [agent_id, `[${embedding.join(',')}]`]);

      // If any memory has similarity < 0.15 (very similar), skip this one
      const tooSimilar = similarMemories.rows.some(row => row.similarity < 0.15);
      
      if (tooSimilar) {
        console.log(`🔍 Found similar memory: "${similarMemories.rows[0].content.substring(0, 50)}..." (similarity: ${similarMemories.rows[0].similarity})`);
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
} 