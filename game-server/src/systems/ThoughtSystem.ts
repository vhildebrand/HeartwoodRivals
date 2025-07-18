/**
 * Unified Thought System
 * Manages all types of NPC thinking processes and decision-making
 * This system handles immediate interruption thoughts, scheduled thoughts, 
 * goal reflection, personality changes, and more
 */

import { SpawnedAgent } from './AgentSpawner';
import { AgentMemoryManager } from '../../web-api/src/services/AgentMemoryManager';
import { ActivityManager } from './ActivityManager';
import { PlanExecutor } from './PlanExecutor';
import { GameTime } from './GameTime';
import { createClient } from 'redis';
import { Pool } from 'pg';
import OpenAI from 'openai';

export enum ThoughtType {
  IMMEDIATE_INTERRUPTION = 'IMMEDIATE_INTERRUPTION',     // Thoughts that cause immediate action
  SCHEDULED_ACTIVITY = 'SCHEDULED_ACTIVITY',             // Thoughts that schedule future activities
  GOAL_REFLECTION = 'GOAL_REFLECTION',                   // Evening goal and priority evaluation
  PERSONALITY_CHANGE = 'PERSONALITY_CHANGE',             // Changes to likes, dislikes, traits
  PRE_RESPONSE_THINKING = 'PRE_RESPONSE_THINKING',       // Thinking before conversation responses
  TRUTH_EVALUATION = 'TRUTH_EVALUATION',                 // Evaluating statement believability
  RELATIONSHIP_THINKING = 'RELATIONSHIP_THINKING',       // Relationship evaluation and feelings
  SPONTANEOUS_CONVERSATION = 'SPONTANEOUS_CONVERSATION', // Initiating conversations
  INTERNAL_REFLECTION = 'INTERNAL_REFLECTION',           // Internal thoughts and observations
  CURIOSITY_DRIVEN = 'CURIOSITY_DRIVEN',                 // Thoughts driven by curiosity
  MEMORY_TRIGGERED = 'MEMORY_TRIGGERED'                  // Thoughts triggered by memories
}

export interface ThoughtTrigger {
  type: 'external_event' | 'internal_reflection' | 'memory_association' | 'conversation' | 'observation' | 'time_based' | 'goal_evaluation';
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

export interface ThoughtContext {
  agent: SpawnedAgent;
  trigger: ThoughtTrigger;
  recentMemories: any[];
  currentActivity: string;
  currentGoals: string[];
  personalityTraits: string[];
  likes: string[];
  dislikes: string[];
  relationships: any[];
  currentTime: string;
  currentLocation: string;
}

export class ThoughtSystem {
  private pool: Pool;
  private redisClient: any;
  private openai: OpenAI;
  private memoryManager: AgentMemoryManager;
  private gameTime: GameTime;
  
  // Thought processing queues
  private immediateThoughtQueue: Map<string, ThoughtTrigger[]> = new Map();
  private scheduledThoughtQueue: Map<string, ThoughtTrigger[]> = new Map();
  private eveningReflectionQueue: Set<string> = new Set();
  
  // Thought processing intervals
  private immediateThoughtInterval: NodeJS.Timeout;
  private scheduledThoughtInterval: NodeJS.Timeout;
  private eveningReflectionInterval: NodeJS.Timeout;
  
  // Configuration
  private config = {
    immediateThoughtProcessingInterval: 5000,     // 5 seconds
    scheduledThoughtProcessingInterval: 30000,    // 30 seconds
    eveningReflectionTime: '22:00',               // 10 PM
    maxThoughtsPerAgent: 10,
    thoughtImportanceThreshold: 5,
    urgencyThreshold: 7,
    maxDailyPersonalityChanges: 2,
    maxDailyGoalChanges: 1,
    maxDailySpontaneousConversations: 3
  };

  constructor(
    pool: Pool, 
    redisClient: any, 
    memoryManager: AgentMemoryManager,
    gameTime: GameTime
  ) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.memoryManager = memoryManager;
    this.gameTime = gameTime;
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.initializeThoughtProcessing();
  }

  /**
   * Initialize thought processing intervals
   */
  private initializeThoughtProcessing(): void {
    // Process immediate thoughts every 5 seconds
    this.immediateThoughtInterval = setInterval(() => {
      this.processImmediateThoughts();
    }, this.config.immediateThoughtProcessingInterval);
    
    // Process scheduled thoughts every 30 seconds
    this.scheduledThoughtInterval = setInterval(() => {
      this.processScheduledThoughts();
    }, this.config.scheduledThoughtProcessingInterval);
    
    // Check for evening reflection every minute
    this.eveningReflectionInterval = setInterval(() => {
      this.checkEveningReflection();
    }, 60000);
    
    console.log('🧠 [THOUGHT_SYSTEM] Initialized thought processing intervals');
  }

  /**
   * Trigger a thought process for an agent
   */
  public async triggerThought(agentId: string, trigger: ThoughtTrigger): Promise<void> {
    console.log(`🧠 [THOUGHT_SYSTEM] Triggering thought for ${agentId}: ${trigger.type}`);
    
    // Determine if this is an immediate or scheduled thought
    if (trigger.importance >= this.config.urgencyThreshold) {
      // Add to immediate thought queue
      if (!this.immediateThoughtQueue.has(agentId)) {
        this.immediateThoughtQueue.set(agentId, []);
      }
      this.immediateThoughtQueue.get(agentId)!.push(trigger);
      
      // Process immediately if very urgent
      if (trigger.importance >= 9) {
        await this.processAgentImmediateThought(agentId);
      }
    } else if (trigger.importance >= this.config.thoughtImportanceThreshold) {
      // Add to scheduled thought queue
      if (!this.scheduledThoughtQueue.has(agentId)) {
        this.scheduledThoughtQueue.set(agentId, []);
      }
      this.scheduledThoughtQueue.get(agentId)!.push(trigger);
    }
  }

  /**
   * Process immediate thoughts that may cause activity interruption
   */
  private async processImmediateThoughts(): Promise<void> {
    for (const [agentId, thoughts] of this.immediateThoughtQueue.entries()) {
      if (thoughts.length > 0) {
        await this.processAgentImmediateThought(agentId);
      }
    }
  }

  /**
   * Process immediate thoughts for a specific agent
   */
  private async processAgentImmediateThought(agentId: string): Promise<void> {
    const thoughts = this.immediateThoughtQueue.get(agentId);
    if (!thoughts || thoughts.length === 0) return;
    
    try {
      // Get the highest priority thought
      const highestPriorityThought = thoughts.reduce((max, thought) => 
        thought.importance > max.importance ? thought : max
      );
      
      // Process the thought
      const result = await this.processThought(agentId, highestPriorityThought);
      
      if (result && result.action) {
        await this.executeThoughtAction(agentId, result);
      }
      
      // Remove processed thought
      this.immediateThoughtQueue.set(agentId, thoughts.filter(t => t !== highestPriorityThought));
      
    } catch (error) {
      console.error(`❌ [THOUGHT_SYSTEM] Error processing immediate thought for ${agentId}:`, error);
    }
  }

  /**
   * Process scheduled thoughts that may schedule future activities
   */
  private async processScheduledThoughts(): Promise<void> {
    for (const [agentId, thoughts] of this.scheduledThoughtQueue.entries()) {
      if (thoughts.length > 0) {
        await this.processAgentScheduledThought(agentId);
      }
    }
  }

  /**
   * Process scheduled thoughts for a specific agent
   */
  private async processAgentScheduledThought(agentId: string): Promise<void> {
    const thoughts = this.scheduledThoughtQueue.get(agentId);
    if (!thoughts || thoughts.length === 0) return;
    
    try {
      // Process up to 3 thoughts at once
      const thoughtsToProcess = thoughts.slice(0, 3);
      
      for (const thought of thoughtsToProcess) {
        const result = await this.processThought(agentId, thought);
        
        if (result && result.action) {
          await this.executeThoughtAction(agentId, result);
        }
      }
      
      // Remove processed thoughts
      this.scheduledThoughtQueue.set(agentId, thoughts.slice(3));
      
    } catch (error) {
      console.error(`❌ [THOUGHT_SYSTEM] Error processing scheduled thought for ${agentId}:`, error);
    }
  }

  /**
   * Check if it's time for evening reflection
   */
  private async checkEveningReflection(): Promise<void> {
    const currentTime = this.gameTime.getCurrentTime();
    const currentHour = currentTime.split(':')[0];
    const targetHour = this.config.eveningReflectionTime.split(':')[0];
    
    if (currentHour === targetHour) {
      // Get all agents for evening reflection
      const agentsResult = await this.pool.query('SELECT id FROM agents');
      
      for (const agent of agentsResult.rows) {
        if (!this.eveningReflectionQueue.has(agent.id)) {
          this.eveningReflectionQueue.add(agent.id);
          await this.processEveningReflection(agent.id);
        }
      }
    }
    
    // Reset evening reflection queue at midnight
    if (currentHour === '00') {
      this.eveningReflectionQueue.clear();
    }
  }

  /**
   * Process evening goal reflection for an agent
   */
  private async processEveningReflection(agentId: string): Promise<void> {
    console.log(`🌙 [THOUGHT_SYSTEM] Processing evening reflection for ${agentId}`);
    
    try {
      const trigger: ThoughtTrigger = {
        type: 'time_based',
        data: { reflectionType: 'evening_goals' },
        importance: 8,
        timestamp: Date.now()
      };
      
      const result = await this.processThought(agentId, trigger);
      
      if (result && result.action) {
        await this.executeThoughtAction(agentId, result);
      }
      
    } catch (error) {
      console.error(`❌ [THOUGHT_SYSTEM] Error processing evening reflection for ${agentId}:`, error);
    }
  }

  /**
   * Main thought processing logic
   */
  private async processThought(agentId: string, trigger: ThoughtTrigger): Promise<ThoughtResult | null> {
    try {
      // Get thought context
      const context = await this.buildThoughtContext(agentId, trigger);
      
      // Determine thought type based on trigger
      const thoughtType = this.determineThoughtType(trigger);
      
      // Generate thought using LLM
      const result = await this.generateThought(context, thoughtType);
      
      // Store thought as memory
      await this.storeThoughtMemory(agentId, result);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [THOUGHT_SYSTEM] Error processing thought for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Build comprehensive context for thought processing
   */
  private async buildThoughtContext(agentId: string, trigger: ThoughtTrigger): Promise<ThoughtContext> {
    // Get agent data
    const agentResult = await this.pool.query(`
      SELECT id, name, constitution, primary_goal, secondary_goals, 
             personality_traits, likes, dislikes, current_location, current_activity
      FROM agents WHERE id = $1
    `, [agentId]);
    
    const agentData = agentResult.rows[0];
    
    // Get recent memories
    const recentMemories = await this.memoryManager.getContextualMemories(agentId, 'recent thoughts and activities', 10);
    
    // Get relationships
    const relationshipsResult = await this.pool.query(`
      SELECT * FROM agent_relationships WHERE agent_id = $1
    `, [agentId]);
    
    return {
      agent: agentData as any, // Will be properly typed
      trigger,
      recentMemories,
      currentActivity: agentData.current_activity,
      currentGoals: [agentData.primary_goal, ...(agentData.secondary_goals || [])],
      personalityTraits: agentData.personality_traits || [],
      likes: agentData.likes || [],
      dislikes: agentData.dislikes || [],
      relationships: relationshipsResult.rows,
      currentTime: this.gameTime.getCurrentTime(),
      currentLocation: agentData.current_location
    };
  }

  /**
   * Determine the type of thought based on trigger
   */
  private determineThoughtType(trigger: ThoughtTrigger): ThoughtType {
    switch (trigger.type) {
      case 'external_event':
        return trigger.importance >= 8 ? ThoughtType.IMMEDIATE_INTERRUPTION : ThoughtType.SCHEDULED_ACTIVITY;
      case 'conversation':
        return ThoughtType.PRE_RESPONSE_THINKING;
      case 'time_based':
        return trigger.data.reflectionType === 'evening_goals' ? ThoughtType.GOAL_REFLECTION : ThoughtType.INTERNAL_REFLECTION;
      case 'memory_association':
        return ThoughtType.MEMORY_TRIGGERED;
      default:
        return ThoughtType.INTERNAL_REFLECTION;
    }
  }

  /**
   * Generate thought using LLM
   */
  private async generateThought(context: ThoughtContext, thoughtType: ThoughtType): Promise<ThoughtResult> {
    const prompt = this.buildThoughtPrompt(context, thoughtType);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });
    
    const responseText = response.choices[0].message.content;
    
    // Parse the response
    try {
      const parsed = JSON.parse(responseText || '{}');
      return {
        thoughtType,
        decision: parsed.decision || 'No decision made',
        action: parsed.action || { type: 'none', details: {} },
        reasoning: parsed.reasoning || 'No reasoning provided',
        importance: parsed.importance || 5,
        urgency: parsed.urgency || 5,
        confidence: parsed.confidence || 5
      };
    } catch (error) {
      console.error('❌ [THOUGHT_SYSTEM] Error parsing LLM response:', error);
      return {
        thoughtType,
        decision: 'Unable to process thought',
        reasoning: 'Error in thought processing',
        importance: 3,
        urgency: 1,
        confidence: 1
      };
    }
  }

  /**
   * Build LLM prompt for thought generation
   */
  private buildThoughtPrompt(context: ThoughtContext, thoughtType: ThoughtType): string {
    const { agent, trigger, recentMemories, currentActivity, currentGoals } = context;
    
    const basePrompt = `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

CURRENT SITUATION:
- Current activity: ${currentActivity}
- Current location: ${context.currentLocation}
- Current time: ${context.currentTime}
- Current goals: ${currentGoals.join(', ')}

RECENT MEMORIES:
${recentMemories.map(m => `- ${m.content}`).join('\n')}

TRIGGER EVENT:
${JSON.stringify(trigger)}

THOUGHT TYPE: ${thoughtType}`;

    switch (thoughtType) {
      case ThoughtType.IMMEDIATE_INTERRUPTION:
        return basePrompt + `

IMMEDIATE INTERRUPTION THINKING:
Something has happened that might require you to immediately stop what you're doing and do something else instead. This could be:
- An urgent external event you witnessed
- Someone said something that requires immediate action
- An internal realization that something is more important than your current activity

Evaluate whether this situation requires immediate action. If so, what should you do right now?

Respond in JSON format:
{
  "decision": "Your decision about what to do",
  "action": {
    "type": "immediate_activity" | "none",
    "details": {
      "activity": "activity_name",
      "location": "location_if_needed",
      "reason": "why_this_is_urgent"
    }
  },
  "reasoning": "Your thought process",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      case ThoughtType.SCHEDULED_ACTIVITY:
        return basePrompt + `

SCHEDULED ACTIVITY THINKING:
Something has happened that makes you think you should schedule a future activity. This could be:
- Planning to meet someone later
- Remembering you need to do something
- Deciding to pursue an opportunity at a specific time

Should you schedule something for later? If so, what and when?

Respond in JSON format:
{
  "decision": "Your decision about what to schedule",
  "action": {
    "type": "schedule_activity" | "none",
    "details": {
      "activity": "activity_name",
      "time": "when_to_do_it",
      "location": "location_if_needed",
      "reason": "why_schedule_this"
    }
  },
  "reasoning": "Your thought process",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      case ThoughtType.GOAL_REFLECTION:
        return basePrompt + `

EVENING GOAL REFLECTION:
It's evening, and you're reflecting on your primary and secondary goals. Based on the day's events and your recent experiences:
- Are your current goals still the right priorities?
- Should you change your primary goal?
- Should you add, remove, or modify your secondary goals?
- What did you learn today that might change your priorities?

Respond in JSON format:
{
  "decision": "Your decision about goal changes",
  "action": {
    "type": "modify_goals" | "none",
    "details": {
      "primary_goal": "new_primary_goal_or_keep_current",
      "secondary_goals": ["list", "of", "secondary", "goals"],
      "changes_made": "what_changed_and_why"
    }
  },
  "reasoning": "Your thought process about your goals",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      case ThoughtType.PERSONALITY_CHANGE:
        return basePrompt + `

PERSONALITY CHANGE THINKING:
Based on recent experiences, you're reflecting on whether your personality, likes, or dislikes have changed. People evolve based on their experiences.

Consider:
- Have you discovered new things you like or dislike?
- Have your personality traits shifted based on recent events?
- Are there new interests or aversions you've developed?

Respond in JSON format:
{
  "decision": "Your decision about personality changes",
  "action": {
    "type": "change_personality" | "none",
    "details": {
      "new_likes": ["things", "you", "now", "like"],
      "new_dislikes": ["things", "you", "now", "dislike"],
      "trait_changes": ["personality", "trait", "modifications"],
      "reasons": "why_these_changes_occurred"
    }
  },
  "reasoning": "Your thought process about personality evolution",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      case ThoughtType.PRE_RESPONSE_THINKING:
        return basePrompt + `

PRE-RESPONSE THINKING:
Before responding to someone, you need to think about what they said and recall relevant information.

Consider:
- What relevant memories do you have about this person or topic?
- What's your relationship with this person?
- How should you respond based on your personality and memories?

Respond in JSON format:
{
  "decision": "Your thoughts about how to respond",
  "action": {
    "type": "none",
    "details": {}
  },
  "reasoning": "Your thought process and memory recall",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      case ThoughtType.TRUTH_EVALUATION:
        return basePrompt + `

TRUTH EVALUATION THINKING:
Someone has told you something, and you need to evaluate whether you believe it's true.

Consider:
- Does this align with what you know?
- Is this person trustworthy?
- Does this make sense given your experience?
- How confident are you in this assessment?

Respond in JSON format:
{
  "decision": "Whether you believe the statement",
  "action": {
    "type": "none",
    "details": {
      "believability": "how_much_you_believe_it_0_to_10",
      "reasoning": "why_you_believe_or_doubt_it"
    }
  },
  "reasoning": "Your evaluation process",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      case ThoughtType.RELATIONSHIP_THINKING:
        return basePrompt + `

RELATIONSHIP THINKING:
You're thinking about your relationship with someone specific.

Consider:
- How do you feel about this person?
- Where do you see this relationship going?
- Have your feelings changed recently?
- What do you want from this relationship?

Respond in JSON format:
{
  "decision": "Your thoughts about this relationship",
  "action": {
    "type": "none",
    "details": {
      "person": "who_you're_thinking_about",
      "feelings": "how_you_feel_about_them",
      "relationship_direction": "where_you_see_it_going",
      "desired_actions": "what_you_want_to_do_about_it"
    }
  },
  "reasoning": "Your relationship analysis",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      case ThoughtType.SPONTANEOUS_CONVERSATION:
        return basePrompt + `

SPONTANEOUS CONVERSATION THINKING:
You're considering initiating a conversation with someone.

Consider:
- Who do you want to talk to?
- What do you want to talk about?
- Why is this conversation important to you?
- When and where should you approach them?

Respond in JSON format:
{
  "decision": "Your decision about initiating conversation",
  "action": {
    "type": "initiate_conversation" | "none",
    "details": {
      "target": "who_to_talk_to",
      "topic": "what_to_discuss",
      "approach": "how_to_start_conversation",
      "timing": "when_to_do_it"
    }
  },
  "reasoning": "Why you want this conversation",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;

      default:
        return basePrompt + `

INTERNAL REFLECTION:
You're having an internal thought or reflection.

Consider what's on your mind and respond in JSON format:
{
  "decision": "Your internal thought",
  "action": {
    "type": "none",
    "details": {}
  },
  "reasoning": "Your thought process",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
    }
  }

  /**
   * Execute the action determined by a thought
   */
  private async executeThoughtAction(agentId: string, result: ThoughtResult): Promise<void> {
    console.log(`🧠 [THOUGHT_SYSTEM] Executing thought action for ${agentId}: ${result.action?.type}`);
    
    if (!result.action || result.action.type === 'none') {
      return;
    }
    
    switch (result.action.type) {
      case 'immediate_activity':
        await this.executeImmediateActivity(agentId, result.action.details);
        break;
      case 'schedule_activity':
        await this.executeScheduleActivity(agentId, result.action.details);
        break;
      case 'modify_goals':
        await this.executeModifyGoals(agentId, result.action.details);
        break;
      case 'change_personality':
        await this.executeChangePersonality(agentId, result.action.details);
        break;
      case 'initiate_conversation':
        await this.executeInitiateConversation(agentId, result.action.details);
        break;
    }
  }

  /**
   * Execute immediate activity change
   */
  private async executeImmediateActivity(agentId: string, details: any): Promise<void> {
    console.log(`🚨 [THOUGHT_SYSTEM] ${agentId} interrupting current activity for: ${details.activity}`);
    
    // This would integrate with the existing activity system
    // For now, log the action - implementation depends on existing activity system
    await this.redisClient.publish('immediate_activity_change', JSON.stringify({
      agentId,
      activity: details.activity,
      location: details.location,
      reason: details.reason,
      priority: 10,
      timestamp: Date.now()
    }));
  }

  /**
   * Execute scheduled activity
   */
  private async executeScheduleActivity(agentId: string, details: any): Promise<void> {
    console.log(`📅 [THOUGHT_SYSTEM] ${agentId} scheduling activity: ${details.activity} at ${details.time}`);
    
    // This would integrate with the existing planning system
    await this.redisClient.publish('schedule_activity', JSON.stringify({
      agentId,
      activity: details.activity,
      time: details.time,
      location: details.location,
      reason: details.reason,
      priority: 7,
      timestamp: Date.now()
    }));
  }

  /**
   * Execute goal modifications
   */
  private async executeModifyGoals(agentId: string, details: any): Promise<void> {
    console.log(`🎯 [THOUGHT_SYSTEM] ${agentId} modifying goals: ${details.changes_made}`);
    
    // Update agent goals in database
    await this.pool.query(`
      UPDATE agents 
      SET primary_goal = $1, secondary_goals = $2, updated_at = NOW()
      WHERE id = $3
    `, [details.primary_goal, details.secondary_goals, agentId]);
  }

  /**
   * Execute personality changes
   */
  private async executeChangePersonality(agentId: string, details: any): Promise<void> {
    console.log(`🎭 [THOUGHT_SYSTEM] ${agentId} changing personality: ${details.reasons}`);
    
    // Get current personality data
    const currentResult = await this.pool.query(
      'SELECT likes, dislikes, personality_traits FROM agents WHERE id = $1',
      [agentId]
    );
    
    const current = currentResult.rows[0];
    
    // Merge with new preferences
    const newLikes = [...(current.likes || []), ...(details.new_likes || [])];
    const newDislikes = [...(current.dislikes || []), ...(details.new_dislikes || [])];
    const newTraits = [...(current.personality_traits || []), ...(details.trait_changes || [])];
    
    // Update agent personality
    await this.pool.query(`
      UPDATE agents 
      SET likes = $1, dislikes = $2, personality_traits = $3, updated_at = NOW()
      WHERE id = $4
    `, [newLikes, newDislikes, newTraits, agentId]);
  }

  /**
   * Execute conversation initiation
   */
  private async executeInitiateConversation(agentId: string, details: any): Promise<void> {
    console.log(`💬 [THOUGHT_SYSTEM] ${agentId} wants to initiate conversation with ${details.target}`);
    
    // This would integrate with the conversation system
    await this.redisClient.publish('initiate_conversation', JSON.stringify({
      agentId,
      target: details.target,
      topic: details.topic,
      approach: details.approach,
      timing: details.timing,
      timestamp: Date.now()
    }));
  }

  /**
   * Store thought as memory
   */
  private async storeThoughtMemory(agentId: string, result: ThoughtResult): Promise<void> {
    await this.memoryManager.storeObservation(
      agentId,
      `I thought: ${result.decision} (${result.reasoning})`,
      'thought',
      [],
      [],
      result.importance
    );
  }

  /**
   * Clean up intervals on shutdown
   */
  public shutdown(): void {
    clearInterval(this.immediateThoughtInterval);
    clearInterval(this.scheduledThoughtInterval);
    clearInterval(this.eveningReflectionInterval);
    console.log('🧠 [THOUGHT_SYSTEM] Shutdown complete');
  }
} 