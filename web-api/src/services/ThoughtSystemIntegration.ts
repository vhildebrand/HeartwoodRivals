/**
 * Thought System Integration Service
 * Bridges the ThoughtSystem with existing Activity, Memory, Planning, and Conversation systems
 */

import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from './AgentMemoryManager';
import OpenAI from 'openai';

// Define types here since we can't import from game-server
export enum ThoughtType {
  IMMEDIATE_INTERRUPTION = 'IMMEDIATE_INTERRUPTION',
  SCHEDULED_ACTIVITY = 'SCHEDULED_ACTIVITY',
  GOAL_REFLECTION = 'GOAL_REFLECTION',
  PERSONALITY_CHANGE = 'PERSONALITY_CHANGE',
  PRE_RESPONSE_THINKING = 'PRE_RESPONSE_THINKING',
  TRUTH_EVALUATION = 'TRUTH_EVALUATION',
  RELATIONSHIP_THINKING = 'RELATIONSHIP_THINKING',
  SPONTANEOUS_CONVERSATION = 'SPONTANEOUS_CONVERSATION',
  INTERNAL_REFLECTION = 'INTERNAL_REFLECTION'
}

export interface ThoughtTrigger {
  type: 'external_event' | 'internal_reflection' | 'memory_association' | 'conversation' | 'observation' | 'time_based';
  data: any;
  importance: number;
  timestamp: number;
}

export interface ThoughtResult {
  thoughtType: ThoughtType;
  decision: string;
  action?: {
    type: 'immediate_activity' | 'schedule_activity' | 'modify_goals' | 'change_personality' | 'initiate_conversation' | 'none';
    details: any;
  };
  reasoning: string;
  importance: number;
  urgency: number;
  confidence: number;
}

export class ThoughtSystemIntegration {
  private pool: Pool;
  private redisClient: any;
  private subscriberClient: any;
  private memoryManager: AgentMemoryManager;
  private openai: OpenAI;

  constructor(
    pool: Pool,
    redisClient: any,
    memoryManager: AgentMemoryManager
  ) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.memoryManager = memoryManager;
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Create separate client for subscriptions
    this.subscriberClient = redisClient.duplicate();
    
    // Setup integration listeners (async)
    this.setupIntegrationListeners().catch(error => {
      console.error('❌ [THOUGHT_INTEGRATION] Failed to setup listeners:', error);
    });
    
    // Initialize daily thought limits for all agents
    this.initializeDailyLimits();
  }

  /**
   * Setup listeners for integration with existing systems
   */
  private async setupIntegrationListeners(): Promise<void> {
    try {
      // Connect the subscriber client
      await this.subscriberClient.connect();
      
      // Listen for immediate activity changes
      await this.subscriberClient.subscribe('immediate_activity_change', (message: string) => {
        this.handleImmediateActivityChange(JSON.parse(message));
      });

      // Listen for scheduled activities
      await this.subscriberClient.subscribe('schedule_activity', (message: string) => {
        this.handleScheduleActivity(JSON.parse(message));
      });

      // Listen for conversation initiation requests
      await this.subscriberClient.subscribe('initiate_conversation', (message: string) => {
        this.handleInitiateConversation(JSON.parse(message));
      });

      // Listen for player actions that might trigger thoughts
      await this.subscriberClient.subscribe('player_action', (message: string) => {
        this.handlePlayerAction(JSON.parse(message));
      });

      // Listen for memory storage that might trigger thoughts
      await this.subscriberClient.subscribe('memory_stored', (message: string) => {
        this.handleMemoryStoredEvent(JSON.parse(message));
      });

      console.log('🔗 [THOUGHT_INTEGRATION] Setup integration listeners');
    } catch (error) {
      console.error('❌ [THOUGHT_INTEGRATION] Error setting up listeners:', error);
    }
  }

  /**
   * Handle immediate activity change requests from thoughts
   */
  private async handleImmediateActivityChange(data: any): Promise<void> {
    const { agentId, activity, location, reason, priority } = data;
    
    console.log(`🚨 [THOUGHT_INTEGRATION] Executing immediate activity change for ${agentId}: ${activity}`);
    
    // Publish to game server for activity system
    await this.redisClient.publish('game_server_activity_change', JSON.stringify({
      agentId,
      activityName: activity,
      priority,
      interruptCurrent: true,
      parameters: {
        specificLocation: location,
        reason,
        thoughtTriggered: true,
        urgency: 'high'
      }
    }));
  }

  /**
   * Handle scheduled activity requests from thoughts
   */
  private async handleScheduleActivity(data: any): Promise<void> {
    const { agentId, activity, time, location, reason, priority } = data;
    
    console.log(`📅 [THOUGHT_INTEGRATION] Scheduling activity for ${agentId}: ${activity} at ${time}`);
    
    // Store in database as a scheduled action
    await this.pool.query(`
      INSERT INTO agent_schedules (agent_id, start_time, activity, location, priority, is_flexible)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [agentId, time, activity, location, priority]);
    
    // Notify planning system
    await this.redisClient.publish('planning_system_update', JSON.stringify({
      agentId,
      action: 'add_scheduled_activity',
      activity,
      time,
      location,
      priority,
      reason
    }));
  }

  /**
   * Handle conversation initiation requests from thoughts
   */
  private async handleInitiateConversation(data: any): Promise<void> {
    const { agentId, target, topic, approach, timing } = data;
    
    console.log(`💬 [THOUGHT_INTEGRATION] ${agentId} wants to initiate conversation with ${target}`);
    
    // Store conversation intention
    await this.pool.query(`
      INSERT INTO conversation_intentions (agent_id, target, topic, approach, timing, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [agentId, target, topic, approach, timing]);
    
    // For now, schedule it as a social activity
    await this.handleScheduleActivity({
      agentId,
      activity: 'initiate_conversation',
      time: timing === 'immediate' ? 'NOW' : timing,
      location: 'find_target',
      reason: `Initiate conversation with ${target} about ${topic}`,
      priority: 7
    });
  }

  /**
   * Handle player actions that might trigger NPC thoughts
   */
  private async handlePlayerAction(data: any): Promise<void> {
    const { playerId, actionType, location, details } = data;
    
    // Find nearby NPCs within 20 tiles for basic awareness
    const nearbyAgents = await this.findNearbyAgents(location, 20);
    
    // But only trigger LLM thoughts for agents within 10 tiles
    const thoughtTriggerRange = 10;
    
    for (const agent of nearbyAgents) {
      // Calculate distance to agent
      const distance = this.calculateDistanceToAgent(agent, location);
      
      // Determine if this action should trigger a thought
      const shouldTriggerThought = this.shouldPlayerActionTriggerThought(actionType, details);
      
      if (shouldTriggerThought && distance <= thoughtTriggerRange) {
        console.log(`🧠 [THOUGHT_INTEGRATION] Agent ${agent.id} within thought range (${distance.toFixed(1)} tiles) - triggering LLM thoughts`);
        
        const trigger: ThoughtTrigger = {
          type: 'external_event',
          data: {
            eventType: 'player_action',
            playerId,
            actionType,
            location,
            details
          },
          importance: this.calculatePlayerActionImportance(actionType, details),
          timestamp: Date.now()
        };
        
        await this.triggerThought(agent.id, trigger);
      } else if (shouldTriggerThought) {
        console.log(`💾 [THOUGHT_INTEGRATION] Agent ${agent.id} outside thought range (${distance.toFixed(1)} tiles) - no LLM thoughts`);
      }
    }
  }

  /**
   * Handle memory storage events that might trigger thoughts
   */
  private async handleMemoryStoredEvent(data: any): Promise<void> {
    const { agentId, memoryType, content, importance } = data;
    
    // High importance memories might trigger thoughts
    if (importance >= 7) {
      const trigger: ThoughtTrigger = {
        type: 'memory_association',
        data: {
          memoryType,
          content,
          importance
        },
        importance,
        timestamp: Date.now()
      };
      
      await this.triggerThought(agentId, trigger);
    }
  }

  /**
   * Trigger post-conversation scheduling thoughts (replaces pre-response thinking)
   */
  public async triggerPostConversationThoughts(agentId: string, conversationSummary: string, duration: number, importance: number = 5): Promise<void> {
    console.log(`📅 [THOUGHT_INTEGRATION] Triggering post-conversation thoughts for ${agentId}`);
    
    const trigger: ThoughtTrigger = {
      type: 'conversation',
      data: {
        conversationSummary,
        duration,
        importance,
        conversationType: 'post_conversation_scheduling'
      },
      importance,
      timestamp: Date.now()
    };
    
    await this.triggerThought(agentId, trigger);
  }

  /**
   * Trigger lightweight conversation thoughts (replacement for heavy metacognitive evaluation)
   */
  public async triggerConversationThoughts(agentId: string, playerId: string, playerMessage: string, npcResponse: string): Promise<void> {
    console.log(`💭 [THOUGHT_INTEGRATION] Triggering conversation thoughts for ${agentId}`);
    
    const trigger: ThoughtTrigger = {
      type: 'conversation',
      data: {
        playerId,
        playerMessage,
        npcResponse,
        conversationType: 'post_conversation_thoughts'
      },
      importance: 4, // Lower importance than relationship thinking
      timestamp: Date.now()
    };
    
    await this.triggerThought(agentId, trigger);
  }

  /**
   * Trigger truth evaluation for statements
   */
  public async triggerTruthEvaluation(agentId: string, statement: string, speaker: string): Promise<any> {
    console.log(`🔍 [THOUGHT_INTEGRATION] Triggering truth evaluation for ${agentId}: "${statement}"`);
    
    const trigger: ThoughtTrigger = {
      type: 'conversation',
      data: {
        statement,
        speaker,
        evaluationType: 'truth_evaluation'
      },
      importance: 5,
      timestamp: Date.now()
    };
    
    await this.triggerThought(agentId, trigger);
    
    return {
      evaluationTriggered: true,
      timestamp: Date.now()
    };
  }

  /**
   * Trigger relationship thinking
   */
  public async triggerRelationshipThinking(agentId: string, targetPerson: string, context: string): Promise<void> {
    console.log(`💕 [THOUGHT_INTEGRATION] Triggering relationship thinking for ${agentId} about ${targetPerson}`);
    
    const trigger: ThoughtTrigger = {
      type: 'internal_reflection',
      data: {
        relationshipTarget: targetPerson,
        context,
        thinkingType: 'relationship_evaluation'
      },
      importance: 6,
      timestamp: Date.now()
    };
    
    await this.triggerThought(agentId, trigger);
  }

  /**
   * Trigger spontaneous thoughts based on observations
   */
  public async triggerSpontaneousThought(agentId: string, observationType: string, observationData: any): Promise<void> {
    console.log(`💭 [THOUGHT_INTEGRATION] Triggering spontaneous thought for ${agentId}: ${observationType}`);
    
    const trigger: ThoughtTrigger = {
      type: 'observation',
      data: {
        observationType,
        observationData,
        spontaneous: true
      },
      importance: this.calculateObservationImportance(observationType, observationData),
      timestamp: Date.now()
    };
    
    await this.triggerThought(agentId, trigger);
  }

  /**
   * Find nearby agents for event processing
   */
  private async findNearbyAgents(location: string, radius: number): Promise<any[]> {
    // This would need integration with the actual agent positioning system
    // For now, return a simplified query
    const result = await this.pool.query(`
      SELECT id, name, current_location 
      FROM agents 
      WHERE current_location = $1 OR current_location LIKE $2
    `, [location, `%${location}%`]);
    
    return result.rows;
  }

  /**
   * Calculate distance between agent and location
   */
  private calculateDistanceToAgent(agent: any, location: string): number {
    // Parse location if it's in x,y format
    const coords = this.parseLocation(location);
    if (!coords) {
      return 15; // Default distance for named locations
    }
    
    // Get agent position (this would need to be implemented based on your agent structure)
    // For now, assume agents have x,y coordinates
    if (!agent.current_x || !agent.current_y) {
      return 15; // Default distance if no coordinates
    }
    
    return Math.sqrt(
      Math.pow(agent.current_x - coords.x, 2) + 
      Math.pow(agent.current_y - coords.y, 2)
    );
  }

  /**
   * Parse location string to coordinates
   */
  private parseLocation(location: string): { x: number; y: number } | null {
    const coords = location.split(',');
    if (coords.length === 2) {
      const x = parseInt(coords[0].trim(), 10);
      const y = parseInt(coords[1].trim(), 10);
      if (!isNaN(x) && !isNaN(y)) {
        return { x, y };
      }
    }
    return null;
  }

  /**
   * Determine if player action should trigger NPC thought
   */
  private shouldPlayerActionTriggerThought(actionType: string, details: any): boolean {
    const thoughtTriggeringActions = [
      'speech',
      'interaction',
      'aggressive_action',
      'helpful_action',
      'unusual_behavior',
      'emergency_action'
    ];
    
    return thoughtTriggeringActions.includes(actionType);
  }

  /**
   * Calculate importance of player action for thought triggering
   */
  private calculatePlayerActionImportance(actionType: string, details: any): number {
    switch (actionType) {
      case 'emergency_action':
        return 9;
      case 'aggressive_action':
        return 8;
      case 'helpful_action':
        return 7;
      case 'speech':
        return 6;
      case 'interaction':
        return 5;
      default:
        return 4;
    }
  }

  /**
   * Calculate importance of observation for thought triggering
   */
  private calculateObservationImportance(observationType: string, observationData: any): number {
    switch (observationType) {
      case 'emergency_situation':
        return 9;
      case 'conflict':
        return 8;
      case 'unusual_event':
        return 7;
      case 'social_interaction':
        return 6;
      case 'routine_activity':
        return 4;
      default:
        return 5;
    }
  }

  /**
   * Get thought system status
   */
  public getThoughtSystemStatus(): { active: boolean; integrationEnabled: boolean } {
    return {
      active: true,
      integrationEnabled: true
    };
  }

  /**
   * Initialize daily thought limits for all agents
   */
  private async initializeDailyLimits(): Promise<void> {
    try {
      // Insert default thought limits for all agents for today
      await this.pool.query(`
        INSERT INTO thought_limits (agent_id, date, personality_changes_count, goal_changes_count, spontaneous_conversations_count, total_thoughts_count)
        SELECT id, CURRENT_DATE, 0, 0, 0, 0 FROM agents
        ON CONFLICT (agent_id, date) DO NOTHING
      `);
      console.log('✅ Daily thought limits initialized');
    } catch (error) {
      console.error('❌ Error initializing daily thought limits:', error);
    }
  }

  /**
   * Trigger a thought process for an agent
   */
  public async triggerThought(agentId: string, trigger: ThoughtTrigger): Promise<void> {
    console.log(`🧠 [THOUGHT_INTEGRATION] Triggering unified thought for ${agentId}: ${trigger.type}`);
    
    try {
      // Use the unified thought processing endpoint
      const response = await fetch('http://localhost:3000/thought/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          eventType: trigger.type,
          eventData: trigger.data,
          importance: trigger.importance
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as any;
      console.log(`✅ [THOUGHT_INTEGRATION] Unified thought processed for ${agentId}:`, result.thoughtResult?.decision);
      
    } catch (error) {
      console.error(`❌ [THOUGHT_INTEGRATION] Error processing unified thought for ${agentId}:`, error);
      
      // Fallback: Store in database queue as backup
      await this.pool.query(`
        INSERT INTO thought_processing_queue (agent_id, queue_type, trigger_data, priority)
        VALUES ($1, $2, $3, $4)
      `, [agentId, trigger.type, trigger.data, trigger.importance]);
    }
  }

  /**
   * Shutdown integration service
   */
  public shutdown(): void {
    console.log('🔗 [THOUGHT_INTEGRATION] Shutdown complete');
  }
} 