# Agent Coordination System Documentation

## Overview

The Agent Coordination System manages the movement, pathfinding, and spatial coordination of 24 autonomous NPCs in Heartwood Valley. It provides intelligent navigation, collision avoidance, and smooth movement while maintaining real-time performance and believable NPC behavior.

**Status**: ✅ Fully Operational with A* pathfinding and smooth movement

## Architecture

### Core Components

#### 1. AgentMovementSystem
**Location**: `game-server/src/systems/AgentMovementSystem.ts`  
**Purpose**: Handles all agent movement, pathfinding, and collision detection

**Key Features**:
- **A* Pathfinding**: Optimal route calculation
- **Smooth Movement**: Velocity-based interpolation
- **Collision Detection**: Tile-based movement validation
- **Movement Coordination**: Prevents agent overlap and conflicts

#### 2. Pathfinding System
**Location**: `game-server/src/systems/Pathfinding.ts`  
**Purpose**: Implements A* pathfinding algorithm for intelligent navigation

**Key Features**:
- **A* Algorithm**: Optimal pathfinding with heuristics
- **Tile-based Navigation**: Grid-based movement system
- **Obstacle Avoidance**: Dynamic obstacle detection
- **Path Optimization**: Efficient route calculation

#### 3. MapManager Integration
**Location**: `game-server/src/maps/MapManager.ts`  
**Purpose**: Provides collision detection and tile-based world representation

**Key Features**:
- **Collision Detection**: Tile walkability validation
- **Coordinate Conversion**: Pixel ↔ tile coordinate mapping
- **Map Data Access**: Efficient tile data retrieval
- **World Boundaries**: Movement constraint enforcement

#### 4. AgentStateMachine
**Location**: `game-server/src/systems/AgentStateMachine.ts`  
**Purpose**: Manages agent states and movement transitions

**Key Features**:
- **State Management**: IDLE, MOVING, WORKING, INTERACTING states
- **Movement Data**: Path tracking and movement parameters
- **State Transitions**: Smooth state change handling
- **Timeout Management**: Automatic state cleanup

## Movement System Architecture

### Movement Flow
```
Activity Request → Location Resolution → Pathfinding → Movement Execution → Arrival
```

### Core Movement Process

#### 1. Movement Initiation
```typescript
// Activity system requests movement
const success = agent.movementSystem.startMovement(
  agent, 
  targetX, 
  targetY
);

// System converts coordinates and calculates path
const currentTile = mapManager.pixelToTile(mapId, agent.x, agent.y);
const targetTile = mapManager.pixelToTile(mapId, targetX, targetY);
const tilePath = pathfinding.findPath(currentTile, targetTile);
```

#### 2. Path Execution
```typescript
// Movement system updates agent position
private updateAgentMovement(agent: SpawnedAgent, deltaTime: number): void {
  const movementData = agent.stateMachine.getCurrentState().data;
  const targetWaypoint = movementData.path[movementData.currentPathIndex];
  
  // Calculate movement vector
  const dx = targetWaypoint.x - agent.x;
  const dy = targetWaypoint.y - agent.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Move towards waypoint
  if (distance > 0.1) {
    const speed = this.movementSpeed * deltaTime;
    const newX = agent.x + (dx / distance) * speed;
    const newY = agent.y + (dy / distance) * speed;
    
    // Update position with collision detection
    if (this.canMoveTo(newX, newY)) {
      this.updateAgentPosition(agent, newX, newY);
    }
  }
}
```

#### 3. Arrival Detection
```typescript
// Check if agent reached destination
if (distance < 0.1) {
  movementData.currentPathIndex++;
  
  if (movementData.currentPathIndex >= movementData.path.length) {
    this.completeAgentMovement(agent);
  }
}
```

## Pathfinding Implementation

### A* Algorithm
The system uses A* pathfinding for optimal route calculation:

```typescript
// A* pathfinding implementation
findPath(start: Point, goal: Point): Point[] {
  const openSet = new PriorityQueue<Node>();
  const closedSet = new Set<string>();
  
  const startNode = new Node(start.x, start.y, 0, this.heuristic(start, goal));
  openSet.enqueue(startNode, startNode.f);
  
  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    
    if (current.x === goal.x && current.y === goal.y) {
      return this.reconstructPath(current);
    }
    
    closedSet.add(`${current.x},${current.y}`);
    
    for (const neighbor of this.getNeighbors(current)) {
      if (closedSet.has(`${neighbor.x},${neighbor.y}`) || 
          !this.isWalkable(neighbor.x, neighbor.y)) {
        continue;
      }
      
      const tentativeG = current.g + this.getDistance(current, neighbor);
      
      if (tentativeG < neighbor.g) {
        neighbor.parent = current;
        neighbor.g = tentativeG;
        neighbor.f = neighbor.g + neighbor.h;
        
        if (!openSet.contains(neighbor)) {
          openSet.enqueue(neighbor, neighbor.f);
        }
      }
    }
  }
  
  return []; // No path found
}
```

### Heuristic Function
```typescript
// Manhattan distance heuristic
private heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
```

### Collision Detection
```typescript
// Check if tile is walkable
private isWalkable(x: number, y: number): boolean {
  return this.mapManager.isTileWalkable(this.mapId, x, y);
}
```

## Movement Coordination

### Anti-Collision System
- **Spatial Awareness**: Agents aware of nearby agent positions
- **Path Reservation**: Temporary tile reservations during movement
- **Dynamic Replanning**: Recalculate paths when blocked
- **Collision Avoidance**: Prevent agents from occupying same tile

### Movement Smoothing
```typescript
// Smooth movement with velocity interpolation
private updateAgentPosition(agent: SpawnedAgent, newX: number, newY: number): void {
  agent.schema.x = Math.round(newX * 100) / 100; // Precision rounding
  agent.schema.y = Math.round(newY * 100) / 100;
  
  // Update direction based on movement
  const direction = this.calculateDirection(agent.schema.velocityX, agent.schema.velocityY);
  agent.schema.direction = direction;
  agent.schema.isMoving = true;
  agent.schema.lastUpdate = Date.now();
}
```

### Direction Calculation
```typescript
// Calculate movement direction for animation
private calculateDirection(velocityX: number, velocityY: number): number {
  if (Math.abs(velocityX) > Math.abs(velocityY)) {
    return velocityX > 0 ? 3 : 2; // Right : Left
  } else {
    return velocityY > 0 ? 0 : 1; // Down : Up
  }
}
```

## State Machine Integration

### Movement States
```typescript
enum AgentState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  WORKING = 'WORKING',
  EATING = 'EATING',
  SLEEPING = 'SLEEPING',
  INTERACTING = 'INTERACTING'
}
```

### Movement Data Structure
```typescript
interface MovementData {
  targetX: number;
  targetY: number;
  path: Point[];
  currentPathIndex: number;
  speed: number;
  startTime: number;
  estimatedArrival: number;
}
```

### State Transitions
```typescript
// Start movement
const movementData: MovementData = {
  targetX: destination.x,
  targetY: destination.y,
  path: pixelPath,
  currentPathIndex: 0,
  speed: this.movementSpeed,
  startTime: Date.now(),
  estimatedArrival: Date.now() + estimatedDuration
};

const success = agent.stateMachine.transitionTo(AgentState.MOVING, movementData);
```

## Performance Optimization

### Movement Updates
- **Delta Time**: Frame-rate independent movement
- **Selective Updates**: Only update moving agents
- **Batch Processing**: Process multiple agents efficiently
- **Spatial Partitioning**: Optimize collision detection

### Path Caching
```typescript
// Cache frequently used paths
private pathCache = new Map<string, Point[]>();

private getCachedPath(start: Point, end: Point): Point[] | null {
  const key = `${start.x},${start.y}-${end.x},${end.y}`;
  return this.pathCache.get(key) || null;
}
```

### Memory Management
- **Path Cleanup**: Remove completed paths
- **Agent Cleanup**: Clean up disconnected agents
- **State Cleanup**: Remove expired state data

## Integration Points

### Activity System Integration
```typescript
// Activity triggers movement
const activity = new Activity(agent, 'work_at_blacksmith');
// Activity planning phase determines target location
// Activity requests movement via AgentMovementSystem
// Movement system handles navigation and arrival
```

### Location System Integration
```typescript
// WorldLocationRegistry provides destinations
const location = worldLocationRegistry.getLocation('blacksmith_shop');
const targetPoint = worldLocationRegistry.getLocationCenter(location);

// Movement system navigates to location
agent.movementSystem.startMovement(agent, targetPoint.x, targetPoint.y);
```

### Multiplayer Integration
```typescript
// Real-time position updates to clients
this.agentMovementSystem.onMovementUpdate((update) => {
  const agent = this.agents.get(update.agentId);
  if (agent) {
    // Update game state for client synchronization
    this.state.agents.set(update.agentId, agent.schema);
  }
});
```

## Collision Detection

### Tile-Based Collision
```typescript
// Check if movement destination is valid
public canMoveTo(x: number, y: number): boolean {
  const tileX = Math.floor(x / this.tileSize);
  const tileY = Math.floor(y / this.tileSize);
  
  return this.mapManager.isTileWalkable(this.mapId, tileX, tileY);
}
```

### Boundary Checking
```typescript
// Ensure agents stay within map boundaries
private isWithinBounds(x: number, y: number): boolean {
  const mapData = this.mapManager.getMap(this.mapId);
  return x >= 0 && x < mapData.width * this.tileSize &&
         y >= 0 && y < mapData.height * this.tileSize;
}
```

### Dynamic Obstacles
- **Agent Avoidance**: Temporary obstacles from other agents
- **Dynamic Replanning**: Recalculate paths when blocked
- **Collision Recovery**: Handle stuck agents

## Movement Patterns

### Routine Movement
The system supports various movement patterns for activities:

#### 1. Pacing Movement
```typescript
// Back-and-forth movement
private setupPaceWaypoints(centerPoint: Point): void {
  this.movementWaypoints = [
    { x: centerPoint.x - 32, y: centerPoint.y },
    { x: centerPoint.x + 32, y: centerPoint.y }
  ];
}
```

#### 2. Patrol Movement
```typescript
// Following a predetermined route
private setupPatrolWaypoints(centerPoint: Point): void {
  this.movementWaypoints = [
    { x: centerPoint.x, y: centerPoint.y - 32 },
    { x: centerPoint.x + 32, y: centerPoint.y },
    { x: centerPoint.x, y: centerPoint.y + 32 },
    { x: centerPoint.x - 32, y: centerPoint.y }
  ];
}
```

#### 3. Circular Movement
```typescript
// Circular movement pattern
private setupCircleWaypoints(centerPoint: Point): void {
  const radius = 32;
  const points = 8;
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    this.movementWaypoints.push({
      x: centerPoint.x + Math.cos(angle) * radius,
      y: centerPoint.y + Math.sin(angle) * radius
    });
  }
}
```

## Debugging and Monitoring

### Movement Visualization
- **Path Debugging**: Visualize agent paths
- **State Monitoring**: Track agent states
- **Performance Metrics**: Movement performance statistics

### Debug Interface
```typescript
// Movement system debugging
public getDebugInfo(agentId: string): MovementDebugInfo {
  const agent = this.agents.get(agentId);
  return {
    currentPosition: { x: agent.x, y: agent.y },
    targetPosition: agent.movementData?.target,
    currentPath: agent.movementData?.path,
    state: agent.stateMachine.getState(),
    isMoving: agent.schema.isMoving
  };
}
```

### Performance Monitoring
```typescript
// Track movement performance
private trackMovementMetrics(): void {
  const movingAgents = this.agents.filter(a => a.schema.isMoving).length;
  const averagePathLength = this.calculateAveragePathLength();
  const pathfindingTime = this.measurePathfindingTime();
  
  console.log(`Moving agents: ${movingAgents}, Avg path: ${averagePathLength}, Pathfinding: ${pathfindingTime}ms`);
}
```

## Configuration

### Movement Parameters
```typescript
const movementConfig = {
  movementSpeed: 1.0,        // Base movement speed
  tileSize: 16,              // Tile size in pixels
  collisionBuffer: 0.1,      // Collision detection buffer
  maxPathLength: 100,        // Maximum path length
  pathCacheSize: 1000,       // Path cache capacity
  smoothingFactor: 0.1       // Movement smoothing
};
```

### Pathfinding Configuration
```typescript
const pathfindingConfig = {
  maxIterations: 10000,      // Maximum A* iterations
  diagonalMovement: true,    // Allow diagonal movement
  diagonalCost: 1.414,       // Diagonal movement cost
  heuristicWeight: 1.0,      // Heuristic function weight
  pathOptimization: true     // Enable path optimization
};
```

## Future Enhancements

### Planned Improvements
1. **Advanced Pathfinding**: Hierarchical pathfinding for large maps
2. **Dynamic Obstacles**: Real-time obstacle avoidance
3. **Group Movement**: Coordinated movement for multiple agents
4. **Movement Prediction**: Predictive movement for smoother gameplay

### Technical Enhancements
1. **Performance Optimization**: Further movement system optimization
2. **Memory Efficiency**: Reduced memory usage for path storage
3. **Collision Improvements**: More sophisticated collision detection
4. **Path Smoothing**: Enhanced path smoothing algorithms

## Conclusion

The Agent Coordination System provides sophisticated movement capabilities for autonomous NPCs through intelligent pathfinding, smooth movement, and efficient coordination. The system successfully balances performance with believable movement behaviors, creating engaging NPC interactions in the game world.

The modular architecture enables easy extension and modification, while the efficient implementation ensures smooth real-time performance with 24 autonomous agents. This system demonstrates how advanced pathfinding and movement coordination can be effectively integrated into multiplayer game environments. 