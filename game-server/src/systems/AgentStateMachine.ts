/**
 * Agent State Machine System
 * Manages agent states and transitions between them
 * Handles state persistence and timing
 */

import { Point } from './Pathfinding';

export enum AgentState {
  IDLE = 'idle',
  MOVING = 'moving',
  WORKING = 'working',
  INTERACTING = 'interacting',
  SLEEPING = 'sleeping',
  EATING = 'eating',
  TALKING = 'talking',
  THINKING = 'thinking'
}

export interface AgentStateData {
  state: AgentState;
  startTime: number;
  endTime?: number;
  data?: any;
  previousState?: AgentState;
  stateHistory: AgentState[];
}

export interface StateTransition {
  from: AgentState;
  to: AgentState;
  condition?: (stateData: AgentStateData, context: any) => boolean;
  action?: (stateData: AgentStateData, context: any) => void;
}

export interface MovementData {
  targetX: number;
  targetY: number;
  path: Point[];
  currentPathIndex: number;
  speed: number;
  startTime: number;
  estimatedArrival: number;
}

export interface WorkingData {
  activity: string;
  location: string;
  duration: number;
  progress: number;
  tools?: string[];
}

export interface InteractionData {
  targetId: string;
  targetType: 'agent' | 'player' | 'object';
  interactionType: string;
  duration: number;
  progress: number;
}

export class AgentStateMachine {
  private agentId: string;
  private currentState: AgentStateData;
  private transitions: StateTransition[] = [];
  private stateChangeCallbacks: Map<AgentState, Function[]> = new Map();
  private maxHistorySize: number = 10;

  constructor(agentId: string, initialState: AgentState = AgentState.IDLE) {
    this.agentId = agentId;
    this.currentState = {
      state: initialState,
      startTime: Date.now(),
      stateHistory: []
    };
    
    this.setupDefaultTransitions();
  }

  /**
   * Get current state
   */
  public getCurrentState(): AgentStateData {
    return { ...this.currentState };
  }

  /**
   * Get current state type
   */
  public getState(): AgentState {
    return this.currentState.state;
  }

  /**
   * Check if agent is in a specific state
   */
  public isInState(state: AgentState): boolean {
    return this.currentState.state === state;
  }

  /**
   * Check if agent can transition to a new state
   */
  public canTransitionTo(newState: AgentState, context?: any): boolean {
    const transition = this.findTransition(this.currentState.state, newState);
    
    if (!transition) {
      return false;
    }
    
    if (transition.condition) {
      return transition.condition(this.currentState, context);
    }
    
    return true;
  }

  /**
   * Attempt to transition to a new state
   */
  public transitionTo(newState: AgentState, data?: any, context?: any): boolean {
    if (!this.canTransitionTo(newState, context)) {
      return false;
    }
    
    const transition = this.findTransition(this.currentState.state, newState);
    
    // Execute transition action if present
    if (transition && transition.action) {
      transition.action(this.currentState, context);
    }
    
    // Update state history
    this.currentState.stateHistory.push(this.currentState.state);
    if (this.currentState.stateHistory.length > this.maxHistorySize) {
      this.currentState.stateHistory.shift();
    }
    
    // Create new state data
    const previousState = this.currentState.state;
    this.currentState = {
      state: newState,
      startTime: Date.now(),
      data: data || null,
      previousState: previousState,
      stateHistory: this.currentState.stateHistory
    };
    
    // Call state change callbacks
    this.executeStateChangeCallbacks(newState);
    
    return true;
  }

  /**
   * Force transition to a new state (ignores conditions)
   */
  public forceTransitionTo(newState: AgentState, data?: any): void {
    this.currentState.stateHistory.push(this.currentState.state);
    if (this.currentState.stateHistory.length > this.maxHistorySize) {
      this.currentState.stateHistory.shift();
    }
    
    const previousState = this.currentState.state;
    this.currentState = {
      state: newState,
      startTime: Date.now(),
      data: data || null,
      previousState: previousState,
      stateHistory: this.currentState.stateHistory
    };
    
    this.executeStateChangeCallbacks(newState);
  }

  /**
   * Update state data without changing state
   */
  public updateStateData(data: any): void {
    this.currentState.data = { ...this.currentState.data, ...data };
  }

  /**
   * Get time spent in current state
   */
  public getTimeInCurrentState(): number {
    return Date.now() - this.currentState.startTime;
  }

  /**
   * Get state history
   */
  public getStateHistory(): AgentState[] {
    return [...this.currentState.stateHistory];
  }

  /**
   * Get previous state
   */
  public getPreviousState(): AgentState | undefined {
    return this.currentState.previousState;
  }

  /**
   * Add custom state transition
   */
  public addTransition(transition: StateTransition): void {
    this.transitions.push(transition);
  }

  /**
   * Remove state transition
   */
  public removeTransition(from: AgentState, to: AgentState): void {
    this.transitions = this.transitions.filter(t => !(t.from === from && t.to === to));
  }

  /**
   * Add state change callback
   */
  public onStateChange(state: AgentState, callback: Function): void {
    if (!this.stateChangeCallbacks.has(state)) {
      this.stateChangeCallbacks.set(state, []);
    }
    this.stateChangeCallbacks.get(state)!.push(callback);
  }

  /**
   * Check if state should timeout
   */
  public shouldTimeout(): boolean {
    if (!this.currentState.endTime) {
      return false;
    }
    
    return Date.now() >= this.currentState.endTime;
  }

  /**
   * Set timeout for current state
   */
  public setTimeout(durationMs: number): void {
    this.currentState.endTime = Date.now() + durationMs;
  }

  /**
   * Clear timeout for current state
   */
  public clearTimeout(): void {
    this.currentState.endTime = undefined;
  }

  /**
   * Update state machine (should be called regularly)
   */
  public update(context?: any): void {
    // Check for timeouts
    if (this.shouldTimeout()) {
      this.handleTimeout(context);
    }
    
    // Update state-specific logic
    this.updateStateLogic(context);
  }

  /**
   * Serialize state for persistence
   */
  public serialize(): object {
    return {
      agentId: this.agentId,
      currentState: this.currentState,
      stateHistory: this.currentState.stateHistory
    };
  }

  /**
   * Deserialize state from persistence
   */
  public deserialize(data: any): void {
    this.agentId = data.agentId;
    this.currentState = data.currentState;
    this.currentState.stateHistory = data.stateHistory || [];
  }

  /**
   * Setup default state transitions
   */
  private setupDefaultTransitions(): void {
    // From IDLE
    this.addTransition({
      from: AgentState.IDLE,
      to: AgentState.MOVING,
      condition: (state, context) => context?.hasDestination === true
    });
    
    this.addTransition({
      from: AgentState.IDLE,
      to: AgentState.WORKING,
      condition: (state, context) => context?.hasWork === true
    });
    
    this.addTransition({
      from: AgentState.IDLE,
      to: AgentState.INTERACTING,
      condition: (state, context) => context?.hasInteraction === true
    });
    
    // From MOVING
    this.addTransition({
      from: AgentState.MOVING,
      to: AgentState.IDLE,
      condition: (state, context) => context?.reachedDestination === true
    });
    
    this.addTransition({
      from: AgentState.MOVING,
      to: AgentState.WORKING,
      condition: (state, context) => context?.reachedWorkLocation === true
    });
    
    this.addTransition({
      from: AgentState.MOVING,
      to: AgentState.INTERACTING,
      condition: (state, context) => context?.reachedInteractionTarget === true
    });
    
    // From WORKING
    this.addTransition({
      from: AgentState.WORKING,
      to: AgentState.IDLE,
      condition: (state, context) => context?.workCompleted === true
    });
    
    this.addTransition({
      from: AgentState.WORKING,
      to: AgentState.MOVING,
      condition: (state, context) => context?.needsToMove === true
    });
    
    // From INTERACTING
    this.addTransition({
      from: AgentState.INTERACTING,
      to: AgentState.IDLE,
      condition: (state, context) => context?.interactionCompleted === true
    });
    
    this.addTransition({
      from: AgentState.INTERACTING,
      to: AgentState.TALKING,
      condition: (state, context) => context?.startedConversation === true
    });
    
    // From TALKING
    this.addTransition({
      from: AgentState.TALKING,
      to: AgentState.IDLE,
      condition: (state, context) => context?.conversationEnded === true
    });
    
    // Universal transitions (from any state)
    for (const fromState of Object.values(AgentState)) {
      this.addTransition({
        from: fromState as AgentState,
        to: AgentState.SLEEPING,
        condition: (state, context) => context?.shouldSleep === true
      });
      
      this.addTransition({
        from: fromState as AgentState,
        to: AgentState.EATING,
        condition: (state, context) => context?.shouldEat === true
      });
    }
  }

  /**
   * Find transition between two states
   */
  private findTransition(from: AgentState, to: AgentState): StateTransition | undefined {
    return this.transitions.find(t => t.from === from && t.to === to);
  }

  /**
   * Execute state change callbacks
   */
  private executeStateChangeCallbacks(newState: AgentState): void {
    const callbacks = this.stateChangeCallbacks.get(newState);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(this.currentState);
        } catch (error) {
          console.error(`Error in state change callback for ${newState}:`, error);
        }
      });
    }
  }

  /**
   * Handle state timeout
   */
  private handleTimeout(context?: any): void {
    switch (this.currentState.state) {
      case AgentState.WORKING:
        this.transitionTo(AgentState.IDLE, null, { workCompleted: true });
        break;
      case AgentState.INTERACTING:
        this.transitionTo(AgentState.IDLE, null, { interactionCompleted: true });
        break;
      case AgentState.TALKING:
        this.transitionTo(AgentState.IDLE, null, { conversationEnded: true });
        break;
      case AgentState.EATING:
        this.transitionTo(AgentState.IDLE, null, { eatingCompleted: true });
        break;
      default:
        this.transitionTo(AgentState.IDLE);
        break;
    }
  }

  /**
   * Update state-specific logic
   */
  private updateStateLogic(context?: any): void {
    switch (this.currentState.state) {
      case AgentState.MOVING:
        this.updateMovementState(context);
        break;
      case AgentState.WORKING:
        this.updateWorkingState(context);
        break;
      case AgentState.INTERACTING:
        this.updateInteractionState(context);
        break;
    }
  }

  /**
   * Update movement state logic
   */
  private updateMovementState(context?: any): void {
    if (this.currentState.data) {
      const movementData = this.currentState.data as MovementData;
      
      // Check if arrived at destination
      if (context?.currentX === movementData.targetX && context?.currentY === movementData.targetY) {
        this.transitionTo(AgentState.IDLE, null, { reachedDestination: true });
      }
    }
  }

  /**
   * Update working state logic
   */
  private updateWorkingState(context?: any): void {
    if (this.currentState.data) {
      const workingData = this.currentState.data as WorkingData;
      const timeInState = this.getTimeInCurrentState();
      
      // Update progress
      workingData.progress = Math.min(1.0, timeInState / workingData.duration);
      
      // Check if work is complete
      if (workingData.progress >= 1.0) {
        this.transitionTo(AgentState.IDLE, null, { workCompleted: true });
      }
    }
  }

  /**
   * Update interaction state logic
   */
  private updateInteractionState(context?: any): void {
    if (this.currentState.data) {
      const interactionData = this.currentState.data as InteractionData;
      const timeInState = this.getTimeInCurrentState();
      
      // Update progress
      interactionData.progress = Math.min(1.0, timeInState / interactionData.duration);
      
      // Check if interaction is complete
      if (interactionData.progress >= 1.0) {
        this.transitionTo(AgentState.IDLE, null, { interactionCompleted: true });
      }
    }
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): object {
    return {
      agentId: this.agentId,
      currentState: this.currentState.state,
      timeInCurrentState: this.getTimeInCurrentState(),
      stateHistory: this.currentState.stateHistory,
      previousState: this.currentState.previousState,
      hasTimeout: !!this.currentState.endTime,
      timeoutIn: this.currentState.endTime ? this.currentState.endTime - Date.now() : null
    };
  }
} 