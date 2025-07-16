/**
 * Activity Manager System
 * Manages activities for individual agents
 * Integrates with existing agent systems and schedule processing
 */

import { SpawnedAgent } from './AgentSpawner';
import { Activity, ActivityState } from './Activity';
import { ActivityManifest } from './ActivityManifest';
import { WorldLocationRegistry } from './WorldLocationRegistry';
import { AgentState } from './AgentStateMachine';

export interface ActivityRequest {
  activityName: string;
  priority?: number;
  parameters?: { [key: string]: any };
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
    
    // Update agent schema with current status for debug display
    const currentStatus = this.getStatus();
    if (this.agent.schema.currentActivity !== currentStatus) {
      this.agent.schema.currentActivity = currentStatus;
    }
  }

  /**
   * Request a new activity for the agent
   */
  public requestActivity(request: ActivityRequest): ActivityResult {
    console.log(`🎭 [ACTIVITY MANAGER] ${this.agent.data.name} requesting activity: ${request.activityName}`);
    
    // Validate the activity exists
    const manifest = this.activityManifest.getActivity(request.activityName);
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
      const activity = new Activity(this.agent, request.activityName, request.parameters);
      this.currentActivity = activity;
      
      const manifest = this.activityManifest.getActivity(request.activityName);
      
      console.log(`🎬 [ACTIVITY MANAGER] ${this.agent.data.name} starting activity: ${request.activityName}`);
      
      return {
        success: true,
        message: `Started activity: ${request.activityName}`,
        activityId: activity.getContext().activityName,
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
    
    console.log(`🏁 [ACTIVITY MANAGER] ${this.agent.data.name} completed activity: ${context.activityName} (${wasSuccessful ? 'SUCCESS' : 'FAILED'})`);
    
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
      const activity = this.currentActivity;
      const activityName = activity.getContext().activityName;
      const state = activity.getState();
      const progress = Math.round(activity.getProgress() * 100);
      
      // Show destination when moving to a location
      if (state === 'MOVING_TO_LOCATION') {
        const targetLocation = activity.getContext().targetLocation;
        if (targetLocation) {
          return `Moving to ${targetLocation.displayName}`;
        } else {
          return `Moving to location`;
        }
      }
      
      // Show current activity with progress
      return `${activityName} (${progress}%)`;
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
  public handleScheduledActivity(activityName: string, scheduledTime: string): ActivityResult {
    console.log(`📅 [ACTIVITY MANAGER] Scheduled activity for ${this.agent.data.name}: ${activityName} at ${scheduledTime}`);
    
    // Get the custom description for this activity from the agent's schedule
    const customDescription = this.getCustomDescriptionForActivity(activityName, scheduledTime);
    
    return this.requestActivity({
      activityName,
      priority: 8, // High priority for scheduled activities
      interruptCurrent: true,
      parameters: { 
        scheduledTime,
        customDescription 
      }
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
      console.log(`⏰ [ACTIVITY MANAGER] Completing current activity for ${this.agent.data.name}: ${this.currentActivity.getContext().activityName}`);
      this.currentActivity.interrupt(); // This will trigger completion
    }
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): { [key: string]: any } {
    return {
      agentId: this.agent.data.id,
      agentName: this.agent.data.name,
      currentActivity: this.currentActivity ? {
        name: this.currentActivity.getContext().activityName,
        state: this.currentActivity.getState(),
        progress: this.currentActivity.getProgress(),
        duration: this.currentActivity.getDuration()
      } : null,
      queueSize: this.activityQueue.length,
      historySize: this.activityHistory.length,
      isAvailable: this.isAvailable(),
      status: this.getStatus(),
      suggestedActivities: this.getSuggestedActivities()
    };
  }
} 