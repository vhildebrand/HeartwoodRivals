/**
 * NPC Awareness System
 * Enables NPCs to observe their surroundings, including other NPCs and environmental changes
 * Integrates with the ThoughtSystem for lightweight decision-making
 */

import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from './AgentMemoryManager';
import { ThoughtSystemIntegration } from './ThoughtSystemIntegration';

interface NPCObservation {
  observerId: string;
  observerName: string;
  observationType: 'npc_activity' | 'npc_conversation' | 'environmental_change' | 'location_change';
  targetId?: string;
  targetName?: string;
  location: string;
  description: string;
  importance: number;
  shouldTriggerThought: boolean;
}

export class NPCAwarenessSystem {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private memoryManager: AgentMemoryManager;
  private thoughtSystem: ThoughtSystemIntegration;
  private observationRange: number = 20; // tiles - for memory storage
  private thoughtTriggerRange: number = 10; // tiles - for LLM-based thoughts (cost optimization)
  private lastObservationTime: Map<string, number> = new Map();
  private observationCooldown: number = 10000; // 10 seconds between observations per NPC (faster response)

  constructor(
    pool: Pool,
    redisClient: ReturnType<typeof createClient>,
    memoryManager: AgentMemoryManager,
    thoughtSystem: ThoughtSystemIntegration
  ) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.memoryManager = memoryManager;
    this.thoughtSystem = thoughtSystem;
    
    this.initializeAwarenessSystem();
  }

  private async initializeAwarenessSystem(): Promise<void> {
    // Run awareness checks every 10 seconds - improved responsiveness for conversation initiation
    setInterval(async () => {
      await this.processNPCAwareness();
    }, 10000);

    // Subscribe to NPC activity changes
    const subscriber = this.redisClient.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe('npc_activity_change', async (message: string) => {
      const activityData = JSON.parse(message);
      await this.processNPCActivityChange(activityData);
    });

    // Subscribe to player activity updates for continuous observation
    await subscriber.subscribe('player_current_activity', async (message: string) => {
      const activityData = JSON.parse(message);
      await this.processPlayerActivityObservation(activityData);
    });

    console.log('✅ NPC Awareness System initialized - 20 tile memory range, 10 tile thought range');
  }

  /**
   * Process NPC awareness - check what each NPC can observe
   */
  private async processNPCAwareness(): Promise<void> {
    try {
      // Get all active NPCs
      const npcsResult = await this.pool.query(`
        SELECT a.id, a.name, a.current_location, s.current_x, s.current_y
        FROM agents a
        LEFT JOIN agent_states s ON a.id = s.agent_id
        WHERE a.current_activity IS NOT NULL
      `);

      const npcs = npcsResult.rows;
      
      for (const npc of npcs) {
        // Check cooldown
        const lastObservation = this.lastObservationTime.get(npc.id) || 0;
        if (Date.now() - lastObservation < this.observationCooldown) {
          continue;
        }

        await this.processNPCObservations(npc);
        this.lastObservationTime.set(npc.id, Date.now());
      }
    } catch (error) {
      console.error('❌ [NPC_AWARENESS] Error processing NPC awareness:', error);
    }
  }

  /**
   * Process observations for a single NPC
   */
  private async processNPCObservations(observer: any): Promise<void> {
    try {
      // Find nearby NPCs
      const nearbyNPCs = await this.findNearbyNPCs(observer);
      
      if (nearbyNPCs.length === 0) {
        return;
      }

      //console.log(`👁️ [NPC_AWARENESS] ${observer.name} observing ${nearbyNPCs.length} nearby NPCs`);

      for (const targetNPC of nearbyNPCs) {
        if (targetNPC.id === observer.id) continue; // Don't observe self

        // Create observation
        const observation = await this.createNPCObservation(observer, targetNPC);
        
        if (observation) {
          // Store observation as memory
          await this.storeObservation(observation);
          
          // Trigger thought if needed
          if (observation.shouldTriggerThought) {
            await this.triggerObservationThought(observation);
          }
        }
      }
    } catch (error) {
      console.error(`❌ [NPC_AWARENESS] Error processing observations for ${observer.name}:`, error);
    }
  }

  /**
   * Find nearby NPCs within observation range
   */
  private async findNearbyNPCs(observer: any): Promise<any[]> {
    if (!observer.current_x || !observer.current_y) {
      // If no coordinates, find NPCs in same named location
      const result = await this.pool.query(`
        SELECT a.id, a.name, a.current_location, a.current_activity, s.current_x, s.current_y
        FROM agents a
        LEFT JOIN agent_states s ON a.id = s.agent_id
        WHERE a.current_location = $1 AND a.id != $2
      `, [observer.current_location, observer.id]);
      
      return result.rows;
    }

    // Find NPCs within coordinate range
    const result = await this.pool.query(`
      SELECT a.id, a.name, a.current_location, a.current_activity, s.current_x, s.current_y
      FROM agents a
      LEFT JOIN agent_states s ON a.id = s.agent_id
      WHERE a.id != $1
      AND s.current_x IS NOT NULL AND s.current_y IS NOT NULL
      AND ABS(s.current_x - $2) <= $4 AND ABS(s.current_y - $3) <= $4
    `, [observer.id, observer.current_x, observer.current_y, this.observationRange]);

    return result.rows;
  }

  /**
   * Create an NPC observation
   */
  private async createNPCObservation(observer: any, target: any): Promise<NPCObservation | null> {
    // Don't observe NPCs with no activity
    if (!target.current_activity || target.current_activity === 'No activity set') {
      return null;
    }

    // Check if observer has recent memory of this target's activity
    const recentMemoryCheck = await this.pool.query(`
      SELECT id FROM agent_memories 
      WHERE agent_id = $1 
      AND related_agents @> $2::text[]
      AND content LIKE $3
      AND timestamp >= NOW() - INTERVAL '30 minutes'
      LIMIT 1
    `, [observer.id, `{${target.id}}`, `%${target.current_activity}%`]);

    if (recentMemoryCheck.rows.length > 0) {
      return null; // Already observed this recently
    }

    // Calculate distance between observer and target
    const distance = this.calculateDistance(observer, target);
    
    // Determine observation type and importance
    const observationType = this.classifyObservation(target.current_activity);
    const importance = this.calculateObservationImportance(observer, target);
    
    // Only trigger LLM thoughts if within thoughtTriggerRange (10 tiles) AND importance >= 6
    const shouldTriggerThought = distance <= this.thoughtTriggerRange && importance >= 6;
    
    if (distance <= this.thoughtTriggerRange) {
      console.log(`🧠 [NPC_AWARENESS] ${observer.name} within thought range (${distance.toFixed(1)} tiles) of ${target.name}`);
    } else {
      //console.log(`💾 [NPC_AWARENESS] ${observer.name} observing ${target.name} for memory only (${distance.toFixed(1)} tiles)`);
    }

    const description = `I noticed ${target.name} ${target.current_activity} at ${target.current_location || 'nearby'}`;

    return {
      observerId: observer.id,
      observerName: observer.name,
      observationType,
      targetId: target.id,
      targetName: target.name,
      location: target.current_location || observer.current_location,
      description,
      importance,
      shouldTriggerThought
    };
  }

  /**
   * Calculate distance between two agents
   */
  private calculateDistance(observer: any, target: any): number {
    if (!observer.current_x || !observer.current_y || !target.current_x || !target.current_y) {
      // If no coordinates, assume they're in the same location if location names match
      return observer.current_location === target.current_location ? 0 : 15;
    }
    
    return Math.sqrt(
      Math.pow(observer.current_x - target.current_x, 2) + 
      Math.pow(observer.current_y - target.current_y, 2)
    );
  }

  /**
   * Classify the type of observation
   */
  private classifyObservation(activity: string): 'npc_activity' | 'npc_conversation' | 'environmental_change' | 'location_change' {
    const activityLower = activity.toLowerCase();
    
    if (activityLower.includes('talk') || activityLower.includes('convers') || activityLower.includes('speak')) {
      return 'npc_conversation';
    }
    
    if (activityLower.includes('mov') || activityLower.includes('walk') || activityLower.includes('go')) {
      return 'location_change';
    }
    
    return 'npc_activity';
  }

  /**
   * Calculate observation importance based on context
   */
  private calculateObservationImportance(observer: any, target: any): number {
    let importance = 4; // Base importance
    
    // Higher importance for unusual activities
    const unusualActivities = ['emergency', 'urgent', 'crisis', 'fight', 'argument', 'celebration'];
    if (unusualActivities.some(keyword => target.current_activity.toLowerCase().includes(keyword))) {
      importance += 4; // Boost emergency situations more
    }
    
    // Higher importance for people in same location
    if (observer.current_location === target.current_location) {
      importance += 2; // Boost same location interactions more
    }
    
    // SIGNIFICANTLY higher importance for social activities (triggers conversation initiation)
    const socialActivities = ['talk', 'convers', 'meet', 'gather', 'social', 'greet', 'chat'];
    if (socialActivities.some(keyword => target.current_activity.toLowerCase().includes(keyword))) {
      importance += 4; // Boosted from 2 to 4 to push social observations over threshold
    }

    // Higher importance for interesting work activities that warrant conversation
    const interestingActivities = ['craft', 'create', 'build', 'music', 'performance', 'teach', 'healing', 'baking', 'smithing'];
    if (interestingActivities.some(keyword => target.current_activity.toLowerCase().includes(keyword))) {
      importance += 2;
    }

    // Higher importance if observer and target are friends/have positive relationship
    if (this.areKnownToEachOther(observer, target)) {
      importance += 2;
    }
    
    return Math.min(importance, 9); // Cap at 9
  }

  /**
   * Check if two NPCs are known to each other (simple heuristic)
   */
  private areKnownToEachOther(observer: any, target: any): boolean {
    // Simple heuristic: NPCs in same location category are more likely to know each other
    const observerLocation = observer.current_location || '';
    const targetLocation = target.current_location || '';
    
    return observerLocation === targetLocation;
  }

  /**
   * Store observation as memory
   */
  private async storeObservation(observation: NPCObservation): Promise<void> {
    try {
      await this.memoryManager.storeObservation(
        observation.observerId,
        observation.description,
        observation.location,
        observation.targetId ? [observation.targetId] : [],
        [], // no players involved
        observation.importance
      );

      //console.log(`📝 [NPC_AWARENESS] ${observation.observerName} observed: ${observation.description}`);
    } catch (error) {
      console.error(`❌ [NPC_AWARENESS] Error storing observation:`, error);
    }
  }

  /**
   * Trigger thought based on observation
   */
  private async triggerObservationThought(observation: NPCObservation): Promise<void> {
    try {
      console.log(`💭 [NPC_AWARENESS] Triggering thought for ${observation.observerName}: ${observation.description}`);
      
      // For high-importance observations (8+), use post-conversation scheduling thoughts
      if (observation.importance >= 8) {
        console.log(`📅 [NPC_AWARENESS] High importance observation - triggering scheduling thoughts`);
        await this.thoughtSystem.triggerPostConversationThoughts(
          observation.observerId,
          `Observed: ${observation.description}`,
          300, // 5 minute duration estimate
          observation.importance
        );
      } 
      // For medium importance observations (6-7), check if they should trigger spontaneous conversations
      else if (observation.importance >= 6) {
        console.log(`💬 [NPC_AWARENESS] Medium importance observation - checking for conversation initiation`);
        
        // Check if this observation should trigger a spontaneous conversation
        if (this.shouldTriggerSpontaneousConversation(observation)) {
          console.log(`🗨️ [NPC_AWARENESS] Triggering spontaneous conversation thought for ${observation.observerName}`);
          
          await this.thoughtSystem.triggerSpontaneousThought(
            observation.observerId,
            'npc_observation',
            {
              targetId: observation.targetId,
              targetName: observation.targetName,
              activity: observation.description,
              observationType: observation.observationType,
              location: observation.location,
              conversationTrigger: true
            }
          );
        } else {
          console.log(`🧠 [NPC_AWARENESS] Medium importance observation - storing as memory only`);
        }
      }
    } catch (error) {
      console.error(`❌ [NPC_AWARENESS] Error triggering thought:`, error);
    }
  }

  /**
   * Determine if an observation should trigger a spontaneous conversation
   */
  private shouldTriggerSpontaneousConversation(observation: NPCObservation): boolean {
    // Social activities are prime conversation starters
    const socialTriggers = ['talk', 'convers', 'meet', 'gather', 'social', 'greet', 'chat'];
    if (socialTriggers.some(keyword => observation.description.toLowerCase().includes(keyword))) {
      return true;
    }

    // Interesting work activities can spark conversations
    const workTriggers = ['craft', 'create', 'build', 'music', 'performance', 'teach', 'healing', 'baking', 'smithing'];
    if (workTriggers.some(keyword => observation.description.toLowerCase().includes(keyword))) {
      return true;
    }

    // Emergency or unusual activities definitely warrant conversation
    const emergencyTriggers = ['emergency', 'urgent', 'crisis', 'celebration', 'fight', 'argument'];
    if (emergencyTriggers.some(keyword => observation.description.toLowerCase().includes(keyword))) {
      return true;
    }

    // NPCs in same location with high importance observations should talk more
    return observation.importance >= 7 && observation.observationType === 'npc_activity';
  }

  /**
   * Process NPC activity changes in real-time
   */
  private async processNPCActivityChange(activityData: any): Promise<void> {
    const { npcId, npcName, newActivity, location } = activityData;
    
    try {
      // Find nearby NPCs who can observe this change
      const nearbyNPCs = await this.findNearbyNPCs({
        id: npcId,
        current_location: location,
        current_x: null,
        current_y: null
      });

      for (const observer of nearbyNPCs) {
        const observation: NPCObservation = {
          observerId: observer.id,
          observerName: observer.name,
          observationType: 'npc_activity',
          targetId: npcId,
          targetName: npcName,
          location: location,
          description: `I noticed ${npcName} started ${newActivity}`,
          importance: 5,
          shouldTriggerThought: false // Don't trigger thoughts for routine activity changes
        };

        await this.storeObservation(observation);
      }
    } catch (error) {
      console.error(`❌ [NPC_AWARENESS] Error processing activity change:`, error);
    }
  }

  /**
   * Process player activity updates for continuous observation
   */
  private async processPlayerActivityObservation(activityData: any): Promise<void> {
    const { playerId, playerName, newActivity, location } = activityData;

    try {
      // Find nearby NPCs who can observe this change
      const nearbyNPCs = await this.findNearbyNPCs({
        id: playerId, // NPCs observing player activity
        current_location: location,
        current_x: null,
        current_y: null
      });

      for (const observer of nearbyNPCs) {
        const observation: NPCObservation = {
          observerId: observer.id,
          observerName: observer.name,
          observationType: 'npc_activity', // NPCs observing player activity
          targetId: playerId,
          targetName: playerName,
          location: location,
          description: `I noticed ${playerName} started ${newActivity}`,
          importance: 5,
          shouldTriggerThought: false // Don't trigger thoughts for routine activity changes
        };

        await this.storeObservation(observation);
      }
    } catch (error) {
      console.error(`❌ [NPC_AWARENESS] Error processing player activity observation:`, error);
    }
  }

  /**
   * Get awareness statistics
   */
  public async getAwarenessStats(): Promise<any> {
    try {
      const recentObservations = await this.pool.query(`
        SELECT agent_id, COUNT(*) as observation_count
        FROM agent_memories
        WHERE memory_type = 'observation'
        AND related_agents != '{}'
        AND timestamp >= NOW() - INTERVAL '1 hour'
        GROUP BY agent_id
        ORDER BY observation_count DESC
      `);

      return {
        activeObservers: recentObservations.rows.length,
        totalObservations: recentObservations.rows.reduce((sum: number, row: any) => sum + parseInt(row.observation_count), 0),
        topObservers: recentObservations.rows.slice(0, 5)
      };
    } catch (error) {
      console.error('❌ [NPC_AWARENESS] Error getting awareness stats:', error);
      return { activeObservers: 0, totalObservations: 0, topObservers: [] };
    }
  }
} 