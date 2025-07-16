import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from './AgentMemoryManager';

interface PlayerAction {
  player_id: string;
  action_type: 'move' | 'interact' | 'chat' | 'join' | 'leave';
  location: string;
  target?: string;
  data?: any;
  timestamp: Date;
}

interface AgentObservation {
  agent_id: string;
  observation: string;
  location: string;
  related_players: string[];
  related_agents: string[];
  importance: number;
}

export class AgentObservationSystem {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private memoryManager: AgentMemoryManager;
  private readonly OBSERVATION_RANGE = 5; // tiles
  private readonly OBSERVATION_CHANNEL = 'player_actions';
  
  constructor(
    pool: Pool, 
    redisClient: ReturnType<typeof createClient>, 
    memoryManager: AgentMemoryManager
  ) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.memoryManager = memoryManager;
  }

  /**
   * Initialize the observation system
   */
  async initialize(): Promise<void> {
    // Subscribe to player action events
    const subscriber = this.redisClient.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(this.OBSERVATION_CHANNEL, (message) => {
      try {
        const action: PlayerAction = JSON.parse(message);
        this.processPlayerAction(action);
      } catch (error) {
        console.error('Error processing player action:', error);
      }
    });

    console.log('✅ Agent Observation System initialized');
  }

  /**
   * Process a player action and generate observations for nearby agents
   */
  async processPlayerAction(action: PlayerAction): Promise<void> {
    try {
      // Find agents within observation range
      const nearbyAgents = await this.findNearbyAgents(action.location, this.OBSERVATION_RANGE);
      
      // Generate observations for each nearby agent
      for (const agent of nearbyAgents) {
        const observation = await this.generateObservation(agent, action);
        
        if (observation) {
          await this.storeObservation(observation);
        }
      }
    } catch (error) {
      console.error('Error processing player action:', error);
    }
  }

  /**
   * Manually record a player action for observation
   */
  async recordPlayerAction(action: PlayerAction): Promise<void> {
    // Publish to Redis for real-time processing
    await this.redisClient.publish(this.OBSERVATION_CHANNEL, JSON.stringify(action));
  }

  /**
   * Generate an observation for an agent based on a player action
   */
  private async generateObservation(
    agent: { id: string; name: string; current_x: number; current_y: number; location: string },
    action: PlayerAction
  ): Promise<AgentObservation | null> {
    
    // Only process chat actions - skip all other action types for now
    if (action.action_type !== 'chat') {
      return null;
    }
    
    // Get player name from action data or fallback to ID
    const playerName = action.data?.name || `Player_${action.player_id.substring(0, 8)}`;
    
    let observationText = '';
    let importance = 7; // Chat messages are important
    
    // Only handle chat actions
    observationText = `${playerName} said something at ${action.location}`;
    
    // Add contextual information based on agent's current activity
    const agentActivity = await this.getAgentActivity(agent.id);
    if (agentActivity) {
      observationText += ` while I was ${agentActivity}`;
    }
    
    // Add temporal context
    const timeOfDay = this.getTimeOfDay();
    observationText += ` ${timeOfDay}`;
    
    return {
      agent_id: agent.id,
      observation: observationText,
      location: action.location,
      related_players: [action.player_id],
      related_agents: [],
      importance
    };
  }

  /**
   * Find agents within observation range of a location
   */
  private async findNearbyAgents(location: string, range: number): Promise<Array<{
    id: string;
    name: string;
    current_x: number;
    current_y: number;
    location: string;
  }>> {
    // Parse location if it's in x,y format
    const coords = this.parseLocation(location);
    
    if (!coords) {
      // If location is not coordinates, find agents in the same named location
      const result = await this.pool.query(`
        SELECT a.id, a.name, s.current_x, s.current_y, a.current_location as location
        FROM agents a
        JOIN agent_states s ON a.id = s.agent_id
        WHERE a.current_location = $1
      `, [location]);
      
      return result.rows;
    }
    
    // Find agents within coordinate range
    const result = await this.pool.query(`
      SELECT a.id, a.name, s.current_x, s.current_y, a.current_location as location
      FROM agents a
      JOIN agent_states s ON a.id = s.agent_id
      WHERE ABS(s.current_x - $1) <= $3 AND ABS(s.current_y - $2) <= $3
    `, [coords.x, coords.y, range]);
    
    return result.rows;
  }

  /**
   * Store an observation in the agent's memory
   */
  private async storeObservation(observation: AgentObservation): Promise<void> {
    const memoryId = await this.memoryManager.storeObservation(
      observation.agent_id,
      observation.observation,
      observation.location,
      observation.related_agents,
      observation.related_players,
      observation.importance
    );
    
    if (memoryId !== -1) {
      console.log(`📝 Stored observation ${memoryId} for ${observation.agent_id}: "${observation.observation.substring(0, 50)}..."`);
    }
    // Filtered observations are already logged by the memory manager
  }

  /**
   * Get player information from database
   */
  private async getPlayerInfo(player_id: string): Promise<{ name: string } | null> {
    try {
      // Check if player_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(player_id)) {
        // If not a UUID, return a fallback name based on the player ID
        return { name: `Player_${player_id.substring(0, 8)}` };
      }
      
      const result = await this.pool.query(`
        SELECT character_name as name
        FROM characters
        WHERE id = $1
      `, [player_id]);
      
      return result.rows[0] || { name: `Player_${player_id.substring(0, 8)}` };
    } catch (error) {
      console.error('Error fetching player info:', error);
      // Return fallback name even on error
      return { name: `Player_${player_id.substring(0, 8)}` };
    }
  }

  /**
   * Get agent's current activity
   */
  private async getAgentActivity(agent_id: string): Promise<string | null> {
    try {
      const result = await this.pool.query(`
        SELECT current_activity
        FROM agents
        WHERE id = $1
      `, [agent_id]);
      
      return result.rows[0]?.current_activity || null;
    } catch (error) {
      console.error('Error fetching agent activity:', error);
      return null;
    }
  }

  /**
   * Parse location string to coordinates
   */
  private parseLocation(location: string): { x: number; y: number } | null {
    const match = location.match(/^(\d+),(\d+)$/);
    if (match) {
      return {
        x: parseInt(match[1]),
        y: parseInt(match[2])
      };
    }
    return null;
  }

  /**
   * Get time of day description
   */
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 12) {
      return 'in the morning';
    } else if (hour >= 12 && hour < 17) {
      return 'in the afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'in the evening';
    } else {
      return 'at night';
    }
  }

  /**
   * Get observation statistics
   */
  async getObservationStats(): Promise<{
    total_observations: number;
    recent_observations: number;
    observations_by_agent: Record<string, number>;
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent,
        agent_id
      FROM agent_memories
      WHERE memory_type = 'observation'
      GROUP BY agent_id
    `);
    
    const observations_by_agent: Record<string, number> = {};
    let total_observations = 0;
    let recent_observations = 0;
    
    result.rows.forEach(row => {
      observations_by_agent[row.agent_id] = parseInt(row.total);
      total_observations += parseInt(row.total);
      recent_observations += parseInt(row.recent);
    });
    
    return {
      total_observations,
      recent_observations,
      observations_by_agent
    };
  }

  /**
   * Get recent observations for an agent
   */
  async getRecentObservations(agent_id: string, limit: number = 10): Promise<Array<{
    content: string;
    timestamp: Date;
    location: string;
    importance: number;
  }>> {
    const result = await this.pool.query(`
      SELECT content, timestamp, location, importance_score
      FROM agent_memories
      WHERE agent_id = $1 AND memory_type = 'observation'
      ORDER BY timestamp DESC
      LIMIT $2
    `, [agent_id, limit]);
    
    return result.rows.map(row => ({
      content: row.content,
      timestamp: row.timestamp,
      location: row.location,
      importance: row.importance_score
    }));
  }

  /**
   * Simulate environment observations (for testing)
   */
  async simulateEnvironmentObservations(): Promise<void> {
    const agents = await this.pool.query('SELECT id FROM agents');
    
    for (const agent of agents.rows) {
      const environmentObservations = [
        'The sun is shining brightly today',
        'I can hear birds chirping outside',
        'The air feels fresh and cool',
        'There\'s a gentle breeze blowing',
        'I notice the flowers in the garden are blooming'
      ];
      
      const observation = environmentObservations[Math.floor(Math.random() * environmentObservations.length)];
      
      await this.memoryManager.storeObservation(
        agent.id,
        observation,
        'environment',
        [],
        [],
        2 // Low importance for environmental observations
      );
    }
  }
} 