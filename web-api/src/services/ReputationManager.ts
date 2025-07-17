import { Pool, PoolClient } from 'pg';
import { createClient } from 'redis';

interface PlayerReputation {
  character_id: string;
  reputation_score: number;
  last_updated: Date;
}

interface GossipEntry {
  id?: number;
  source_character_id: string;
  target_character_id: string;
  npc_listener_id: string;
  content: string;
  is_positive: boolean;
  credibility_score: number;
  timestamp?: Date;
}

interface GossipAnalysis {
  subject_character_id: string | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  detected: boolean;
}

interface ReputationUpdate {
  character_id: string;
  score_change: number;
  reason: string;
  source?: string;
}

export class ReputationManager {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
  }

  /**
   * Get the current reputation score for a player
   */
  async getPlayerReputation(character_id: string): Promise<PlayerReputation | null> {
    try {
      // Validate UUID format - if not valid, return null instead of throwing
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(character_id)) {
        console.warn(`⚠️  Invalid UUID format for character_id: ${character_id}, using session ID as character_id`);
        // For now, return a default reputation for session IDs
        return {
          character_id: character_id,
          reputation_score: 50, // Default neutral reputation
          last_updated: new Date()
        };
      }
      
      const query = `
        SELECT character_id, reputation_score, last_updated
        FROM player_reputations
        WHERE character_id = $1
      `;
      
      const result = await this.pool.query(query, [character_id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting player reputation:', error);
      // Return default instead of throwing to prevent conversation failures
      return {
        character_id: character_id,
        reputation_score: 50,
        last_updated: new Date()
      };
    }
  }

  /**
   * Initialize reputation for a new player
   */
  async initializePlayerReputation(character_id: string): Promise<void> {
    try {
      const query = `
        INSERT INTO player_reputations (character_id, reputation_score, last_updated)
        VALUES ($1, 50, NOW())
        ON CONFLICT (character_id) DO NOTHING
      `;
      
      await this.pool.query(query, [character_id]);
    } catch (error) {
      console.error('Error initializing player reputation:', error);
      throw error;
    }
  }

  /**
   * Update a player's reputation score
   */
  async updatePlayerReputation(update: ReputationUpdate): Promise<void> {
    try {
      // Ensure the player has a reputation record
      await this.initializePlayerReputation(update.character_id);

      const query = `
        UPDATE player_reputations
        SET reputation_score = GREATEST(0, LEAST(100, reputation_score + $1)),
            last_updated = NOW()
        WHERE character_id = $2
      `;
      
      await this.pool.query(query, [update.score_change, update.character_id]);
      
      console.log(`Updated reputation for ${update.character_id} by ${update.score_change} (${update.reason})`);
    } catch (error) {
      console.error('Error updating player reputation:', error);
      throw error;
    }
  }

  /**
   * Log a gossip entry to the database
   */
  async logGossip(gossip: GossipEntry): Promise<number> {
    try {
      const query = `
        INSERT INTO gossip_logs (
          source_character_id, target_character_id, npc_listener_id,
          content, is_positive, credibility_score, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [
        gossip.source_character_id,
        gossip.target_character_id,
        gossip.npc_listener_id,
        gossip.content,
        gossip.is_positive,
        gossip.credibility_score
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error logging gossip:', error);
      throw error;
    }
  }

  /**
   * Get recent gossip about a specific player
   */
  async getRecentGossip(
    target_character_id: string, 
    hours: number = 24
  ): Promise<GossipEntry[]> {
    try {
      const query = `
        SELECT id, source_character_id, target_character_id, npc_listener_id,
               content, is_positive, credibility_score, timestamp
        FROM gossip_logs
        WHERE target_character_id = $1
        AND timestamp >= NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
      `;
      
      const result = await this.pool.query(query, [target_character_id]);
      return result.rows;
    } catch (error) {
      console.error('Error getting recent gossip:', error);
      throw error;
    }
  }

  /**
   * Analyze conversation content for potential gossip
   * This is a placeholder method that would integrate with LLM analysis
   */
  async analyzeConversationForGossip(
    content: string, 
    speaker_id: string, 
    listener_agent_id: string
  ): Promise<GossipAnalysis> {
    try {
      // TODO: Implement LLM-based gossip detection
      // For now, return a placeholder analysis
      return {
        subject_character_id: null,
        sentiment: 'neutral',
        confidence: 0,
        detected: false
      };
    } catch (error) {
      console.error('Error analyzing conversation for gossip:', error);
      throw error;
    }
  }

  /**
   * Process gossip and update reputation based on credibility
   */
  async processGossipImpact(gossip: GossipEntry): Promise<void> {
    try {
      // Calculate reputation change based on credibility and sentiment
      const baseImpact = gossip.is_positive ? 1 : -1;
      const credibilityMultiplier = gossip.credibility_score / 100;
      const reputationChange = Math.round(baseImpact * credibilityMultiplier * 2);

      if (reputationChange !== 0) {
        await this.updatePlayerReputation({
          character_id: gossip.target_character_id,
          score_change: reputationChange,
          reason: `Gossip from ${gossip.source_character_id} to ${gossip.npc_listener_id}`,
          source: gossip.source_character_id
        });
      }
    } catch (error) {
      console.error('Error processing gossip impact:', error);
      throw error;
    }
  }

  /**
   * Get reputation statistics for monitoring
   */
  async getReputationStats(): Promise<any> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_players,
          AVG(reputation_score) as average_reputation,
          MIN(reputation_score) as min_reputation,
          MAX(reputation_score) as max_reputation,
          COUNT(CASE WHEN reputation_score >= 75 THEN 1 END) as high_reputation,
          COUNT(CASE WHEN reputation_score <= 25 THEN 1 END) as low_reputation
        FROM player_reputations
      `;
      
      const result = await this.pool.query(statsQuery);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting reputation stats:', error);
      throw error;
    }
  }

  /**
   * Get gossip statistics for monitoring
   */
  async getGossipStats(): Promise<any> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_gossip,
          COUNT(CASE WHEN is_positive THEN 1 END) as positive_gossip,
          COUNT(CASE WHEN NOT is_positive THEN 1 END) as negative_gossip,
          AVG(credibility_score) as avg_credibility,
          COUNT(DISTINCT source_character_id) as unique_gossipers,
          COUNT(DISTINCT target_character_id) as unique_targets,
          COUNT(DISTINCT npc_listener_id) as unique_listeners
        FROM gossip_logs
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `;
      
      const result = await this.pool.query(statsQuery);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting gossip stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old gossip entries (for maintenance)
   */
  async cleanupOldGossip(days: number = 30): Promise<number> {
    try {
      const query = `
        DELETE FROM gossip_logs
        WHERE timestamp < NOW() - INTERVAL '${days} days'
      `;
      
      const result = await this.pool.query(query);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up old gossip:', error);
      throw error;
    }
  }

  /**
   * Get all players with their current reputation scores
   */
  async getAllReputations(): Promise<PlayerReputation[]> {
    try {
      const query = `
        SELECT character_id, reputation_score, last_updated
        FROM player_reputations
        ORDER BY reputation_score DESC
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting all reputations:', error);
      throw error;
    }
  }
} 