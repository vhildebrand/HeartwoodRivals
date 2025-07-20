/**
 * Activity System
 * Represents an individual activity that an agent performs
 * Manages the lifecycle of the activity as a state machine
 */

import { SpawnedAgent } from './AgentSpawner';
import { ActivityManifest, ActivityManifestEntry, ActivityType, MovementPattern, ActivityParameters } from './ActivityManifest';
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
  originalActivityName: string;   // The original activity name from schedule
  resolvedActivityName: string;   // The resolved/consolidated activity name
  activityName: string;           // For backward compatibility
  manifest: ActivityManifestEntry;
  parameters: ActivityParameters; // Merged parameters from legacy name + passed params
  startTime: number;
  endTime?: number;
  targetLocation?: LocationEntry;
  movementPath?: Point[];
  interactionTarget?: string;
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

  constructor(agent: SpawnedAgent, activityName: string, parameters?: ActivityParameters) {
    this.activityManifest = ActivityManifest.getInstance();
    this.locationRegistry = WorldLocationRegistry.getInstance();
    
    // Resolve the activity name through aliases
    const resolvedName = this.activityManifest.resolveActivityName(activityName);
    const manifest = this.activityManifest.getActivity(resolvedName);
    
    if (!manifest) {
      throw new Error(`Unknown activity: ${activityName} (resolved to: ${resolvedName})`);
    }
    
    this.manifest = manifest;
    this.state = ActivityState.PLANNING;
    this.stateStartTime = Date.now();
    
    // Merge parameters from legacy activity name with passed parameters
    const legacyParameters = this.activityManifest.createParametersFromLegacyName(activityName, resolvedName);
    const mergedParameters: ActivityParameters = {
      ...legacyParameters,
      ...parameters,
      // Passed parameters override legacy parameters
      ...(parameters || {})
    };
    
    this.context = {
      agent,
      originalActivityName: activityName,
      resolvedActivityName: resolvedName,
      activityName: resolvedName, // For backward compatibility
      manifest,
      parameters: mergedParameters,
      startTime: Date.now()
    };
    
    console.log(`🎭 [ACTIVITY] Created activity: ${activityName} → ${resolvedName} for agent ${agent.data.name}`);
    if (Object.keys(mergedParameters).length > 0) {
      console.log(`🎭 [ACTIVITY] Parameters:`, mergedParameters);
    }
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
      // Determine target location based on parameters and activity type
      let targetLocation: LocationEntry | null = null;
      
      // Check for emergency location override first
      if (this.context.parameters.emergencyLocation) {
        console.log(`🚨 [ACTIVITY] Emergency location override: ${this.context.parameters.emergencyLocation}`);
        targetLocation = this.locationRegistry.getLocation(this.context.parameters.emergencyLocation);
        if (targetLocation) {
          console.log(`🚨 [ACTIVITY] Found emergency location: ${targetLocation.displayName} at (${targetLocation.x}, ${targetLocation.y})`);
        } else {
          console.error(`❌ [ACTIVITY] Emergency location not found: ${this.context.parameters.emergencyLocation}`);
        }
      }
      
      // Check for specific location parameter (high priority)
      if (!targetLocation && this.context.parameters.specificLocation) {
        targetLocation = this.locationRegistry.getLocation(this.context.parameters.specificLocation);
        if (targetLocation) {
          //console.log(`🎯 [ACTIVITY] Using specific location: ${targetLocation.displayName} (${this.context.parameters.specificLocation})`);
        } else {
          console.warn(`⚠️ [ACTIVITY] Specific location not found: ${this.context.parameters.specificLocation}, falling back to generic search`);
        }
      }
      
      // Check for general location parameter
      if (!targetLocation && this.context.parameters.location) {
        targetLocation = this.locationRegistry.getLocation(this.context.parameters.location);
        if (targetLocation) {
          console.log(`📍 [ACTIVITY] Using parameter location: ${targetLocation.displayName}`);
        }
      }
      
      // Check for location tags in parameters
      if (!targetLocation && this.context.parameters.locationTags) {
        targetLocation = this.locationRegistry.findLocationForActivity(
          this.context.resolvedActivityName,
          this.context.parameters.locationTags,
          { x: this.context.agent.schema.x, y: this.context.agent.schema.y }
        );
        if (targetLocation) {
          console.log(`🏷️ [ACTIVITY] Found location by parameter tags: ${targetLocation.displayName}`);
        }
      }
      
      // Fall back to manifest defaults if no location found
      if (!targetLocation) {
        if (this.manifest.targetLocationId) {
          // Specific location ID provided
          targetLocation = this.locationRegistry.getLocation(this.manifest.targetLocationId);
        } else if (this.manifest.locationTags) {
          // Find location by tags
          targetLocation = this.locationRegistry.findLocationForActivity(
            this.context.resolvedActivityName,
            this.manifest.locationTags,
            { x: this.context.agent.schema.x, y: this.context.agent.schema.y }
          );
        }
      }
      
      if (!targetLocation && this.manifest.activityType !== ActivityType.ROUTINE_MOVEMENT) {
        console.error(`❌ [ACTIVITY] No suitable location found for activity: ${this.context.resolvedActivityName}`);
        this.transitionToState(ActivityState.FAILED);
        return;
      }
      
      this.context.targetLocation = targetLocation || undefined;
      
      // Transition based on activity type
      switch (this.manifest.activityType) {
        case ActivityType.STATIONARY:
        case ActivityType.ADMINISTRATION:
        case ActivityType.CRAFTING:
        case ActivityType.MAINTENANCE:
        case ActivityType.OBSERVATION:
          if (targetLocation) {
            this.transitionToState(ActivityState.MOVING_TO_LOCATION);
          } else {
            this.transitionToState(ActivityState.FAILED);
          }
          break;
         
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
      //console.log(`🎯 [ACTIVITY] ${agent.data.name} arrived at ${targetLocation.displayName}`);
      
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
      const displayText = this.getDisplayText();
      agent.schema.currentActivity = displayText;
      
      // Update agent state based on activity type
      const targetState = this.getTargetAgentState();
      if (targetState && agent.stateMachine.getState() !== targetState) {
        agent.stateMachine.transitionTo(targetState, {
          activity: this.context.resolvedActivityName,
          duration: this.activityManifest.getDurationInMs(this.manifest.duration)
        });
      }
    }
    
    // Activities are now duration-controlled by schedule, not by timers
    // The activity continues until the schedule changes or it's interrupted
    // Update agent's current activity display
    const displayText = this.getDisplayText();
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
    
    if (distance < 3) {
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
    const displayText = this.getDisplayText();
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
    const displayText = this.getDisplayText();
    if (this.context.agent.schema.currentActivity !== displayText) {
      this.context.agent.schema.currentActivity = displayText;
    }
  }

  /**
   * Set up waypoints for routine movement
   */
  private setupRoutineMovement(): void {
    const agent = this.context.agent;
    
    // Get movement pattern from parameters first, then fall back to manifest
    const pattern = this.context.parameters.movementPattern || this.manifest.movementPattern;
    
    // If we have a target location, use that as the center for movement
    const centerPoint = this.context.targetLocation 
      ? this.locationRegistry.getLocationCenter(this.context.targetLocation)
      : { x: agent.schema.x, y: agent.schema.y };
    
    // Generate waypoints based on movement pattern
    switch (pattern) {
      case MovementPattern.PACE:
        this.setupPaceWaypoints(centerPoint);
        break;
      case MovementPattern.PATROL:
        this.setupPatrolWaypoints(centerPoint);
        break;
      case MovementPattern.WANDER:
        this.setupWanderWaypoints(centerPoint);
        break;
      case MovementPattern.CIRCLE:
        this.setupCircleWaypoints(centerPoint);
        break;
      case MovementPattern.LAPS:
        this.setupLapsWaypoints(centerPoint);
        break;
      case MovementPattern.PERIMETER:
        this.setupPerimeterWaypoints(centerPoint);
        break;
      case MovementPattern.ZIGZAG:
        this.setupZigzagWaypoints(centerPoint);
        break;
      default:
        console.error(`❌ [ACTIVITY] Unknown movement pattern: ${pattern}`);
        this.transitionToState(ActivityState.FAILED);
    }
  }

  /**
   * Set up pacing waypoints (back and forth)
   */
  private setupPaceWaypoints(center: Point): void {
    const distance = 20;
    this.movementWaypoints = [
      { x: center.x - distance, y: center.y },
      { x: center.x + distance, y: center.y }
    ];
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up patrol waypoints
   */
  private setupPatrolWaypoints(center: Point): void {
    const size = 15;
    this.movementWaypoints = [
      { x: center.x - size, y: center.y - size },
      { x: center.x + size, y: center.y - size },
      { x: center.x + size, y: center.y + size },
      { x: center.x - size, y: center.y + size }
    ];
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up wander waypoints
   */
  private setupWanderWaypoints(center: Point): void {
    this.movementWaypoints = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const radius = 10 + Math.random() * 15;
      this.movementWaypoints.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
    }
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up circle waypoints
   */
  private setupCircleWaypoints(center: Point): void {
    const radius = 15;
    this.movementWaypoints = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.movementWaypoints.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
    }
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up laps waypoints (for running/jogging)
   */
  private setupLapsWaypoints(center: Point): void {
    const radiusX = 25;
    const radiusY = 15;
    this.movementWaypoints = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      this.movementWaypoints.push({
        x: center.x + Math.cos(angle) * radiusX,
        y: center.y + Math.sin(angle) * radiusY
      });
    }
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up perimeter waypoints
   */
  private setupPerimeterWaypoints(center: Point): void {
    if (this.context.targetLocation) {
      // Use the actual location bounds for perimeter
      const location = this.context.targetLocation;
      const halfWidth = (location.width || 40) / 2;
      const halfHeight = (location.height || 40) / 2;
      
      this.movementWaypoints = [
        { x: center.x - halfWidth, y: center.y - halfHeight },
        { x: center.x + halfWidth, y: center.y - halfHeight },
        { x: center.x + halfWidth, y: center.y + halfHeight },
        { x: center.x - halfWidth, y: center.y + halfHeight }
      ];
    } else {
      // Default rectangular perimeter
      const size = 20;
      this.movementWaypoints = [
        { x: center.x - size, y: center.y - size },
        { x: center.x + size, y: center.y - size },
        { x: center.x + size, y: center.y + size },
        { x: center.x - size, y: center.y + size }
      ];
    }
    this.currentWaypointIndex = 0;
  }

  /**
   * Set up zigzag waypoints
   */
  private setupZigzagWaypoints(center: Point): void {
    const width = 30;
    const height = 20;
    const steps = 6;
    
    this.movementWaypoints = [];
    for (let i = 0; i < steps; i++) {
      const y = center.y - height/2 + (height * i) / (steps - 1);
      const x = (i % 2 === 0) ? center.x - width/2 : center.x + width/2;
      this.movementWaypoints.push({ x, y });
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
        if (this.context.resolvedActivityName === 'work') {
          return AgentState.WORKING;
        }
        if (this.context.resolvedActivityName === 'eat') {
          return AgentState.EATING;
        }
        if (this.context.resolvedActivityName === 'sleep') {
          return AgentState.SLEEPING;
        }
        return AgentState.IDLE;
        
      case ActivityType.ADMINISTRATION:
      case ActivityType.CRAFTING:
        return AgentState.WORKING;
        
      case ActivityType.SOCIAL_INTERACTION:
        return AgentState.INTERACTING;
        
      case ActivityType.ROUTINE_MOVEMENT:
        return AgentState.MOVING;
        
      case ActivityType.MAINTENANCE:
        return AgentState.WORKING;
        
      case ActivityType.OBSERVATION:
        return AgentState.IDLE;
        
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
    console.log(`⚠️ [ACTIVITY] Interrupting activity: ${this.context.resolvedActivityName} for agent ${this.context.agent.data.name}`);
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
    console.log(`🔍 [DEBUG] Activity ${this.context.resolvedActivityName} state: ${this.state}, wasSuccessful: ${result}`);
    return result;
  }

  /**
   * Get the current state of this activity
   */
  public getState(): ActivityState {
    return this.state;
  }

  /**
   * Get the activity context
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
   * Get activity progress (0-1) - now schedule-based with accurate duration
   */
  public getProgress(): number {
    if (this.isComplete()) {
      return 1.0;
    }
    
    // Try to get the actual scheduled duration for this activity
    const scheduledDuration = this.getScheduledDurationMs();
    
    if (scheduledDuration > 0) {
      // Calculate progress based on actual scheduled time
      const runningTime = this.getDuration();
      const progress = Math.min(1.0, runningTime / scheduledDuration);
      
      // Debug log for progress calculation
      if (runningTime % 5000 < 100) { // Log every ~5 seconds to avoid spam
        console.log(`⏱️ [ACTIVITY] ${this.context.agent.data.name} progress: ${Math.round(progress * 100)}% (${Math.round(runningTime/1000)}s / ${Math.round(scheduledDuration/1000)}s)`);
      }
      
      return progress;
    } else {
      // Fallback to time-based progress for activities without clear schedule duration
      const runningTime = this.getDuration();
      const fallbackDuration = 30 * 60 * 1000; // 30 minutes fallback
      return Math.min(1.0, runningTime / fallbackDuration);
    }
  }

  /**
   * Calculate the actual scheduled duration for this activity in milliseconds
   */
  private getScheduledDurationMs(): number {
    const scheduledTime = this.context.parameters.scheduledTime;
    if (!scheduledTime) {
      return 0; // No scheduled time available
    }
    
    const agent = this.context.agent;
    const schedule = agent.data.schedule as { [key: string]: any };
    
    if (!schedule || typeof schedule !== 'object') {
      return 0;
    }
    
    // Get all schedule times and sort them
    const scheduleTimes = Object.keys(schedule).sort((a, b) => {
      const [hoursA, minutesA] = a.split(':').map(Number);
      const [hoursB, minutesB] = b.split(':').map(Number);
      const timeA = hoursA * 60 + minutesA;
      const timeB = hoursB * 60 + minutesB;
      return timeA - timeB;
    });
    
    // Find the current activity's index
    const currentIndex = scheduleTimes.indexOf(scheduledTime);
    if (currentIndex === -1) {
      return 0;
    }
    
    // Find the next activity time
    const nextIndex = currentIndex + 1;
    let nextTime: string;
    
    if (nextIndex < scheduleTimes.length) {
      nextTime = scheduleTimes[nextIndex];
    } else {
      // If this is the last activity, assume it runs until midnight (24:00)
      nextTime = '24:00';
    }
    
    // Calculate duration between current and next time
    const [currentHours, currentMinutes] = scheduledTime.split(':').map(Number);
    const [nextHours, nextMinutes] = nextTime.split(':').map(Number);
    
    const currentTimeMinutes = currentHours * 60 + currentMinutes;
    const nextTimeMinutes = nextHours * 60 + nextMinutes;
    
    let durationMinutes = nextTimeMinutes - currentTimeMinutes;
    
    // Handle day wrap-around (e.g., 23:00 to 01:00 = 2 hours)
    if (durationMinutes <= 0) {
      durationMinutes += 24 * 60; // Add 24 hours
    }
    
    return durationMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Get the display text for this activity
   * Prioritizes rich descriptions from schedule over simple activity names
   */
  private getActivityDisplayText(): string {
    // Priority 1: Custom description from schedule parameters (highest priority)
    if (this.context.parameters.customDescription) {
      return this.context.parameters.customDescription;
    }
    
    // Priority 2: Description from location extraction
    if (this.context.parameters.description) {
      return this.context.parameters.description;
    }
    
    // Priority 3: Manifest description
    if (this.manifest.description) {
      return this.manifest.description;
    }
    
    // Priority 4: Resolved activity name (fallback)
    return this.context.resolvedActivityName;
  }

  /**
   * Get user-friendly display text for UI
   */
  public getDisplayText(): string {
    const baseDisplayText = this.getActivityDisplayText();
    
    // Show destination when moving to a location
    if (this.state === ActivityState.MOVING_TO_LOCATION) {
      const targetLocation = this.context.targetLocation;
      if (targetLocation) {
        return `Moving to ${targetLocation.displayName} for: ${baseDisplayText}`;
      } else {
        return `Moving for: ${baseDisplayText}`;
      }
    }
    
    // For other states, show the base activity text
    return baseDisplayText;
  }

  /**
   * Get detailed status for debug display
   */
  public getDetailedStatus(): string {
    const displayText = this.getActivityDisplayText();
    const progress = Math.round(this.getProgress() * 100);
    const state = this.getState();
    
    // Show destination when moving to a location
    if (state === ActivityState.MOVING_TO_LOCATION) {
      const targetLocation = this.context.targetLocation;
      if (targetLocation) {
        return `Moving to ${targetLocation.displayName} for: ${displayText}`;
      } else {
        return `Moving for: ${displayText}`;
      }
    }
    
    // Show detailed activity info
    const scheduledTime = this.context.parameters.scheduledTime;
    const timeInfo = scheduledTime ? ` (${scheduledTime})` : '';
    
    return `${displayText}${timeInfo} - ${progress}%`;
  }
} 