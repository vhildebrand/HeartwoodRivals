import { Pool, PoolClient } from 'pg';
import { createClient } from 'redis';

interface PlayerRelationship {
  agent_id: string;
  character_id: string;
  relationship_type: string;
  affection_score: number;
  trust_level: number;
  interaction_frequency: number;
  last_interaction: Date;
  contention_state: 'open' | 'conflicted' | 'focused' | 'exclusive';
  relationship_status: 'acquaintance' | 'friend' | 'close_friend' | 'romantic_interest' | 'dating' | 'estranged';
}

interface ContentionStateOptions {
  agent_id: string;
  affection_threshold?: number;
  close_friend_threshold?: number;
  contention_difference?: number;
  focus_lead?: number;
}

export class RelationshipManager {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
  }

  /**
   * Get all player relationships for a specific agent
   */
  async getAgentRelationships(agent_id: string): Promise<PlayerRelationship[]> {
    try {
      const query = `
        SELECT agent_id, character_id, relationship_type, affection_score, 
               trust_level, interaction_frequency, last_interaction,
               contention_state, relationship_status
        FROM agent_player_relationships
        WHERE agent_id = $1
        ORDER BY affection_score DESC
      `;
      
      const result = await this.pool.query(query, [agent_id]);
      return result.rows;
    } catch (error) {
      console.error('Error getting agent relationships:', error);
      throw error;
    }
  }

  /**
   * Update the contention state for an agent based on their relationships
   */
  async updateContentionState(options: ContentionStateOptions): Promise<string> {
    try {
      const { 
        agent_id, 
        affection_threshold = 60,
        close_friend_threshold = 70,
        contention_difference = 15,
        focus_lead = 20
      } = options;

      // Get current relationships
      const relationships = await this.getAgentRelationships(agent_id);
      
      // Filter to relationships that meet the threshold
      const significantRelationships = relationships.filter(
        r => r.affection_score >= affection_threshold
      );

      // Filter to close friends
      const closeFriends = relationships.filter(
        r => r.affection_score >= close_friend_threshold
      );

      let newState: string = 'open';

      if (closeFriends.length >= 2) {
        // Check if they're within contention range
        const sorted = closeFriends.sort((a, b) => b.affection_score - a.affection_score);
        const topScore = sorted[0].affection_score;
        const secondScore = sorted[1].affection_score;
        
        if (topScore - secondScore <= contention_difference) {
          newState = 'conflicted';
        } else if (topScore - secondScore >= focus_lead) {
          newState = 'focused';
        }
      }

      // Update all relationships for this agent to the new state
      await this.pool.query(
        `UPDATE agent_player_relationships 
         SET contention_state = $1 
         WHERE agent_id = $2`,
        [newState, agent_id]
      );

      return newState;
    } catch (error) {
      console.error('Error updating contention state:', error);
      throw error;
    }
  }

  /**
   * Get the current contention state for an agent
   */
  async getContentionState(agent_id: string): Promise<string> {
    try {
      const query = `
        SELECT contention_state 
        FROM agent_player_relationships 
        WHERE agent_id = $1 
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [agent_id]);
      return result.rows[0]?.contention_state || 'open';
    } catch (error) {
      console.error('Error getting contention state:', error);
      throw error;
    }
  }

  /**
   * Update relationship status for a specific agent-player pair
   */
  async updateRelationshipStatus(
    agent_id: string, 
    character_id: string, 
    newStatus: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE agent_player_relationships 
         SET relationship_status = $1 
         WHERE agent_id = $2 AND character_id = $3`,
        [newStatus, agent_id, character_id]
      );
    } catch (error) {
      console.error('Error updating relationship status:', error);
      throw error;
    }
  }

  /**
   * Get players in a specific relationship tier with an agent
   */
  async getPlayersInTier(
    agent_id: string, 
    tier: string, 
    min_affection_score?: number
  ): Promise<PlayerRelationship[]> {
    try {
      let query = `
        SELECT agent_id, character_id, relationship_type, affection_score, 
               trust_level, interaction_frequency, last_interaction,
               contention_state, relationship_status
        FROM agent_player_relationships
        WHERE agent_id = $1 AND relationship_status = $2
      `;
      
      const params: any[] = [agent_id, tier];
      
      if (min_affection_score !== undefined) {
        query += ' AND affection_score >= $3';
        params.push(min_affection_score);
      }
      
      query += ' ORDER BY affection_score DESC';
      
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting players in tier:', error);
      throw error;
    }
  }

  /**
   * Periodically check and update contention states for all agents
   * This method would be called by a scheduler or cron job
   */
  async processAllContentionStates(): Promise<void> {
    try {
      // Get all unique agent IDs from relationships
      const agentQuery = `
        SELECT DISTINCT agent_id 
        FROM agent_player_relationships
      `;
      
      const agentResult = await this.pool.query(agentQuery);
      const agentIds = agentResult.rows.map(row => row.agent_id);

      // Process each agent
      for (const agent_id of agentIds) {
        await this.updateContentionState({ agent_id });
      }

      console.log(`Processed contention states for ${agentIds.length} agents`);
    } catch (error) {
      console.error('Error processing all contention states:', error);
      throw error;
    }
  }

  /**
   * Get relationship statistics for debugging/monitoring
   */
  async getRelationshipStats(): Promise<any> {
    try {
      const statsQuery = `
        SELECT 
          contention_state,
          relationship_status,
          COUNT(*) as count,
          AVG(affection_score) as avg_affection,
          AVG(trust_level) as avg_trust
        FROM agent_player_relationships
        GROUP BY contention_state, relationship_status
        ORDER BY contention_state, relationship_status
      `;
      
      const result = await this.pool.query(statsQuery);
      return result.rows;
    } catch (error) {
      console.error('Error getting relationship stats:', error);
      throw error;
    }
  }
} 