/**
 * Activity Manager System
 * Manages activities for individual agents
 * Integrates with existing agent systems and schedule processing
 */

import { SpawnedAgent } from './AgentSpawner';
import { Activity, ActivityState } from './Activity';
import { ActivityManifest, ActivityParameters } from './ActivityManifest';
import { WorldLocationRegistry } from './WorldLocationRegistry';
import { AgentState } from './AgentStateMachine';

export interface ActivityRequest {
  activityName: string;
  priority?: number;
  parameters?: ActivityParameters;
  interruptCurrent?: boolean;
}

export interface ActivityResult {
  success: boolean;
  message: string;
  activityId?: string;
  estimatedDuration?: number;
}

export class ActivityManager {
  private agent: SpawnedAgent;
  private currentActivity: Activity | null = null;
  private activityQueue: ActivityRequest[] = [];
  private activityManifest: ActivityManifest;
  private locationRegistry: WorldLocationRegistry;
  private activityHistory: Activity[] = [];
  private maxHistorySize: number = 10;

  constructor(agent: SpawnedAgent) {
    this.agent = agent;
    this.activityManifest = ActivityManifest.getInstance();
    this.locationRegistry = WorldLocationRegistry.getInstance();
  }

  /**
   * Update the activity manager (called every tick)
   */
  public update(): void {
    // Update current activity if active
    if (this.currentActivity) {
      this.currentActivity.update();
      
      // Check if activity is complete
      if (this.currentActivity.isComplete()) {
        this.handleActivityCompletion();
      }
    }
    
    // Process activity queue if no current activity
    if (!this.currentActivity && this.activityQueue.length > 0) {
      this.processNextActivity();
    }
    
    // Update agent schema with rich display text for client display
    const currentDisplayText = this.getDisplayText();
    if (this.agent.schema.currentActivity !== currentDisplayText) {
      this.agent.schema.currentActivity = currentDisplayText;
    }
  }

  /**
   * Request a new activity for the agent
   */
  public requestActivity(request: ActivityRequest): ActivityResult {
    const resolvedName = this.activityManifest.resolveActivityName(request.activityName);
    console.log(`🎭 [ACTIVITY MANAGER] ${this.agent.data.name} requesting activity: ${request.activityName} → ${resolvedName}`);
    
    // Validate the activity exists
    const manifest = this.activityManifest.getActivity(resolvedName);
    if (!manifest) {
      return {
        success: false,
        message: `Unknown activity: ${request.activityName}`
      };
    }
    
    // Check if we should interrupt current activity
    if (this.currentActivity && request.interruptCurrent) {
      console.log(`⚠️ [ACTIVITY MANAGER] Interrupting current activity for ${this.agent.data.name}`);
      this.currentActivity.interrupt();
      this.handleActivityCompletion();
    }
    
    // Add to queue or start immediately
    if (this.currentActivity) {
      this.activityQueue.push(request);
      this.sortActivityQueue();
      return {
        success: true,
        message: `Activity queued: ${request.activityName}`,
        estimatedDuration: -1 // Duration determined by schedule
      };
    } else {
      return this.startActivity(request);
    }
  }

  /**
   * Start an activity immediately
   */
  private startActivity(request: ActivityRequest): ActivityResult {
    try {
      // Create merged parameters including legacy parameters
      const legacyParameters = this.activityManifest.createParametersFromLegacyName(
        request.activityName, 
        this.activityManifest.resolveActivityName(request.activityName)
      );
      
      // Merge parameters with request parameters taking precedence over legacy
      const mergedParameters: ActivityParameters = {
        ...legacyParameters,
        ...request.parameters,
        // Ensure request parameters override legacy parameters
        ...(request.parameters || {})
      };
      
      const activity = new Activity(this.agent, request.activityName, mergedParameters);
      this.currentActivity = activity;
      
      const resolvedName = this.activityManifest.resolveActivityName(request.activityName);
      console.log(`🎬 [ACTIVITY MANAGER] ${this.agent.data.name} starting activity: ${request.activityName} → ${resolvedName}`);
      
      return {
        success: true,
        message: `Started activity: ${request.activityName}`,
        activityId: activity.getContext().resolvedActivityName,
        estimatedDuration: -1 // Duration determined by schedule
      };
      
    } catch (error) {
      console.error(`❌ [ACTIVITY MANAGER] Error starting activity ${request.activityName}:`, error);
      return {
        success: false,
        message: `Failed to start activity: ${error}`
      };
    }
  }

  /**
   * Handle activity completion
   */
  private handleActivityCompletion(): void {
    if (!this.currentActivity) return;
    
    const activity = this.currentActivity;
    const context = activity.getContext();
    const wasSuccessful = activity.wasSuccessful();
    
    console.log(`🏁 [ACTIVITY MANAGER] ${this.agent.data.name} completed activity: ${context.originalActivityName} → ${context.resolvedActivityName} (${wasSuccessful ? 'SUCCESS' : 'FAILED'})`);
    
    // Add to history
    this.activityHistory.push(activity);
    if (this.activityHistory.length > this.maxHistorySize) {
      this.activityHistory.shift();
    }
    
    // Update agent state
    this.updateAgentAfterActivity(activity);
    
    // Clear current activity
    this.currentActivity = null;
    
    // Process any queued activities
    if (this.activityQueue.length > 0) {
      this.processNextActivity();
    } else {
      // No more activities, agent goes to idle
      this.agent.stateMachine.transitionTo(AgentState.IDLE);
      this.agent.schema.currentActivity = 'idle';
    }
  }

  /**
   * Process the next activity in queue
   */
  private processNextActivity(): void {
    if (this.activityQueue.length === 0) return;
    
    const nextRequest = this.activityQueue.shift()!;
    this.startActivity(nextRequest);
  }

  /**
   * Sort activity queue by priority
   */
  private sortActivityQueue(): void {
    this.activityQueue.sort((a, b) => {
      const priorityA = a.priority || 5;
      const priorityB = b.priority || 5;
      return priorityB - priorityA; // Higher priority first
    });
  }

  /**
   * Update agent state after activity completion
   */
  private updateAgentAfterActivity(activity: Activity): void {
    const context = activity.getContext();
    const manifest = context.manifest;
    
    // Apply mood impacts
    if (manifest.moodImpact) {
      // This would integrate with your mood system
      console.log(`😊 [ACTIVITY MANAGER] Mood impact for ${this.agent.data.name}:`, manifest.moodImpact);
    }
    
    // Update energy level
    if (manifest.requiredEnergy) {
      this.agent.schema.energyLevel = Math.max(0, this.agent.schema.energyLevel - manifest.requiredEnergy);
    }
    
    // Update current location if activity had a target location
    if (context.targetLocation) {
      this.agent.schema.currentLocation = context.targetLocation.id;
    }
    
    // Update last activity time
    this.agent.schema.lastUpdate = Date.now();
  }

  /**
   * Get current activity
   */
  public getCurrentActivity(): Activity | null {
    return this.currentActivity;
  }

  /**
   * Get activity queue
   */
  public getActivityQueue(): ActivityRequest[] {
    return [...this.activityQueue];
  }

  /**
   * Get activity history
   */
  public getActivityHistory(): Activity[] {
    return [...this.activityHistory];
  }

  /**
   * Cancel current activity
   */
  public cancelCurrentActivity(): boolean {
    if (this.currentActivity) {
      this.currentActivity.interrupt();
      return true;
    }
    return false;
  }

  /**
   * Clear activity queue
   */
  public clearQueue(): void {
    this.activityQueue = [];
  }

  /**
   * Get agent's current status
   */
  public getStatus(): string {
    if (this.currentActivity) {
      return this.currentActivity.getDetailedStatus();
    }
    
    if (this.activityQueue.length > 0) {
      return `Idle (${this.activityQueue.length} queued)`;
    }
    
    return 'Idle';
  }

  /**
   * Get simple display text for UI (shows rich descriptions)
   */
  public getDisplayText(): string {
    if (this.currentActivity) {
      return this.currentActivity.getDisplayText();
    }
    
    if (this.activityQueue.length > 0) {
      return `Idle (${this.activityQueue.length} queued)`;
    }
    
    return 'Idle';
  }

  /**
   * Check if agent is available for new activities
   */
  public isAvailable(): boolean {
    if (!this.currentActivity) return true;
    
    const manifest = this.currentActivity.getContext().manifest;
    return manifest.interruptible !== false;
  }

  /**
   * Get suggested activities for current context
   */
  public getSuggestedActivities(): string[] {
    const currentLocation = this.agent.schema.currentLocation;
    const currentEnergy = this.agent.schema.energyLevel;
    const currentMood = this.agent.schema.mood;
    
    const suggestions: string[] = [];
    
    // Get activities possible at current location
    if (currentLocation) {
      const locationActivities = this.activityManifest.getActivitiesForLocation(currentLocation);
      suggestions.push(...locationActivities);
    }
    
    // Filter by energy level
    const energyFiltered = suggestions.filter(activityName => {
      const manifest = this.activityManifest.getActivity(activityName);
      return !manifest?.requiredEnergy || manifest.requiredEnergy <= currentEnergy;
    });
    
    return energyFiltered;
  }

  /**
   * Handle scheduled activity from PlanExecutor
   */
  public handleScheduledActivity(activityName: string, scheduledTime: string, scheduledDescription?: string): ActivityResult {
    console.log(`📅 [ACTIVITY MANAGER] Scheduled activity for ${this.agent.data.name}: ${activityName} at ${scheduledTime}`);
    
    // Get the custom description - prioritize scheduledDescription parameter over schedule lookup
    const customDescription = scheduledDescription || this.getCustomDescriptionForActivity(activityName, scheduledTime);
    
    // Extract location information from the description if available
    const locationParameters = customDescription 
      ? this.activityManifest.extractLocationFromDescription(customDescription)
      : {};
    
    // Merge all parameters: legacy + location extraction + schedule description (highest priority)
    const parameters: ActivityParameters = {
      scheduledTime,
      ...locationParameters,
      // Schedule description should override location extraction descriptions
      ...(customDescription && { customDescription }),
      // Don't let location extraction override the schedule description
      ...(customDescription && { description: customDescription })
    };
    
    // Log location extraction results
    if (locationParameters.specificLocation) {
      console.log(`🎯 [ACTIVITY MANAGER] Extracted specific location: ${locationParameters.specificLocation} from "${customDescription}"`);
    } else if (locationParameters.locationTags) {
      console.log(`🏷️ [ACTIVITY MANAGER] Extracted location tags: ${locationParameters.locationTags.join(', ')} from "${customDescription}"`);
    }
    
    return this.requestActivity({
      activityName,
      priority: 8, // High priority for scheduled activities
      interruptCurrent: true,
      parameters
    });
  }

  /**
   * Get custom description for an activity from the agent's schedule
   */
  private getCustomDescriptionForActivity(activityName: string, scheduledTime: string): string | undefined {
    const schedule = this.agent.data.schedule as { [key: string]: string | { activity: string; description: string } };
    
    if (!schedule || typeof schedule !== 'object') {
      return undefined;
    }
    
    const scheduleEntry = schedule[scheduledTime];
    if (typeof scheduleEntry === 'object' && scheduleEntry.activity === activityName) {
      return scheduleEntry.description;
    }
    
    return undefined;
  }

  /**
   * Complete current activity (called by PlanExecutor when schedule changes)
   */
  public completeCurrentActivity(): void {
    if (this.currentActivity) {
      const context = this.currentActivity.getContext();
      console.log(`⏰ [ACTIVITY MANAGER] Completing current activity for ${this.agent.data.name}: ${context.originalActivityName} → ${context.resolvedActivityName}`);
      this.currentActivity.interrupt(); // This will trigger completion
    }
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): { [key: string]: any } {
    const currentActivity = this.currentActivity;
    return {
      agentId: this.agent.data.id,
      agentName: this.agent.data.name,
      currentActivity: currentActivity ? {
        originalName: currentActivity.getContext().originalActivityName,
        resolvedName: currentActivity.getContext().resolvedActivityName,
        displayText: currentActivity.getDisplayText(),
        detailedStatus: currentActivity.getDetailedStatus(),
        state: currentActivity.getState(),
        progress: currentActivity.getProgress(),
        progressPercent: Math.round(currentActivity.getProgress() * 100),
        duration: currentActivity.getDuration(),
        durationSeconds: Math.round(currentActivity.getDuration() / 1000),
        scheduledTime: currentActivity.getContext().parameters.scheduledTime,
        specificLocation: currentActivity.getContext().parameters.specificLocation,
        targetLocation: currentActivity.getContext().targetLocation?.displayName,
        parameters: currentActivity.getContext().parameters
      } : null,
      queueSize: this.activityQueue.length,
      nextQueuedActivity: this.activityQueue.length > 0 ? this.activityQueue[0].activityName : null,
      historySize: this.activityHistory.length,
      lastCompletedActivity: this.activityHistory.length > 0 ? {
        name: this.activityHistory[this.activityHistory.length - 1].getContext().originalActivityName,
        displayText: this.activityHistory[this.activityHistory.length - 1].getDisplayText(),
        wasSuccessful: this.activityHistory[this.activityHistory.length - 1].wasSuccessful()
      } : null,
      isAvailable: this.isAvailable(),
      status: this.getStatus(),
      suggestedActivities: this.getSuggestedActivities()
    };
  }
} 