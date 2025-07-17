/**
 * Plan Execution System
 * Handles executing agent plans and schedules at the correct times
 * Manages different types of actions and location-based activities
 */

import { GameTime } from './GameTime';
import { SpawnedAgent } from './AgentSpawner';
import { AgentState, WorkingData, MovementData } from './AgentStateMachine';
import { Point } from './Pathfinding';
import { Pool } from 'pg';

export interface ScheduledAction {
  agentId: string;
  time: string;
  action: string;
  description?: string;
  location?: string;
  duration?: number;
  priority: number;
  executedDay?: number;
}

export interface ActionResult {
  success: boolean;
  message: string;
  newState?: AgentState;
  duration?: number;
  newLocation?: string;
}

export interface GeneratedPlan {
  agent_id: string;
  plan_date: string;
  daily_goal: string;
  schedule: { [time: string]: string };
  reasoning: string;
  priority: number;
  created_at: Date;
}

export class PlanExecutor {
  private gameTime: GameTime;
  private scheduledActions: Map<string, ScheduledAction[]> = new Map();
  private locationMappings: Map<string, Point> = new Map();
  private actionProcessors: Map<string, (agent: SpawnedAgent, action: ScheduledAction) => Promise<ActionResult>> = new Map();
  private executionHistory: Map<string, ScheduledAction[]> = new Map();
  private lastDay: number = 1;
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.gameTime = GameTime.getInstance();
    this.pool = pool;
    this.setupActionProcessors();
    this.initializeLocationMappings();
  }

  /**
   * Load agent schedules and create scheduled actions
   */
  public async loadAgentSchedules(agents: Map<string, SpawnedAgent>): Promise<void> {
    console.log('📅 Loading agent schedules...');
    
    for (const [agentId, agent] of agents) {
      // Always load static schedules first
      const staticSchedule = this.parseAgentSchedule(agent);
      
      // Try to load generated plans, but don't fail if they don't exist
      const generatedSchedule = await this.loadGeneratedPlan(agentId);
      
      // Use generated schedule if it exists, otherwise use static schedule
      const finalSchedule = generatedSchedule.length > 0 
        ? this.combineSchedules(staticSchedule, generatedSchedule)
        : staticSchedule;
      
      if (finalSchedule.length > 0) {
        this.scheduledActions.set(agentId, finalSchedule);
        
        if (generatedSchedule.length > 0) {
          console.log(`✅ Loaded ${finalSchedule.length} actions for ${agent.data.name} (${generatedSchedule.length} generated + ${staticSchedule.length} static)`);
          console.log(`📋 [SCHEDULE] Using generated plan for ${agent.data.name} with ${generatedSchedule.length} planned activities`);
        } else {
          console.log(`✅ Loaded ${finalSchedule.length} static actions for ${agent.data.name}`);
        }
      }
    }
    
    console.log(`🎯 Total scheduled actions loaded: ${this.getTotalScheduledActions()}`);
  }

  /**
   * Process scheduled actions for current time
   */
  public async processScheduledActions(agents: Map<string, SpawnedAgent>): Promise<void> {
    const currentTime = this.gameTime.getCurrentTimeString();
    const currentDay = this.gameTime.getCurrentDay();
    
    // Check if it's a new day and reset execution history
    if (currentDay !== this.lastDay) {
      console.log(`📅 [SCHEDULE] New day started (Day ${currentDay}), clearing execution history`);
      this.executionHistory.clear();
      this.lastDay = currentDay;
    }
    
    // Log processing attempt occasionally
    if (Math.random() < 0.05) { // 5% chance
      console.log(`⏰ [SCHEDULE] Processing scheduled actions for time: ${currentTime}`);
      console.log(`📋 [SCHEDULE] Total agents with schedules: ${this.scheduledActions.size}`);
    }
    
    for (const [agentId, actions] of this.scheduledActions) {
      const agent = agents.get(agentId);
      if (!agent) continue;
      
      // Find actions that should be executed now
      const actionsToExecute = actions.filter(action => 
        this.gameTime.isTime(action.time) && 
        !this.wasActionExecutedToday(agentId, action)
      );
      
      // Check for emergency actions that should execute immediately regardless of time
      const emergencyActions = actions.filter(action => 
        action.priority >= 10 && 
        !this.wasActionExecutedToday(agentId, action) &&
        (action.time === 'NOW' || this.gameTime.isTime(action.time))
      );
      
      // Combine regular and emergency actions
      const allActionsToExecute = [...actionsToExecute, ...emergencyActions];
      
      // Sort by priority (higher priority first)
      allActionsToExecute.sort((a, b) => b.priority - a.priority);
      
      // Execute the highest priority action
      if (allActionsToExecute.length > 0) {
        const actionToExecute = allActionsToExecute[0];
        
        // For emergency actions, force interruption of current activities
        if (actionToExecute.priority >= 10) {
          console.log(`🚨 [EMERGENCY] Executing emergency action for ${agent.data.name}: "${actionToExecute.action}" (priority: ${actionToExecute.priority})`);
          await this.executeEmergencyAction(agent, actionToExecute);
        } else {
          await this.executeAction(agent, actionToExecute);
        }
      }
    }
  }

  /**
   * Execute a specific action for an agent using the new activity system
   */
  public async executeAction(agent: SpawnedAgent, action: ScheduledAction): Promise<ActionResult> {
    // console.log(`🎬 [SCHEDULE] Executing action for ${agent.data.name}: "${action.action}" at ${action.time}`);
    
    try {
      // Check if agent is available for this action
      if (!this.isAgentAvailable(agent)) {
        return {
          success: false,
          message: `Agent ${agent.data.name} is not available for action: ${action.action}`
        };
      }
      
      // Use the new activity manager to handle the scheduled action
      // This will handle interruption if needed via interruptCurrent: true
      const activityResult = agent.activityManager.handleScheduledActivity(action.action, action.time, action.description);
      
      if (activityResult.success) {
        // Record execution
        this.recordActionExecution(agent.data.id, action);
        
        console.log(`✅ [SCHEDULE] ${agent.data.name} activity started: "${action.action}"`);
        
        return {
          success: true,
          message: `Scheduled activity started: ${action.action}`,
          newState: AgentState.WORKING,
          duration: action.duration
        };
      } else {
        console.log(`❌ [SCHEDULE] ${agent.data.name} failed to start activity: "${action.action}"`);
        return activityResult;
      }
    } catch (error) {
      console.error(`❌ [SCHEDULE] Error executing action for ${agent.data.name}:`, error);
      return {
        success: false,
        message: `Error executing action: ${error}`
      };
    }
  }

  /**
   * Execute an emergency action that forces interruption of current activities
   */
  public async executeEmergencyAction(agent: SpawnedAgent, action: ScheduledAction): Promise<ActionResult> {
    console.log(`🚨 [EMERGENCY] Executing emergency action for ${agent.data.name}: "${action.action}" (priority: ${action.priority})`);
    
    if (action.location) {
      console.log(`🚨 [EMERGENCY] Emergency location: ${action.location}`);
    }
    
    try {
      // Force interruption of current activity regardless of agent availability
      if (agent.activityManager.getCurrentActivity()) {
        console.log(`🚨 [EMERGENCY] Interrupting current activity for ${agent.data.name}`);
        agent.activityManager.completeCurrentActivity();
      }
      
      // Use the activity manager with forced interruption
      const activityResult = agent.activityManager.requestActivity({
        activityName: action.action,
        priority: action.priority,
        interruptCurrent: true, // Force interruption
        parameters: { 
          scheduledTime: action.time,
          emergency: true,
          reason: `Emergency action: ${action.action}`,
          emergencyLocation: action.location, // Pass emergency location
          customDescription: action.description // Pass detailed emergency description
        }
      });
      
      if (activityResult.success) {
        // Record execution
        this.recordActionExecution(agent.data.id, action);
        
        console.log(`✅ [EMERGENCY] ${agent.data.name} emergency activity started: "${action.action}"`);
        
        return {
          success: true,
          message: `Emergency activity started: ${action.action}`,
          newState: AgentState.WORKING,
          duration: action.duration
        };
      } else {
        console.log(`❌ [EMERGENCY] ${agent.data.name} failed to start emergency activity: "${action.action}"`);
        return activityResult;
      }
    } catch (error) {
      console.error(`❌ [EMERGENCY] Error executing emergency action for ${agent.data.name}:`, error);
      return {
        success: false,
        message: `Error executing emergency action: ${error}`
      };
    }
  }

  /**
   * Add a custom action for an agent
   */
  public addCustomAction(agentId: string, action: ScheduledAction): void {
    if (!this.scheduledActions.has(agentId)) {
      this.scheduledActions.set(agentId, []);
    }
    
    this.scheduledActions.get(agentId)!.push(action);
    console.log(`➕ Added custom action for agent ${agentId}: ${action.action} at ${action.time}`);
  }

  /**
   * Remove scheduled action
   */
  public removeScheduledAction(agentId: string, actionTime: string): void {
    const actions = this.scheduledActions.get(agentId);
    if (actions) {
      const index = actions.findIndex(a => a.time === actionTime);
      if (index !== -1) {
        actions.splice(index, 1);
        console.log(`➖ Removed scheduled action for agent ${agentId} at ${actionTime}`);
      }
    }
  }

  /**
   * Get next scheduled action for an agent
   */
  public getNextScheduledAction(agentId: string): ScheduledAction | null {
    const actions = this.scheduledActions.get(agentId);
    if (!actions || actions.length === 0) return null;
    
    const currentTime = this.gameTime.getCurrentTimeString();
    
    // Find next action after current time
    const futureActions = actions.filter(a => a.time > currentTime);
    if (futureActions.length > 0) {
      return futureActions.sort((a, b) => a.time.localeCompare(b.time))[0];
    }
    
    // If no future actions today, return first action of next day
    const sortedActions = actions.sort((a, b) => a.time.localeCompare(b.time));
    return sortedActions[0];
  }

  /**
   * Parse agent schedule from database data
   */
  private parseAgentSchedule(agent: SpawnedAgent): ScheduledAction[] {
    const schedule = agent.data.schedule as { [key: string]: string | { activity: string; description: string } };
    const actions: ScheduledAction[] = [];
    
    if (!schedule || typeof schedule !== 'object') {
      return actions;
    }
    
    for (const [time, activityData] of Object.entries(schedule)) {
      let activity: string;
      let description: string;
      
      // Handle both old format (string) and new format (object)
      if (typeof activityData === 'string') {
        activity = activityData;
        description = activityData;
      } else {
        activity = activityData.activity;
        description = activityData.description;
      }
      
      actions.push({
        agentId: agent.data.id,
        time: time,
        action: activity,
        description: description,
        location: this.extractLocationFromAction(description),
        duration: this.estimateActionDuration(description),
        priority: this.calculateActionPriority(description)
      });
    }
    
    return actions;
  }

  /**
   * Load generated plan for an agent from database
   */
  private async loadGeneratedPlan(agentId: string): Promise<ScheduledAction[]> {
    if (!this.pool) {
      return [];
    }
    
    try {
      const currentDay = this.gameTime.getCurrentDay();
      
      console.log(`📋 [PLAN_EXECUTOR] Searching for generated plan for agent ${agentId} on day ${currentDay}`);
      
      const result = await this.pool.query(
        `SELECT agent_id, goal, plan_steps, priority, created_at
         FROM agent_plans 
         WHERE agent_id = $1 
         AND plan_steps::text LIKE '%day_${currentDay}%'
         AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [agentId]
      );
      
      if (result.rows.length === 0) {
        console.log(`📋 [PLAN_EXECUTOR] No generated plan found for agent ${agentId} on day ${currentDay}`);
        return [];
      }
      
      const plan = result.rows[0];
      const planData = JSON.parse(plan.plan_steps[0]);
      
      // Handle both old format (just schedule) and new format (with plan_date)
      const schedule = planData.schedule || planData;
      const planDate = planData.plan_date || `day_${this.gameTime.getCurrentDay()}`;
      
      console.log(`📋 [PLAN_EXECUTOR] Loading generated plan for agent ${agentId}:`);
      console.log(`   🎯 Goal: ${plan.goal}`);
      console.log(`   📅 Plan Date: ${planDate}`);
      console.log(`   📅 Schedule:`);
      Object.entries(schedule).forEach(([time, activityData]) => {
        if (typeof activityData === 'string') {
          console.log(`     ${time}: ${activityData}`);
        } else {
          const activity = activityData as { activity: string; description: string };
          console.log(`     ${time}: ${activity.activity} - ${activity.description}`);
        }
      });
      console.log(`   📊 Priority: ${plan.priority}`);
      
      const scheduledActions = this.parseGeneratedSchedule(agentId, schedule, plan.priority);
      console.log(`📋 [PLAN_EXECUTOR] Generated ${scheduledActions.length} scheduled actions from plan`);
      
      return scheduledActions;
      
    } catch (error) {
      console.error(`❌ Error loading generated plan for ${agentId}:`, error);
      return [];
    }
  }

  /**
   * Parse generated schedule into ScheduledAction format
   */
  private parseGeneratedSchedule(agentId: string, schedule: { [time: string]: string | { activity: string; description: string; location?: string } }, priority: number): ScheduledAction[] {
    const actions: ScheduledAction[] = [];
    
    for (const [time, activityData] of Object.entries(schedule)) {
      let activity: string;
      let description: string;
      let location: string | undefined;
      
      // Handle both old format (string) and new format (object)
      if (typeof activityData === 'string') {
        activity = activityData;
        description = activityData;
        location = this.extractLocationFromAction(description);
      } else {
        activity = activityData.activity;
        description = activityData.description;
        location = activityData.location || this.extractLocationFromAction(description);
      }
      
      actions.push({
        agentId,
        time,
        action: activity,
        description: description,
        location,
        duration: this.estimateActionDuration(description),
        priority: priority + 1 // Generated plans have higher priority than static ones
      });
    }
    
    return actions;
  }

  /**
   * Combine static and generated schedules, prioritizing generated plans
   */
  private combineSchedules(staticSchedule: ScheduledAction[], generatedSchedule: ScheduledAction[]): ScheduledAction[] {
    if (generatedSchedule.length > 0) {
      // Use generated schedule as primary, fill gaps with static schedule
      const generatedTimes = new Set(generatedSchedule.map(action => action.time));
      const staticFiller = staticSchedule.filter(action => !generatedTimes.has(action.time));
      
      return [...generatedSchedule, ...staticFiller].sort((a, b) => a.time.localeCompare(b.time));
    }
    
    return staticSchedule;
  }

  /**
   * Reload schedules for all agents (useful after new plans are generated)
   */
  public async reloadSchedules(agents: Map<string, SpawnedAgent>): Promise<void> {
    console.log('📅 Reloading agent schedules with new plans...');
    this.scheduledActions.clear();
    await this.loadAgentSchedules(agents);
  }

  /**
   * Reload schedules for a specific agent (useful for emergency plans)
   */
  public async reloadAgentSchedule(agentId: string, agents: Map<string, SpawnedAgent>): Promise<void> {
    const agent = agents.get(agentId);
    if (!agent) {
      console.error(`❌ [SCHEDULE] Agent ${agentId} not found for schedule reload`);
      return;
    }

    console.log(`📅 Reloading schedule for agent ${agent.data.name}...`);
    
    // Clear existing schedule for this agent
    this.scheduledActions.delete(agentId);
    
    // Load fresh schedule
    const staticSchedule = this.parseAgentSchedule(agent);
    const generatedSchedule = await this.loadGeneratedPlan(agentId);
    
    const finalSchedule = generatedSchedule.length > 0 
      ? this.combineSchedules(staticSchedule, generatedSchedule)
      : staticSchedule;
    
    if (finalSchedule.length > 0) {
      this.scheduledActions.set(agentId, finalSchedule);
      console.log(`✅ [SCHEDULE] Reloaded ${finalSchedule.length} actions for ${agent.data.name}`);
      
      // Check for immediate emergency actions
      const emergencyActions = finalSchedule.filter(action => 
        action.priority >= 10 && 
        (action.time === 'NOW' || this.gameTime.isTime(action.time))
      );
      
      if (emergencyActions.length > 0) {
        console.log(`🚨 [EMERGENCY] Found ${emergencyActions.length} emergency actions for ${agent.data.name}`);
        // Execute the highest priority emergency action immediately
        const highestPriorityAction = emergencyActions.sort((a, b) => b.priority - a.priority)[0];
        await this.executeEmergencyAction(agent, highestPriorityAction);
      }
    }
  }

  /**
   * Extract location from action description
   */
  private extractLocationFromAction(action: string): string | undefined {
    const actionLower = action.toLowerCase();
    
    // Location patterns to match
    const locationPatterns = [
      { patterns: ['dj stage', 'dj', 'stage'], locationId: 'dj_stage' },
      { patterns: ['hospital', 'medical'], locationId: 'hospital' },
      { patterns: ['fire station', 'fire'], locationId: 'fire_station' },
      { patterns: ['police station', 'police'], locationId: 'police_station' },
      { patterns: ['town hall', 'hall'], locationId: 'town_hall' },
      { patterns: ['school', 'education'], locationId: 'school' },
      { patterns: ['church', 'chapel'], locationId: 'church' },
      { patterns: ['tavern', 'pub'], locationId: 'tavern' },
      { patterns: ['blacksmith', 'forge'], locationId: 'blacksmith_shop' },
      { patterns: ['bakery', 'bread'], locationId: 'bakery' },
      { patterns: ['lighthouse', 'beacon'], locationId: 'lighthouse' },
      { patterns: ['harbor', 'dock', 'pier'], locationId: 'fishing_dock' },
      { patterns: ['market', 'farmers'], locationId: 'farmers_market' },
      { patterns: ['gym', 'fitness'], locationId: 'gym' },
      { patterns: ['library', 'books'], locationId: 'library' },
      { patterns: ['cafe', 'coffee'], locationId: 'cafe' },
      { patterns: ['beach', 'shore'], locationId: 'beach' },
      { patterns: ['barn', 'stable'], locationId: 'barn' },
      { patterns: ['windmill', 'mill'], locationId: 'windmill' },
      { patterns: ['mansion', 'estate'], locationId: 'mansion' },
      { patterns: ['general store', 'store'], locationId: 'general_store' },
      { patterns: ['apothecary', 'pharmacy'], locationId: 'apothecary' },
      { patterns: ['tailor', 'sewing'], locationId: 'tailor_shop' },
      { patterns: ['woodworker', 'carpenter'], locationId: 'woodworker_shop' }
    ];
    
    // Check each pattern
    for (const locationPattern of locationPatterns) {
      for (const pattern of locationPattern.patterns) {
        if (actionLower.includes(pattern)) {
          return locationPattern.locationId;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Estimate action duration in milliseconds
   */
  private estimateActionDuration(action: string): number {
    const actionLower = action.toLowerCase();
    
    // Short actions (5-15 minutes)
    if (actionLower.includes('check') || actionLower.includes('brief')) {
      return 5 * 60 * 1000; // 5 minutes
    }
    
    // Medium actions (15-30 minutes)
    if (actionLower.includes('prepare') || actionLower.includes('clean')) {
      return 20 * 60 * 1000; // 20 minutes
    }
    
    // Long actions (30-60 minutes)
    if (actionLower.includes('work') || actionLower.includes('teach')) {
      return 45 * 60 * 1000; // 45 minutes
    }
    
    // Default duration
    return 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Calculate action priority
   */
  private calculateActionPriority(action: string): number {
    const actionLower = action.toLowerCase();
    
    // High priority actions
    if (actionLower.includes('emergency') || actionLower.includes('urgent')) {
      return 10;
    }
    
    // Medium priority actions
    if (actionLower.includes('work') || actionLower.includes('open')) {
      return 5;
    }
    
    // Low priority actions
    if (actionLower.includes('rest') || actionLower.includes('personal')) {
      return 1;
    }
    
    // Default priority
    return 3;
  }

  /**
   * Get action type from action description
   */
  private getActionType(action: string): string {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('work') || actionLower.includes('craft') || actionLower.includes('build')) {
      return 'work';
    }
    
    if (actionLower.includes('walk') || actionLower.includes('go to') || actionLower.includes('visit')) {
      return 'move';
    }
    
    if (actionLower.includes('eat') || actionLower.includes('meal') || actionLower.includes('lunch')) {
      return 'eat';
    }
    
    if (actionLower.includes('sleep') || actionLower.includes('rest')) {
      return 'sleep';
    }
    
    if (actionLower.includes('talk') || actionLower.includes('meet') || actionLower.includes('discuss')) {
      return 'interact';
    }
    
    return 'general';
  }

  /**
   * Check if agent is available for action
   */
  private isAgentAvailable(agent: SpawnedAgent): boolean {
    const currentState = agent.stateMachine.getState();
    
    // Agent is available if idle or if current action is interruptible
    return currentState === AgentState.IDLE || 
           currentState === AgentState.THINKING;
  }

  /**
   * Check if action was executed today
   */
  private wasActionExecutedToday(agentId: string, action: ScheduledAction): boolean {
    const todayExecutions = this.executionHistory.get(agentId) || [];
    const currentDay = this.gameTime.getCurrentDay();
    
    // Check if this action was executed today
    return todayExecutions.some(executed => 
      executed.time === action.time && 
      executed.action === action.action &&
      executed.executedDay === currentDay
    );
  }

  /**
   * Record action execution
   */
  private recordActionExecution(agentId: string, action: ScheduledAction): void {
    if (!this.executionHistory.has(agentId)) {
      this.executionHistory.set(agentId, []);
    }
    
    this.executionHistory.get(agentId)!.push({
      ...action,
      executedDay: this.gameTime.getCurrentDay()
    });
  }

  /**
   * Setup action processors
   */
  private setupActionProcessors(): void {
    // Work action processor
    this.actionProcessors.set('work', async (agent: SpawnedAgent, action: ScheduledAction) => {
      const workData: WorkingData = {
        activity: action.action,
        location: action.location || agent.schema.currentLocation,
        duration: action.duration || 30 * 60 * 1000,
        progress: 0
      };
      
      const success = agent.stateMachine.transitionTo(AgentState.WORKING, workData);
      
      return {
        success,
        message: success ? `Started working: ${action.action}` : 'Failed to start work',
        newState: success ? AgentState.WORKING : undefined,
        duration: action.duration
      };
    });
    
    // Move action processor
    this.actionProcessors.set('move', async (agent: SpawnedAgent, action: ScheduledAction) => {
      const targetLocation = action.location || this.extractLocationFromAction(action.action);
      
      if (!targetLocation) {
        return {
          success: false,
          message: 'No target location specified for movement'
        };
      }
      
      const targetPosition = this.locationMappings.get(targetLocation);
      if (!targetPosition) {
        return {
          success: false,
          message: `Unknown location: ${targetLocation}`
        };
      }
      
      // Convert pixel coordinates to tile coordinates for pathfinding
      const mapManager = require('../maps/MapManager').MapManager.getInstance();
      const mapId = 'beacon_bay'; // Should match the map ID being used
      
      // Convert current position (pixel) to tile coordinates
      const currentTilePosRaw = mapManager.pixelToTile(mapId, agent.schema.x, agent.schema.y);
      const currentTilePos = { x: currentTilePosRaw.tileX, y: currentTilePosRaw.tileY };
      
      // Convert target position (pixel) to tile coordinates
      const targetTilePosRaw = mapManager.pixelToTile(mapId, targetPosition.x, targetPosition.y);
      const targetTilePos = { x: targetTilePosRaw.tileX, y: targetTilePosRaw.tileY };
      
      // Find path in tile coordinates
      const tilePath = agent.pathfinding.findPath(currentTilePos, targetTilePos);
      
      if (tilePath.length === 0) {
        return {
          success: false,
          message: 'No path found to target location'
        };
      }
      
      // Convert tile path back to pixel coordinates for movement
      const pixelPath = tilePath.map(tilePoint => {
        const pixelPoint = mapManager.tileToPixel(mapId, tilePoint.x, tilePoint.y);
        return { x: pixelPoint.pixelX, y: pixelPoint.pixelY };
      });
      
      const movementData: MovementData = {
        targetX: targetPosition.x,
        targetY: targetPosition.y,
        path: pixelPath,
        currentPathIndex: 0,
        speed: 1.0,
        startTime: Date.now(),
        estimatedArrival: Date.now() + (pixelPath.length * 1000)
      };
      
      const success = agent.stateMachine.transitionTo(AgentState.MOVING, movementData);
      
      return {
        success,
        message: success ? `Moving to ${targetLocation}` : 'Failed to start movement',
        newState: success ? AgentState.MOVING : undefined,
        newLocation: targetLocation
      };
    });
    
    // General action processor
    this.actionProcessors.set('general', async (agent: SpawnedAgent, action: ScheduledAction) => {
      // Set timeout for general actions
      if (action.duration) {
        agent.stateMachine.setTimeout(action.duration);
      }
      
      return {
        success: true,
        message: `Performing: ${action.action}`,
        duration: action.duration
      };
    });
    
    // Eating action processor
    this.actionProcessors.set('eat', async (agent: SpawnedAgent, action: ScheduledAction) => {
      const success = agent.stateMachine.transitionTo(AgentState.EATING, {
        activity: action.action,
        duration: action.duration || 15 * 60 * 1000
      });
      
      return {
        success,
        message: success ? `Started eating: ${action.action}` : 'Failed to start eating',
        newState: success ? AgentState.EATING : undefined
      };
    });
    
    // Sleep action processor
    this.actionProcessors.set('sleep', async (agent: SpawnedAgent, action: ScheduledAction) => {
      const success = agent.stateMachine.transitionTo(AgentState.SLEEPING, {
        duration: action.duration || 8 * 60 * 60 * 1000 // 8 hours
      });
      
      return {
        success,
        message: success ? 'Started sleeping' : 'Failed to start sleeping',
        newState: success ? AgentState.SLEEPING : undefined
      };
    });
    
    // Interaction action processor
    this.actionProcessors.set('interact', async (agent: SpawnedAgent, action: ScheduledAction) => {
      const success = agent.stateMachine.transitionTo(AgentState.INTERACTING, {
        activity: action.action,
        duration: action.duration || 20 * 60 * 1000
      });
      
      return {
        success,
        message: success ? `Started interaction: ${action.action}` : 'Failed to start interaction',
        newState: success ? AgentState.INTERACTING : undefined
      };
    });
  }

  /**
   * Initialize location mappings
   */
  private initializeLocationMappings(): void {
    // This would normally load from the same file as AgentSpawner
    // For now, we'll set up basic mappings
    this.locationMappings.set('shop', { x: 167, y: 86 });
    this.locationMappings.set('tavern', { x: 183, y: 105 });
    this.locationMappings.set('blacksmith', { x: 151, y: 85 });
    this.locationMappings.set('bakery', { x: 110, y: 103 });
    this.locationMappings.set('farm', { x: 30, y: 55 });
    this.locationMappings.set('harbor', { x: 200, y: 260 });
    this.locationMappings.set('market', { x: 80, y: 120 });
    this.locationMappings.set('church', { x: 193, y: 60 });
    this.locationMappings.set('school', { x: 214, y: 57 });
    this.locationMappings.set('hospital', { x: 170, y: 59 });
    this.locationMappings.set('library', { x: 177, y: 70 });
    this.locationMappings.set('gym', { x: 139, y: 105 });
    this.locationMappings.set('cafe', { x: 116, y: 99 });
  }

  /**
   * Get total scheduled actions count
   */
  private getTotalScheduledActions(): number {
    let total = 0;
    for (const actions of this.scheduledActions.values()) {
      total += actions.length;
    }
    return total;
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): object {
    return {
      totalScheduledActions: this.getTotalScheduledActions(),
      activeAgents: this.scheduledActions.size,
      locationMappings: this.locationMappings.size,
      currentTime: this.gameTime.getCurrentTimeString()
    };
  }
} 