/**
 * Game Time System
 * Tracks in-game time with configurable speed multiplier
 * Provides utilities for scheduling and time-based operations
 */

export interface GameTimeConfig {
  startTime: string; // "HH:MM" format
  speedMultiplier: number; // How fast game time moves (1.0 = real time, 60.0 = 1 minute = 1 second)
  dayDurationMs: number; // How long a game day lasts in real milliseconds
}

export interface TimeEvent {
  id: string;
  time: string; // "HH:MM" format
  callback: () => void;
  recurring: boolean;
  executed: boolean;
}

export class GameTime {
  private static instance: GameTime;
  private config: GameTimeConfig;
  private startRealTime: number;
  private gameStartTime: number; // Minutes since midnight
  private timeEvents: Map<string, TimeEvent> = new Map();
  private dayNumber: number = 1;
  private isRunning: boolean = false;

  private constructor(config: GameTimeConfig) {
    this.config = config;
    this.startRealTime = Date.now();
    this.gameStartTime = this.parseTime(config.startTime);
    this.isRunning = true;
  }

  public static getInstance(config?: GameTimeConfig): GameTime {
    if (!GameTime.instance) {
      if (!config) {
        throw new Error("GameTime must be initialized with config on first call");
      }
      GameTime.instance = new GameTime(config);
    }
    return GameTime.instance;
  }

  /**
   * Get current game time in minutes since midnight
   */
  public getCurrentTime(): number {
    if (!this.isRunning) return this.gameStartTime;
    
    const realTimePassed = Date.now() - this.startRealTime;
    const gameTimePassed = realTimePassed * this.config.speedMultiplier;
    const gameTimeMinutes = this.gameStartTime + (gameTimePassed / 60000); // Convert ms to minutes
    
    return gameTimeMinutes % 1440; // Wrap around at 24 hours (1440 minutes)
  }

  /**
   * Get current game time as formatted string
   */
  public getCurrentTimeString(): string {
    const minutes = this.getCurrentTime();
    return this.formatTime(minutes);
  }

  /**
   * Get current day number
   */
  public getCurrentDay(): number {
    const realTimePassed = Date.now() - this.startRealTime;
    const gameTimePassed = realTimePassed * this.config.speedMultiplier;
    const totalGameMinutes = this.gameStartTime + (gameTimePassed / 60000);
    
    return Math.floor(totalGameMinutes / 1440) + 1;
  }

  /**
   * Check if it's currently a specific time (within 1 minute tolerance)
   */
  public isTime(timeString: string): boolean {
    const targetTime = this.parseTime(timeString);
    const currentTime = this.getCurrentTime();
    
    // Check if within 1 minute tolerance (more precise for schedule execution)
    return Math.abs(currentTime - targetTime) < 1;
  }

  /**
   * Check if a time has passed since last check
   */
  public hasTimePassed(timeString: string): boolean {
    const targetTime = this.parseTime(timeString);
    const currentTime = this.getCurrentTime();
    
    return currentTime >= targetTime;
  }

  /**
   * Get minutes until a specific time
   */
  public getMinutesUntil(timeString: string): number {
    const targetTime = this.parseTime(timeString);
    const currentTime = this.getCurrentTime();
    
    let diff = targetTime - currentTime;
    if (diff < 0) {
      diff += 1440; // Next day
    }
    
    return diff;
  }

  /**
   * Schedule a time-based event
   */
  public scheduleEvent(id: string, time: string, callback: () => void, recurring: boolean = false): void {
    this.timeEvents.set(id, {
      id,
      time,
      callback,
      recurring,
      executed: false
    });
  }

  /**
   * Remove a scheduled event
   */
  public removeEvent(id: string): void {
    this.timeEvents.delete(id);
  }

  /**
   * Process time events (should be called regularly)
   */
  public processEvents(): void {
    const currentDay = this.getCurrentDay();
    
    for (const [id, event] of this.timeEvents) {
      if (!event.executed && this.isTime(event.time)) {
        // For recurring events, check if we already executed today
        if (event.recurring) {
          const lastExecutedKey = `${id}_last_executed`;
          const lastExecutedDay = (event as any)[lastExecutedKey];
          
          if (lastExecutedDay === currentDay) {
            // Already executed today, skip
            continue;
          }
          
          // Execute the event
          event.callback();
          
          // Mark as executed for this day
          (event as any)[lastExecutedKey] = currentDay;
        } else {
          // Non-recurring event
          event.callback();
          event.executed = true;
        }
      }
    }
    
    // Clean up non-recurring executed events
    for (const [id, event] of this.timeEvents) {
      if (event.executed && !event.recurring) {
        this.timeEvents.delete(id);
      }
    }
  }

  /**
   * Get all scheduled events
   */
  public getEvents(): TimeEvent[] {
    return Array.from(this.timeEvents.values());
  }

  /**
   * Parse time string to minutes since midnight
   */
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Format minutes since midnight to HH:MM string
   */
  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Get game time configuration
   */
  public getConfig(): GameTimeConfig {
    return { ...this.config };
  }

  /**
   * Update speed multiplier
   */
  public setSpeedMultiplier(multiplier: number): void {
    // Recalculate start time to maintain continuity
    const currentTime = this.getCurrentTime();
    this.config.speedMultiplier = multiplier;
    this.startRealTime = Date.now();
    this.gameStartTime = currentTime;
  }

  /**
   * Pause/resume game time
   */
  public pause(): void {
    if (this.isRunning) {
      this.gameStartTime = this.getCurrentTime();
      this.startRealTime = Date.now();
      this.isRunning = false;
    }
  }

  public resume(): void {
    if (!this.isRunning) {
      this.startRealTime = Date.now();
      this.isRunning = true;
    }
  }

  /**
   * Reset to a specific time
   */
  public setTime(timeString: string): void {
    this.gameStartTime = this.parseTime(timeString);
    this.startRealTime = Date.now();
    
    // Reset all events
    for (const event of this.timeEvents.values()) {
      event.executed = false;
    }
  }

  /**
   * Get debug info
   */
  public getDebugInfo(): object {
    return {
      currentTime: this.getCurrentTimeString(),
      currentDay: this.getCurrentDay(),
      speedMultiplier: this.config.speedMultiplier,
      isRunning: this.isRunning,
      scheduledEvents: this.timeEvents.size
    };
  }
} 