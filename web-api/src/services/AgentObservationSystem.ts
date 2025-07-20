import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from './AgentMemoryManager';
import { ReputationManager } from './ReputationManager';

interface PlayerAction {
  player_id: string;
  action_type: 'move' | 'interact' | 'chat' | 'gift_giving' | 'player_pushing' | 'item_destruction' | 'helping' | 'rude_behavior' | 'generous_act' | 'social_event' | 'public_speech' | 'activity_update';
  location: string;
  target?: string;
  data?: any;
  timestamp: Date;
  is_witnessable?: boolean; // Flag for socially significant events
}

interface AgentObservation {
  agent_id: string;
  observation: string;
  location: string;
  related_players: string[];
  related_agents: string[];
  importance: number;
  tags: string[];
}

export class AgentObservationSystem {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private memoryManager: AgentMemoryManager;
  private reputationManager: ReputationManager;
  private observationRange: number = 20; // tiles - for memory storage
  private thoughtTriggerRange: number = 10; // tiles - for LLM-based thoughts (cost optimization)
  private readonly OBSERVATION_CHANNEL = 'player_actions';
  
  constructor(
    pool: Pool, 
    redisClient: ReturnType<typeof createClient>, 
    memoryManager: AgentMemoryManager,
    reputationManager: ReputationManager
  ) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.memoryManager = memoryManager;
    this.reputationManager = reputationManager;
  }

  /**
   * Initialize the observation system
   */
  async initialize(): Promise<void> {
    // Subscribe to player action events
    const subscriber = this.redisClient.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(this.OBSERVATION_CHANNEL, async (message) => {
      try {
        const action: PlayerAction = JSON.parse(message);
        await this.processPlayerAction(action);
      } catch (error) {
        console.error('Error processing player action:', error);
      }
    });

    // Subscribe to player current activity events
    await subscriber.subscribe('player_current_activity', async (message) => {
      try {
        const activityData = JSON.parse(message);
        await this.observePlayerCurrentActivity(
          activityData.player_id,
          activityData.player_name,
          activityData.location,
          activityData.current_activity
        );
      } catch (error) {
        console.error('Error processing player current activity:', error);
      }
    });

    console.log('✅ Agent Observation System initialized');
  }

  /**
   * Process a player action and generate observations for nearby agents
   */
  async processPlayerAction(action: PlayerAction): Promise<void> {
    try {
      // Skip movement actions entirely - NPCs shouldn't process player movement
      if (action.action_type === 'move') {
        return;
      }
      
      // Find agents within observation range
      const nearbyAgents = await this.findNearbyAgents(action.location, this.observationRange);
      
      console.log(`👥 [OBSERVATION] Processing ${action.action_type} at ${action.location} - ${nearbyAgents.length} NPCs in range (${this.observationRange} tiles)`);
      if (nearbyAgents.length > 0) {
        console.log(`🔍 [OBSERVATION] Nearby NPCs: ${nearbyAgents.map(a => a.name).join(', ')}`);
      }
      
      // Generate observations for each nearby agent
      let observationsCreated = 0;
      for (const agent of nearbyAgents) {
        try {
          console.log(`🔄 [OBSERVATION] Processing NPC ${agent.name} for ${action.action_type}`);
          const observation = await this.generateObservation(agent, action);
          
          if (observation) {
            await this.storeObservation(observation);
            observationsCreated++;
            console.log(`📝 [OBSERVATION] Created memory for NPC ${agent.name} about ${action.action_type} (importance: ${observation.importance})`);
          } else {
            console.log(`⚠️ [OBSERVATION] No observation generated for NPC ${agent.name} for ${action.action_type}`);
          }
        } catch (error) {
          console.error(`❌ [OBSERVATION] Error processing NPC ${agent.name} for ${action.action_type}:`, error);
        }
        
        // Small delay to prevent potential race conditions
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      if (observationsCreated > 0) {
        console.log(`✅ [OBSERVATION] Created ${observationsCreated} memories for ${action.action_type} action`);
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
   * Record a witnessable social event (convenience method)
   */
  async recordWitnessableEvent(
    player_id: string,
    action_type: 'gift_giving' | 'player_pushing' | 'item_destruction' | 'helping' | 'rude_behavior' | 'generous_act' | 'social_event' | 'public_speech' | 'activity_update',
    location: string,
    eventData: any
  ): Promise<void> {
    const action: PlayerAction = {
      player_id,
      action_type,
      location,
      data: eventData,
      timestamp: new Date(),
      is_witnessable: true
    };

    await this.recordPlayerAction(action);
  }

  /**
   * Update player reputation based on witnessed social events
   */
  private async updateReputationFromWitnessedEvent(observation: AgentObservation): Promise<void> {
    try {
      for (const player_id of observation.related_players) {
        let reputationChange = 0;
        let reason = '';

        // Determine reputation change based on tags
        if (observation.tags.includes('positive_action')) {
          reputationChange = 2; // Positive actions increase reputation
          
          if (observation.tags.includes('generosity')) {
            reputationChange = 3; // Generous acts have more impact
            reason = 'Generous action witnessed';
          } else if (observation.tags.includes('helping')) {
            reputationChange = 2;
            reason = 'Helpful action witnessed';
          } else {
            reason = 'Positive action witnessed';
          }
          
        } else if (observation.tags.includes('negative_action')) {
          reputationChange = -2; // Negative actions decrease reputation
          
          if (observation.tags.includes('aggression')) {
            reputationChange = -3; // Aggressive acts have more negative impact
            reason = 'Aggressive behavior witnessed';
          } else if (observation.tags.includes('destructive')) {
            reputationChange = -3;
            reason = 'Destructive behavior witnessed';
          } else {
            reason = 'Negative action witnessed';
          }
        }

        // Apply reputation change if significant
        if (reputationChange !== 0) {
          await this.reputationManager.updatePlayerReputation({
            character_id: player_id,
            score_change: reputationChange,
            reason: `${reason} by ${observation.agent_id}`,
            source: observation.agent_id
          });
          
          console.log(`📊 Updated reputation for ${player_id} by ${reputationChange} (${reason})`);
        }
      }
    } catch (error) {
      console.error('Error updating reputation from witnessed event:', error);
    }
  }

  /**
   * Generate an observation for an agent based on a player action
   */
  private async generateObservation(
    agent: { id: string; name: string; current_x: number; current_y: number; location: string },
    action: PlayerAction
  ): Promise<AgentObservation | null> {
    
    // Get player name from action data or fallback to ID
    const playerName = action.data?.name || `Player_${action.player_id.substring(0, 8)}`;
    
    let observationText = '';
    let importance = 7; // Default importance
    let tags: string[] = [];
    
    // Handle different action types
    switch (action.action_type) {
      case 'chat':
        observationText = `${playerName} said something at ${action.location}`;
        importance = 7;
        tags = ['chat', 'social_interaction'];
        break;
        
      case 'gift_giving':
        const gift = action.data?.gift || 'something';
        const recipient = action.data?.recipient || 'someone';
        observationText = `I saw ${playerName} give ${gift} to ${recipient}. It seemed like a very kind gesture.`;
        importance = 9; // High importance for witnessed social events
        tags = ['witnessable_social_event', 'gift_giving', 'positive_action', 'generosity'];
        break;
        
      case 'player_pushing':
        const target = action.data?.target || 'another person';
        observationText = `I witnessed ${playerName} push ${target}. This seemed aggressive and inappropriate.`;
        importance = 9; // High importance for witnessed social events  
        tags = ['witnessable_social_event', 'player_pushing', 'negative_action', 'aggression'];
        break;
        
      case 'item_destruction':
        const item = action.data?.item || 'something';
        observationText = `I saw ${playerName} destroy ${item}. This was destructive and concerning behavior.`;
        importance = 9; // High importance for witnessed social events
        tags = ['witnessable_social_event', 'item_destruction', 'negative_action', 'destructive'];
        break;
        
      case 'helping':
        const helpType = action.data?.helpType || 'someone';
        observationText = `I observed ${playerName} helping ${helpType}. This was a thoughtful and caring action.`;
        importance = 9; // High importance for witnessed social events
        tags = ['witnessable_social_event', 'helping', 'positive_action', 'caring'];
        break;
        
      case 'rude_behavior':
        const rudeAction = action.data?.rudeAction || 'behaving rudely';
        observationText = `I witnessed ${playerName} ${rudeAction}. This was inappropriate and disrespectful.`;
        importance = 9; // High importance for witnessed social events
        tags = ['witnessable_social_event', 'rude_behavior', 'negative_action', 'disrespectful'];
        break;
        
      case 'generous_act':
        const generousAction = action.data?.generousAction || 'doing something generous';
        observationText = `I saw ${playerName} ${generousAction}. This was a wonderful display of generosity.`;
        importance = 9; // High importance for witnessed social events
        tags = ['witnessable_social_event', 'generous_act', 'positive_action', 'generous'];
        break;
        
      case 'social_event':
        const eventType = action.data?.eventType || 'participating in a social event';
        observationText = `I observed ${playerName} ${eventType}. This was an interesting social interaction.`;
        importance = 8; // Medium-high importance for social events
        tags = ['witnessable_social_event', 'social_event', 'social_interaction'];
        break;
        
      case 'public_speech':
        const speech = action.data?.speech || 'something';
        observationText = `I heard ${playerName} say publicly: "${speech}". This was a public statement.`;
        importance = 9; // High importance for public speech
        tags = ['witnessable_social_event', 'public_speech', 'speech', 'public_statement'];
        break;
        
      case 'activity_update':
        const activity = action.data?.activity || 'updating their activity';
        observationText = `I noticed ${playerName} is ${activity}`;
        importance = 8; // Medium-high importance for activity updates
        tags = ['witnessable_social_event', 'activity_update', 'public_announcement'];
        break;
        


        
      default:
        // Skip unknown action types
        return null;
    }
    
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
      related_agents: action.data?.related_agents || [],
      importance,
      tags
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
      console.log(`🔍 [NEARBY] Finding agents in named location: ${location}`);
      const result = await this.pool.query(`
        SELECT a.id, a.name, s.current_x, s.current_y, a.current_location as location
        FROM agents a
        JOIN agent_states s ON a.id = s.agent_id
        WHERE a.current_location = $1
      `, [location]);
      
      console.log(`📍 [NEARBY] Found ${result.rows.length} agents in location ${location}: ${result.rows.map(r => r.name).join(', ')}`);
      return result.rows;
    }
    
    // Find agents within coordinate range
    console.log(`🔍 [NEARBY] Finding agents within ${range} tiles of coordinates (${coords.x}, ${coords.y})`);
    const result = await this.pool.query(`
      SELECT a.id, a.name, s.current_x, s.current_y, a.current_location as location
      FROM agents a
      JOIN agent_states s ON a.id = s.agent_id
      WHERE ABS(s.current_x - $1) <= $3 AND ABS(s.current_y - $2) <= $3
    `, [coords.x, coords.y, range]);
    
    console.log(`📍 [NEARBY] Found ${result.rows.length} agents within ${range} tiles of (${coords.x}, ${coords.y}): ${result.rows.map(r => `${r.name}(${r.current_x},${r.current_y})`).join(', ')}`);
    return result.rows;
  }

  /**
   * Store an observation in the agent's memory
   */
  private async storeObservation(observation: AgentObservation): Promise<void> {
    console.log(`💾 [OBSERVATION] Attempting to store observation for ${observation.agent_id}: "${observation.observation.substring(0, 50)}..." (importance: ${observation.importance})`);
    
    const memoryId = await this.memoryManager.storeObservationWithTags(
      observation.agent_id,
      observation.observation,
      observation.location,
      observation.related_agents,
      observation.related_players,
      observation.importance,
      observation.tags
    );
    
    if (memoryId !== -1) {
      const witnessableTag = observation.tags.includes('witnessable_social_event') ? '[WITNESSED] ' : '';
      console.log(`📝 Stored observation ${memoryId} for ${observation.agent_id}: ${witnessableTag}"${observation.observation.substring(0, 50)}..."`);
      
      // Update reputation for witnessable social events
      if (observation.tags.includes('witnessable_social_event') && observation.related_players.length > 0) {
        await this.updateReputationFromWitnessedEvent(observation);
      }
      
      // Only trigger scheduling thoughts for high-importance observations AND within thought trigger range
      if (observation.importance >= 8) {
        // Check if agent is within thought trigger range
        const agentResult = await this.pool.query(`
          SELECT a.id, a.name, s.current_x, s.current_y
          FROM agents a
          LEFT JOIN agent_states s ON a.id = s.agent_id
          WHERE a.id = $1
        `, [observation.agent_id]);
        
        if (agentResult.rows.length > 0) {
          const agent = agentResult.rows[0];
          const distance = this.calculateDistanceToLocation(agent, observation.location);
          
          if (distance <= this.thoughtTriggerRange) {
            console.log(`🧠 [OBSERVATION] Agent ${observation.agent_id} within thought range (${distance.toFixed(1)} tiles) - triggering LLM thoughts`);
            await this.triggerObservationSchedulingThoughts(observation);
          } else {
            console.log(`💾 [OBSERVATION] Agent ${observation.agent_id} outside thought range (${distance.toFixed(1)} tiles) - memory only`);
          }
        }
      }
    } else {
      console.log(`🚫 [OBSERVATION] Memory filtered out for ${observation.agent_id}: "${observation.observation.substring(0, 50)}..." (importance: ${observation.importance})`);
    }
  }

  /**
   * Trigger scheduling thoughts for high-importance observations
   */
  private async triggerObservationSchedulingThoughts(observation: AgentObservation): Promise<void> {
    try {
      console.log(`📅 [OBSERVATION] Triggering scheduling thoughts for ${observation.agent_id}: high importance observation`);
      
                  const response = await fetch(`http://localhost:${process.env.PORT || '3000'}/thought/conversation-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: observation.agent_id,
          conversationSummary: `Witnessed: ${observation.observation}`,
          duration: 300, // 5 minute duration estimate
          importance: observation.importance
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as any;
      console.log(`✅ [OBSERVATION] Observation scheduling thoughts completed for ${observation.agent_id}:`, result.thoughtResult?.decision);
    } catch (error) {
      console.error('Error in observation scheduling thoughts:', error);
    }
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
   * Get current observation range
   */
  getObservationRange(): number {
    return this.observationRange;
  }

  /**
   * Set observation range
   */
  setObservationRange(range: number): void {
    this.observationRange = Math.max(1, Math.min(20, range)); // Clamp between 1 and 20
    console.log(`📐 [OBSERVATION] Range set to ${this.observationRange} tiles`);
  }

  /**
   * Observe player current activity when NPCs are nearby
   * This should be called when an NPC gets close to a player
   */
  async observePlayerCurrentActivity(playerId: string, playerName: string, location: string, currentActivity: string): Promise<void> {
    if (!currentActivity || currentActivity === 'idle' || currentActivity === '') {
      return; // Don't observe idle or empty activities
    }

    try {
      // Find agents within observation range
      const nearbyAgents = await this.findNearbyAgents(location, this.observationRange);
      
      if (nearbyAgents.length === 0) {
        return;
      }

      console.log(`👀 [OBSERVATION] ${nearbyAgents.length} NPCs observing ${playerName}'s current activity: ${currentActivity}`);
      
      // Generate observations for each nearby agent
      let observationsCreated = 0;
      for (const agent of nearbyAgents) {
        // Check if agent already has a recent memory of this player's activity
        const recentMemoryCheck = await this.pool.query(`
          SELECT id FROM agent_memories 
          WHERE agent_id = $1 
          AND related_players @> $2::text[]
          AND content LIKE $3
          AND timestamp >= NOW() - INTERVAL '5 minutes'
          LIMIT 1
        `, [agent.id, `{${playerId}}`, `%${currentActivity}%`]);

        if (recentMemoryCheck.rows.length > 0) {
          continue; // Skip if agent already observed this activity recently
        }

        // Generate observation
        const observation = await this.generateCurrentActivityObservation(agent, playerId, playerName, currentActivity, location);
        
        if (observation) {
          await this.storeObservation(observation);
          observationsCreated++;
          console.log(`📝 [OBSERVATION] Created memory for NPC ${agent.name} about ${playerName}'s activity: ${currentActivity}`);
        }
      }
      
      if (observationsCreated > 0) {
        console.log(`✅ [OBSERVATION] Created ${observationsCreated} memories for player activity observation`);
      }
    } catch (error) {
      console.error('Error observing player current activity:', error);
    }
  }

  /**
   * Generate observation for player's current activity
   */
  private async generateCurrentActivityObservation(
    agent: { id: string; name: string; current_x: number; current_y: number; location: string },
    playerId: string,
    playerName: string,
    currentActivity: string,
    location: string
  ): Promise<AgentObservation | null> {
    
    const observationText = `I noticed ${playerName} is ${currentActivity} nearby`;
    const importance = 6; // Medium importance for observed activities
    const tags = ['current_activity_observation', 'player_activity', 'proximity_observation'];
    
    // Add contextual information based on agent's current activity
    const agentActivity = await this.getAgentActivity(agent.id);
    let fullObservation = observationText;
    if (agentActivity) {
      fullObservation += ` while I was ${agentActivity}`;
    }
    
    // Add temporal context
    const timeOfDay = this.getTimeOfDay();
    fullObservation += ` ${timeOfDay}`;
    
    return {
      agent_id: agent.id,
      observation: fullObservation,
      location: location,
      related_players: [playerId],
      related_agents: [],
      importance,
      tags
    };
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
   * Simulate environment observations (for testing) - DISABLED
   * This was creating artificial environment memories that cluttered the memory stream
   */
  async simulateEnvironmentObservations(): Promise<void> {
    console.log('⚠️  Environment observation simulation disabled - was creating artificial memories');
    // Method disabled to prevent automatic memory generation
    return;
  }

  /**
   * Calculate distance between agent and observation location
   */
  private calculateDistanceToLocation(agent: any, location: string): number {
    if (!agent.current_x || !agent.current_y) {
      // If no coordinates, assume distance based on location string
      return 15; // Default distance for location-based observations
    }
    
    // Parse location if it's in x,y format
    const coords = this.parseLocation(location);
    if (!coords) {
      return 15; // Default distance for named locations
    }
    
    return Math.sqrt(
      Math.pow(agent.current_x - coords.x, 2) + 
      Math.pow(agent.current_y - coords.y, 2)
    );
  }
} 