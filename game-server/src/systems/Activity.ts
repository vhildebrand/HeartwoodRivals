/**
 * Activity System
 * Represents an individual activity that an agent performs
 * Manages the lifecycle of the activity as a state machine
 */

import { SpawnedAgent } from './AgentSpawner';
import { ActivityManifest, ActivityManifestEntry, ActivityType, MovementPattern } from './ActivityManifest';
import { WorldLocationRegistry, LocationEntry } from './WorldLocationRegistry';
import { AgentState } from './AgentStateMachine';
import { Point } from './Pathfinding';

export enum ActivityState {
  PLANNING = 'PLANNING',           // Determining location and requirements
  MOVING_TO_LOCATION = 'MOVING_TO_LOCATION', // Moving to the activity location
  PERFORMING_ACTION = 'PERFORMING_ACTION',   // Executing the main activity
  ROUTINE_MOVEMENT = 'ROUTINE_MOVEMENT',     // Following movement pattern
  SOCIAL_INTERACTION = 'SOCIAL_INTERACTION', // Interacting with others
  COMPLETED = 'COMPLETED',         // Activity finished successfully
  INTERRUPTED = 'INTERRUPTED',     // Activity was interrupted
  FAILED = 'FAILED'               // Activity failed to complete
}

export interface ActivityContext {
  agent: SpawnedAgent;
  activityName: string;
  manifest: ActivityManifestEntry;
  startTime: number;
  endTime?: number;
  targetLocation?: LocationEntry;
  movementPath?: Point[];
  interactionTarget?: string;
  parameters?: { [key: string]: any };
}

export class Activity {
  private state: ActivityState;
  private context: ActivityContext;
  private manifest: ActivityManifestEntry;
  private locationRegistry: WorldLocationRegistry;
  private activityManifest: ActivityManifest;
  private stateStartTime: number;
  private movementWaypoints: Point[] = [];
  private currentWaypointIndex: number = 0;
  private activityTimer?: NodeJS.Timeout;

  constructor(agent: SpawnedAgent, activityName: string, parameters?: { [key: string]: any }) {
    this.activityManifest = ActivityManifest.getInstance();
    this.locationRegistry = WorldLocationRegistry.getInstance();
    
    const manifest = this.activityManifest.getActivity(activityName);
    if (!manifest) {
      throw new Error(`Unknown activity: ${activityName}`);
    }
    
    this.manifest = manifest;
    this.state = ActivityState.PLANNING;
    this.stateStartTime = Date.now();
    
    this.context = {
      agent,
      activityName,
      manifest,
      startTime: Date.now(),
      parameters: parameters || {}
    };
    
    console.log(`🎭 [ACTIVITY] Created new activity: ${activityName} for agent ${agent.data.name}`);
  }

  /**
   * Update the activity state machine
   */
  public update(): void {
    const previousState = this.state;
    
    switch (this.state) {
      case ActivityState.PLANNING:
        this.updatePlanning();
        break;
      case ActivityState.MOVING_TO_LOCATION:
        this.updateMovingToLocation();
        break;
      case ActivityState.PERFORMING_ACTION:
        this.updatePerformingAction();
        break;
      case ActivityState.ROUTINE_MOVEMENT:
        this.updateRoutineMovement();
        break;
      case ActivityState.SOCIAL_INTERACTION:
        this.updateSocialInteraction();
        break;
    }
    
    // Log state changes
    if (this.state !== previousState) {
      console.log(`🎭 [ACTIVITY] ${this.context.agent.data.name} activity state: ${previousState} → ${this.state}`);
    }
  }

  /**
   * Update planning phase
   */
  private updatePlanning(): void {
    try {
      // Determine target location based on activity type
      let targetLocation: LocationEntry | null = null;
      
      // Check for emergency location override first
      if (this.context.parameters?.emergencyLocation) {
        console.log(`🚨 [ACTIVITY] Emergency location override: ${this.context.parameters.emergencyLocation}`);
        targetLocation = this.locationRegistry.getLocation(this.context.parameters.emergencyLocation);
        if (targetLocation) {
          console.log(`🚨 [ACTIVITY] Found emergency location: ${targetLocation.displayName} at (${targetLocation.x}, ${targetLocation.y})`);
        } else {
          console.error(`❌ [ACTIVITY] Emergency location not found: ${this.context.parameters.emergencyLocation}`);
        }
      }
      
      // Fall back to normal location selection if emergency location not found
      if (!targetLocation) {
        if (this.manifest.targetLocationId) {
          // Specific location ID provided
          targetLocation = this.locationRegistry.getLocation(this.manifest.targetLocationId);
        } else if (this.manifest.locationTags) {
          // Find location by tags
          targetLocation = this.locationRegistry.findLocationForActivity(
            this.context.activityName,
            this.manifest.locationTags,
            { x: this.context.agent.schema.x, y: this.context.agent.schema.y }
          );
        }
      }
      
      if (!targetLocation && this.manifest.activityType !== ActivityType.ROUTINE_MOVEMENT) {
        console.error(`❌ [ACTIVITY] No suitable location found for activity: ${this.context.activityName}`);
        this.transitionToState(ActivityState.FAILED);
        return;
      }
      
      this.context.targetLocation = targetLocation || undefined;
      
      // Transition based on activity type
      switch (this.manifest.activityType) {
        case ActivityType.STATIONARY:
        case ActivityType.ADMINISTRATION:
        case ActivityType.GOTO_LOCATION:
          if (targetLocation) {
            this.transitionToState(ActivityState.MOVING_TO_LOCATION);
          } else {
            this.transitionToState(ActivityState.FAILED);
          }
          break;
         
        case ActivityType.ROUTINE_MOVEMENT:
          this.setupRoutineMovement();
          this.transitionToState(ActivityState.ROUTINE_MOVEMENT);
          break;
          
        case ActivityType.SOCIAL_INTERACTION:
          if (targetLocation) {
            this.transitionToState(ActivityState.MOVING_TO_LOCATION);
          } else {
            this.transitionToState(ActivityState.SOCIAL_INTERACTION);
          }
          break;
          
        default:
          console.error(`❌ [ACTIVITY] Unknown activity type: ${this.manifest.activityType}`);
          this.transitionToState(ActivityState.FAILED);
      }
      
    } catch (error) {
      console.error(`❌ [ACTIVITY] Error in planning phase:`, error);
      this.transitionToState(ActivityState.FAILED);
    }
  }

  /**
   * Update moving to location phase
   */
  private updateMovingToLocation(): void {
    const agent = this.context.agent;
    const targetLocation = this.context.targetLocation;
    
    if (!targetLocation) {
      this.transitionToState(ActivityState.FAILED);
      return;
    }
    
    // Check if agent is already at or near the location
    const targetCenter = this.locationRegistry.getLocationCenter(targetLocation);
    const distance = Math.sqrt(
      Math.pow(agent.schema.x - targetCenter.x, 2) + 
      Math.pow(agent.schema.y - targetCenter.y, 2)
    );
    
    if (distance < 5) {
      // Agent has arrived at the location
      console.log(`🎯 [ACTIVITY] ${agent.data.name} arrived at ${targetLocation.displayName}`);
      
      // Transition to next phase based on activity type
      if (this.manifest.activityType === ActivityType.SOCIAL_INTERACTION) {
        this.transitionToState(ActivityState.SOCIAL_INTERACTION);
      } else if (this.manifest.activityType === ActivityType.GOTO_LOCATION) {
        this.transitionToState(ActivityState.COMPLETED);
      } else {
        this.transitionToState(ActivityState.PERFORMING_ACTION);
      }
      return;
    }
    
             // Check if agent is currently moving towards the location
    const currentState = agent.stateMachine.getState();
    if (currentState !== AgentState.MOVING) {
      // Use the AgentMovementSystem to start movement
      if (agent.movementSystem) {
        const success = agent.movementSystem.startMovement(agent, targetCenter.x, targetCenter.y);
        if (!success) {
          console.error(`❌ [ACTIVITY] Failed to start movement to ${targetLocation.displayName}`);
          this.transitionToState(ActivityState.FAILED);
        }
      } else {
        console.error(`❌ [ACTIVITY] No movement system available for agent ${agent.data.name}`);
        this.transitionToState(ActivityState.FAILED);
      }
    }
  }

  /**
   * Update performing action phase
   */
  private updatePerformingAction(): void {
    const agent = this.context.agent;
    
    // Set agent to appropriate state and animation
    if (this.manifest.animation) {
      // Play animation if specified
      const displayText = this.getActivityDisplayText();
      agent.schema.currentActivity = displayText;
      
      // Update agent state based on activity type
      const targetState = this.getTargetAgentState();
      if (targetState && agent.stateMachine.getState() !== targetState) {
        agent.stateMachine.transitionTo(targetState, {
          activity: this.context.activityName,
          duration: this.activityManifest.getDurationInMs(this.manifest.duration)
        });
      }
    }
    
    // Activities are now duration-controlled by schedule, not by timers
    // The activity continues until the schedule changes or it's interrupted
    // Update agent's current activity display
    const displayText = this.getActivityDisplayText();
    if (this.context.agent.schema.currentActivity !== displayText) {
      this.context.agent.schema.currentActivity = displayText;
    }
  }

  /**
   * Update routine movement phase
   */
  private updateRoutineMovement(): void {
    const agent = this.context.agent;
    
    // Check if we have waypoints set up
    if (this.movementWaypoints.length === 0) {
      console.error(`❌ [ACTIVITY] No waypoints set up for routine movement`);
      this.transitionToState(ActivityState.FAILED);
      return;
    }
    
    // Check if agent reached current waypoint
    const currentWaypoint = this.movementWaypoints[this.currentWaypointIndex];
    const distance = Math.sqrt(
      Math.pow(agent.schema.x - currentWaypoint.x, 2) + 
      Math.pow(agent.schema.y - currentWaypoint.y, 2)
    );
    
             if (distance < 2) {
      // Reached waypoint, move to next one
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.movementWaypoints.length;
      const nextWaypoint = this.movementWaypoints[this.currentWaypointIndex];
      
      // Use the AgentMovementSystem to start movement to next waypoint
      if (agent.movementSystem) {
        const success = agent.movementSystem.startMovement(agent, nextWaypoint.x, nextWaypoint.y);
        if (!success) {
          console.warn(`⚠️ [ACTIVITY] Failed to move to next waypoint for routine movement`);
        }
      } else {
        console.error(`❌ [ACTIVITY] No movement system available for routine movement`);
      }
    }
    
    // Activities are now duration-controlled by schedule, not by timers
    // The routine movement continues until the schedule changes or it's interrupted
    // Update agent's current activity display
    const displayText = this.getActivityDisplayText();
    if (this.context.agent.schema.currentActivity !== displayText) {
      this.context.agent.schema.currentActivity = displayText;
    }
  }

  /**
   * Update social interaction phase
   */
  private updateSocialInteraction(): void {
    // This would handle agent-to-agent or agent-to-player interactions
    // Activities are now duration-controlled by schedule, not by timers
    // Update agent's current activity display
    const displayText = this.getActivityDisplayText();
    if (this.context.agent.schema.currentActivity !== displayText) {
      this.context.agent.schema.currentActivity = displayText;
    }
  }

  /**
   * Set up waypoints for routine movement
   */
  private setupRoutineMovement(): void {
    const agent = this.context.agent;
    const pattern = this.manifest.movementPattern;
    
    // Generate waypoints based on movement pattern
    switch (pattern) {
      case MovementPattern.PACE:
        this.setupPaceWaypoints();
        break;
      case MovementPattern.PATROL:
        this.setupPatrolWaypoints();
        break;
      case MovementPattern.WANDER:
        this.setupWanderWaypoints();
        break;
      case MovementPattern.CIRCLE:
        this.setupCircleWaypoints();
        break;
      default:
        console.error(`❌ [ACTIVITY] Unknown movement pattern: ${pattern}`);
        this.transitionToState(ActivityState.FAILED);
    }
  }

  /**
   * Set up pacing waypoints (back and forth)
   */
  private setupPaceWaypoints(): void {
    const agent = this.context.agent;
    const startX = agent.schema.x;
    const startY = agent.schema.y;
    
    // Create a simple back-and-forth pattern
    this.movementWaypoints = [
      { x: startX - 20, y: startY },
      { x: startX + 20, y: startY },
      { x: startX, y: startY }
    ];
    
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up patrol waypoints
   */
  private setupPatrolWaypoints(): void {
    const agent = this.context.agent;
    const startX = agent.schema.x;
    const startY = agent.schema.y;
    
    // Create a rectangular patrol pattern
    this.movementWaypoints = [
      { x: startX - 15, y: startY - 15 },
      { x: startX + 15, y: startY - 15 },
      { x: startX + 15, y: startY + 15 },
      { x: startX - 15, y: startY + 15 }
    ];
    
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up wander waypoints
   */
  private setupWanderWaypoints(): void {
    const agent = this.context.agent;
    const startX = agent.schema.x;
    const startY = agent.schema.y;
    
    // Create random waypoints around the starting position
    this.movementWaypoints = [];
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5;
      const radius = 10 + Math.random() * 20;
      this.movementWaypoints.push({
        x: startX + Math.cos(angle) * radius,
        y: startY + Math.sin(angle) * radius
      });
    }
    
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up circle waypoints
   */
  private setupCircleWaypoints(): void {
    const agent = this.context.agent;
    const startX = agent.schema.x;
    const startY = agent.schema.y;
    const radius = 15;
    
    // Create circular waypoints
    this.movementWaypoints = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.movementWaypoints.push({
        x: startX + Math.cos(angle) * radius,
        y: startY + Math.sin(angle) * radius
      });
    }
    
    this.currentWaypointIndex = 0;
  }

  /**
   * Get appropriate agent state for activity
   */
  private getTargetAgentState(): AgentState | null {
    const activityType = this.manifest.activityType;
    
    switch (activityType) {
      case ActivityType.STATIONARY:
        if (this.context.activityName.includes('work') || this.context.activityName.includes('craft')) {
          return AgentState.WORKING;
        }
        if (this.context.activityName.includes('eat')) {
          return AgentState.EATING;
        }
        if (this.context.activityName.includes('sleep')) {
          return AgentState.SLEEPING;
        }
        return AgentState.IDLE;
        
      case ActivityType.ADMINISTRATION:
        return AgentState.WORKING;
        
      case ActivityType.SOCIAL_INTERACTION:
        return AgentState.INTERACTING;
        
      case ActivityType.ROUTINE_MOVEMENT:
        return AgentState.MOVING;
        
      default:
        return AgentState.IDLE;
    }
  }

  /**
   * Transition to a new state
   */
  private transitionToState(newState: ActivityState): void {
    this.state = newState;
    this.stateStartTime = Date.now();
    
    // Handle state-specific actions
    switch (newState) {
      case ActivityState.COMPLETED:
        this.cleanup();
        break;
      case ActivityState.FAILED:
      case ActivityState.INTERRUPTED:
        this.cleanup();
        break;
    }
  }

  /**
   * Clean up timers and resources
   */
  private cleanup(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = undefined;
    }
    
    // Set completion time
    this.context.endTime = Date.now();
  }

  /**
   * Interrupt the activity
   */
  public interrupt(): void {
    console.log(`⚠️ [ACTIVITY] Interrupting activity: ${this.context.activityName} for agent ${this.context.agent.data.name}`);
    this.transitionToState(ActivityState.INTERRUPTED);
  }

  /**
   * Check if activity is complete
   */
  public isComplete(): boolean {
    return this.state === ActivityState.COMPLETED || 
           this.state === ActivityState.FAILED || 
           this.state === ActivityState.INTERRUPTED;
  }

  /**
   * Check if activity was successful
   */
  public wasSuccessful(): boolean {
    const result = this.state === ActivityState.COMPLETED || 
                   this.state === ActivityState.INTERRUPTED;
    console.log(`🔍 [DEBUG] Activity ${this.context.activityName} state: ${this.state}, wasSuccessful: ${result}`);
    return result;
  }

  /**
   * Get activity state
   */
  public getState(): ActivityState {
    return this.state;
  }

  /**
   * Get activity context
   */
  public getContext(): ActivityContext {
    return this.context;
  }

  /**
   * Get activity duration so far
   */
  public getDuration(): number {
    return Date.now() - this.context.startTime;
  }

  /**
   * Get current state duration
   */
  public getStateDuration(): number {
    return Date.now() - this.stateStartTime;
  }

  /**
   * Get activity progress (0-1) - now schedule-based
   */
  public getProgress(): number {
    if (this.isComplete()) {
      return 1.0;
    }
    
    // Since activities are now schedule-based, we show partial progress
    // based on how long the activity has been running
    const runningTime = this.getDuration();
    const maxDisplayTime = 30 * 60 * 1000; // 30 minutes for display purposes
    
    return Math.min(1.0, runningTime / maxDisplayTime);
  }

  /**
   * Get the display text for this activity
   * Prioritizes custom description from schedule over manifest description
   */
  private getActivityDisplayText(): string {
    // Check if there's a custom description from the schedule
    const customDescription = this.context.parameters?.customDescription;
    if (customDescription && typeof customDescription === 'string') {
      return customDescription;
    }
    
    // Fall back to manifest description or activity name
    return this.manifest.description || this.context.activityName;
  }
} 