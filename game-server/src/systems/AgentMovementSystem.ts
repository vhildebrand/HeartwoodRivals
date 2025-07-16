/**
 * Agent Movement System
 * Handles agent movement, pathfinding, and position updates
 * Integrates with the game server's update loop
 */

import { SpawnedAgent } from './AgentSpawner';
import { AgentState, MovementData } from './AgentStateMachine';
import { Point } from './Pathfinding';
import { MapManager } from '../maps/MapManager';

export interface MovementUpdate {
  agentId: string;
  oldX: number;
  oldY: number;
  newX: number;
  newY: number;
  direction: number;
  isMoving: boolean;
  reachedDestination: boolean;
}

export class AgentMovementSystem {
  private mapManager: MapManager;
  private mapId: string;
  private movementSpeed: number = 2.0; // tiles per second
  private updateCallbacks: ((update: MovementUpdate) => void)[] = [];
  private movementHistory: Map<string, Point[]> = new Map();
  private maxHistorySize: number = 10;

  constructor(mapId: string) {
    this.mapManager = MapManager.getInstance();
    this.mapId = mapId;
  }

  /**
   * Update agent movement for all agents
   */
  public updateMovement(agents: Map<string, SpawnedAgent>, deltaTime: number): void {
    for (const [agentId, agent] of agents) {
      if (agent.stateMachine.isInState(AgentState.MOVING)) {
        this.updateAgentMovement(agent, deltaTime);
      }
    }
  }

  /**
   * Update movement for a single agent
   */
  private updateAgentMovement(agent: SpawnedAgent, deltaTime: number): void {
    const movementData = agent.stateMachine.getCurrentState().data as MovementData;
    
    if (!movementData || !movementData.path || movementData.path.length === 0) {
      // No path or invalid movement data, stop moving
      this.stopAgentMovement(agent);
      return;
    }

    const currentX = agent.schema.x;
    const currentY = agent.schema.y;
    
    // Get current target waypoint
    const targetIndex = movementData.currentPathIndex;
    if (targetIndex >= movementData.path.length) {
      // Reached final destination
      this.completeAgentMovement(agent);
      return;
    }

    const targetWaypoint = movementData.path[targetIndex];
    const targetX = targetWaypoint.x;
    const targetY = targetWaypoint.y;

    // Calculate movement vector
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if we've reached the current waypoint
    if (distance < 0.1) {
      // Reached waypoint, move to next one
      movementData.currentPathIndex++;
      agent.stateMachine.updateStateData({ currentPathIndex: movementData.currentPathIndex });
      
      // Update position exactly to waypoint
      this.updateAgentPosition(agent, targetX, targetY);
      
      // Check if we've reached the final destination
      if (movementData.currentPathIndex >= movementData.path.length) {
        this.completeAgentMovement(agent);
        return;
      }
    } else {
      // Move towards current waypoint
      const movementDistance = this.movementSpeed * deltaTime;
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;
      
      const newX = currentX + normalizedDx * movementDistance;
      const newY = currentY + normalizedDy * movementDistance;
      
      // Validate movement (collision detection)
      if (this.canMoveTo(Math.floor(newX), Math.floor(newY))) {
        this.updateAgentPosition(agent, newX, newY);
        
        // Update direction based on movement
        const direction = this.calculateDirection(normalizedDx, normalizedDy);
        agent.schema.direction = direction;
        agent.schema.isMoving = true;
        
        // Update velocity for smooth client-side rendering
        agent.schema.velocityX = normalizedDx * this.movementSpeed;
        agent.schema.velocityY = normalizedDy * this.movementSpeed;
      } else {
        // Collision detected, try to recalculate path
        this.handleMovementCollision(agent);
      }
    }
  }

  /**
   * Update agent position
   */
  private updateAgentPosition(agent: SpawnedAgent, x: number, y: number): void {
    const oldX = agent.schema.x;
    const oldY = agent.schema.y;
    
    agent.schema.x = x;
    agent.schema.y = y;
    agent.schema.lastUpdate = Date.now();
    
    // Record movement history
    this.recordMovementHistory(agent.data.id, { x, y });
    
    // Notify callbacks
    const movementUpdate: MovementUpdate = {
      agentId: agent.data.id,
      oldX,
      oldY,
      newX: x,
      newY: y,
      direction: agent.schema.direction,
      isMoving: agent.schema.isMoving,
      reachedDestination: false
    };
    
    this.notifyMovementUpdate(movementUpdate);
  }

  /**
   * Complete agent movement when destination is reached
   */
  private completeAgentMovement(agent: SpawnedAgent): void {
    const movementData = agent.stateMachine.getCurrentState().data as MovementData;
    
    // Update position to exact destination
    this.updateAgentPosition(agent, movementData.targetX, movementData.targetY);
    
    // Stop movement
    agent.schema.isMoving = false;
    agent.schema.velocityX = 0;
    agent.schema.velocityY = 0;
    
    // Update current location if we have location data
    if (movementData.targetX && movementData.targetY) {
      const locationName = this.getLocationNameFromPosition(movementData.targetX, movementData.targetY);
      if (locationName) {
        agent.schema.currentLocation = locationName;
      }
    }
    
    // Transition to idle state
    agent.stateMachine.transitionTo(AgentState.IDLE, null, { 
      reachedDestination: true 
    });
    
    // Notify completion
    const movementUpdate: MovementUpdate = {
      agentId: agent.data.id,
      oldX: agent.schema.x,
      oldY: agent.schema.y,
      newX: agent.schema.x,
      newY: agent.schema.y,
      direction: agent.schema.direction,
      isMoving: false,
      reachedDestination: true
    };
    
    this.notifyMovementUpdate(movementUpdate);
    
    console.log(`✅ Agent ${agent.data.name} reached destination (${movementData.targetX}, ${movementData.targetY})`);
  }

  /**
   * Stop agent movement
   */
  private stopAgentMovement(agent: SpawnedAgent): void {
    agent.schema.isMoving = false;
    agent.schema.velocityX = 0;
    agent.schema.velocityY = 0;
    
    // Transition to idle if currently moving
    if (agent.stateMachine.isInState(AgentState.MOVING)) {
      agent.stateMachine.transitionTo(AgentState.IDLE);
    }
  }

  /**
   * Handle movement collision
   */
  private handleMovementCollision(agent: SpawnedAgent): void {
    console.warn(`🚫 Movement collision detected for agent ${agent.data.name}`);
    
    const movementData = agent.stateMachine.getCurrentState().data as MovementData;
    if (!movementData) return;
    
    // Convert pixel coordinates to tile coordinates for pathfinding
    const currentPixelPos = { x: agent.schema.x, y: agent.schema.y };
    const targetPixelPos = { x: movementData.targetX, y: movementData.targetY };
    
    const currentTilePosRaw = this.mapManager.pixelToTile(this.mapId, currentPixelPos.x, currentPixelPos.y);
    const currentTilePos = { x: currentTilePosRaw.tileX, y: currentTilePosRaw.tileY };
    
    const targetTilePosRaw = this.mapManager.pixelToTile(this.mapId, targetPixelPos.x, targetPixelPos.y);
    const targetTilePos = { x: targetTilePosRaw.tileX, y: targetTilePosRaw.tileY };
    
    // Try to recalculate path in tile coordinates
    const newTilePath = agent.pathfinding.findPath(currentTilePos, targetTilePos);
    
    if (newTilePath.length > 0) {
      // Convert tile path back to pixel coordinates
      const newPixelPath = newTilePath.map(tilePoint => {
        const pixelPoint = this.mapManager.tileToPixel(this.mapId, tilePoint.x, tilePoint.y);
        return { x: pixelPoint.pixelX, y: pixelPoint.pixelY };
      });
      
      // Update with new path
      movementData.path = newPixelPath;
      movementData.currentPathIndex = 0;
      agent.stateMachine.updateStateData(movementData);
      
      console.log(`🔄 Recalculated path for agent ${agent.data.name} (${newPixelPath.length} waypoints)`);
    } else {
      // No path found, stop movement
      console.error(`❌ No path found for agent ${agent.data.name}, stopping movement`);
      this.stopAgentMovement(agent);
    }
  }

  /**
   * Check if agent can move to a position
   */
  private canMoveTo(pixelX: number, pixelY: number): boolean {
    // Convert pixel coordinates to tile coordinates for collision checking
    const tilePos = this.mapManager.pixelToTile(this.mapId, pixelX, pixelY);
    return this.mapManager.isTileWalkable(this.mapId, tilePos.tileX, tilePos.tileY);
  }

  /**
   * Calculate direction based on movement vector
   */
  private calculateDirection(dx: number, dy: number): number {
    const threshold = 0.1;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > threshold ? 3 : 2; // right : left
    } else {
      return dy > threshold ? 0 : 1; // down : up
    }
  }

  /**
   * Get location name from position using WorldLocationRegistry
   */
  private getLocationNameFromPosition(x: number, y: number): string | null {
    try {
      // Import here to avoid circular dependencies
      const { WorldLocationRegistry } = require('./WorldLocationRegistry');
      const locationRegistry = WorldLocationRegistry.getInstance();
      
      // Find the closest location within a reasonable distance
      const allLocations = locationRegistry.getAllLocations();
      let closestLocation = null;
      let closestDistance = Infinity;
      
      for (const [locationId, location] of allLocations) {
        const centerX = location.x + (location.width || 0) / 2;
        const centerY = location.y + (location.height || 0) / 2;
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        // Check if position is within location bounds or very close
        if (distance < Math.max(location.width || 8, location.height || 8) / 2 + 5) {
          if (distance < closestDistance) {
            closestDistance = distance;
            closestLocation = location;
          }
        }
      }
      
      return closestLocation ? closestLocation.id : null;
    } catch (error) {
      console.warn('Could not determine location from position:', error);
      return null;
    }
  }

  /**
   * Record movement history
   */
  private recordMovementHistory(agentId: string, position: Point): void {
    if (!this.movementHistory.has(agentId)) {
      this.movementHistory.set(agentId, []);
    }
    
    const history = this.movementHistory.get(agentId)!;
    history.push(position);
    
    // Keep history size limited
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get movement history for an agent
   */
  public getMovementHistory(agentId: string): Point[] {
    return this.movementHistory.get(agentId) || [];
  }

  /**
   * Start agent movement to a destination
   */
  public startMovement(agent: SpawnedAgent, targetX: number, targetY: number): boolean {
    // Convert pixel coordinates to tile coordinates for pathfinding
    const mapData = this.mapManager.getMap(this.mapId);
    if (!mapData) {
      console.error(`❌ Map data not found for ${this.mapId}`);
      return false;
    }
    
    // Convert current position (pixel) to tile coordinates
    const currentTilePosRaw = this.mapManager.pixelToTile(this.mapId, agent.schema.x, agent.schema.y);
    const currentTilePos = { x: currentTilePosRaw.tileX, y: currentTilePosRaw.tileY };
    
    // Convert target position (pixel) to tile coordinates  
    const targetTilePosRaw = this.mapManager.pixelToTile(this.mapId, targetX, targetY);
    const targetTilePos = { x: targetTilePosRaw.tileX, y: targetTilePosRaw.tileY };
    
    console.log(`🎯 [MOVEMENT] ${agent.data.name} moving from pixel (${agent.schema.x}, ${agent.schema.y}) = tile (${currentTilePos.x}, ${currentTilePos.y}) to pixel (${targetX}, ${targetY}) = tile (${targetTilePos.x}, ${targetTilePos.y})`);
    
    // Find path in tile coordinates
    const tilePath = agent.pathfinding.findPath(currentTilePos, targetTilePos);
    
    if (tilePath.length === 0) {
      console.error(`❌ No path found for agent ${agent.data.name} to tile (${targetTilePos.x}, ${targetTilePos.y})`);
      return false;
    }
    
    // Convert tile path back to pixel coordinates for movement
    const pixelPath = tilePath.map(tilePoint => {
      const pixelPoint = this.mapManager.tileToPixel(this.mapId, tilePoint.x, tilePoint.y);
      return { x: pixelPoint.pixelX, y: pixelPoint.pixelY };
    });
    
    // Create movement data
    const movementData: MovementData = {
      targetX,
      targetY,
      path: pixelPath,
      currentPathIndex: 0,
      speed: this.movementSpeed,
      startTime: Date.now(),
      estimatedArrival: Date.now() + (pixelPath.length * 1000 / this.movementSpeed)
    };
    
    // Transition to moving state
    const success = agent.stateMachine.transitionTo(AgentState.MOVING, movementData, {
      hasDestination: true
    });
    
    if (success) {
      console.log(`🚶 Agent ${agent.data.name} started moving to (${targetX}, ${targetY}) with ${pixelPath.length} waypoints`);
    }
    
    return success;
  }

  /**
   * Add movement update callback
   */
  public onMovementUpdate(callback: (update: MovementUpdate) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Remove movement update callback
   */
  public removeMovementCallback(callback: (update: MovementUpdate) => void): void {
    const index = this.updateCallbacks.indexOf(callback);
    if (index !== -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all callbacks of movement update
   */
  private notifyMovementUpdate(update: MovementUpdate): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in movement update callback:', error);
      }
    }
  }

  /**
   * Check if agent is currently moving
   */
  public isAgentMoving(agentId: string): boolean {
    // This would need to be called with the agent reference
    // For now, we'll assume it's checked via the state machine
    return false;
  }

  /**
   * Get agent's current movement progress
   */
  public getMovementProgress(agent: SpawnedAgent): number {
    if (!agent.stateMachine.isInState(AgentState.MOVING)) {
      return 0;
    }
    
    const movementData = agent.stateMachine.getCurrentState().data as MovementData;
    if (!movementData || !movementData.path) {
      return 0;
    }
    
    return movementData.currentPathIndex / movementData.path.length;
  }

  /**
   * Set movement speed
   */
  public setMovementSpeed(speed: number): void {
    this.movementSpeed = Math.max(0.1, Math.min(5.0, speed));
  }

  /**
   * Get current movement speed
   */
  public getMovementSpeed(): number {
    return this.movementSpeed;
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): object {
    return {
      mapId: this.mapId,
      movementSpeed: this.movementSpeed,
      updateCallbacks: this.updateCallbacks.length,
      movementHistory: this.movementHistory.size
    };
  }
} 