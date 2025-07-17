# Agent Coordination and Movement System Documentation

## Overview

The Agent Coordination and Movement System handles the complex task of managing NPC movement, pathfinding, and spatial coordination in Heartwood Valley. It ensures NPCs can navigate the world believably while avoiding conflicts, coordinating shared resources, and maintaining smooth gameplay experiences.

## Architecture

### Core Components

#### 1. AgentMovementSystem (`game-server/src/systems/AgentMovementSystem.ts`)
- **Purpose**: Handles NPC movement and pathfinding
- **Features**:
  - Smooth interpolated movement
  - Collision detection and avoidance
  - Movement callbacks for state updates
  - Location-based movement coordination
  - Integration with activity system

#### 2. AgentCoordination (`game-server/src/systems/AgentCoordination.ts`)
- **Purpose**: Manages spatial conflicts and resource sharing
- **Features**:
  - Position reservation system
  - Interaction target management
  - Resource access coordination
  - Conflict resolution algorithms
  - Proximity-based coordination

#### 3. Pathfinding (`game-server/src/systems/Pathfinding.ts`)
- **Purpose**: Calculates optimal paths through the game world
- **Features**:
  - A* pathfinding algorithm
  - Collision map integration
  - Dynamic obstacle avoidance
  - Path caching and optimization
  - Real-time path recalculation

#### 4. MapManager (`game-server/src/maps/MapManager.ts`)
- **Purpose**: Provides collision detection and map data
- **Features**:
  - Tilemap collision detection
  - Walkable tile validation
  - Multi-layer map support
  - Dynamic map loading
  - Collision query optimization

## Movement System

### Movement Types

#### 1. Goal-Directed Movement
- **Purpose**: NPC moves to specific target location
- **Triggers**: Activity changes, schedule updates, player interactions
- **Process**:
  1. Calculate path to target
  2. Begin movement interpolation
  3. Monitor for obstacles
  4. Adjust path if needed
  5. Notify on arrival

#### 2. Patrol Movement
- **Purpose**: NPC follows predefined routes
- **Triggers**: Patrol activities, security duties
- **Process**:
  1. Load patrol waypoints
  2. Navigate between waypoints
  3. Handle dynamic obstacles
  4. Repeat patrol cycle

#### 3. Social Movement
- **Purpose**: NPC moves to interact with others
- **Triggers**: Social activities, conversations
- **Process**:
  1. Identify target agent/player
  2. Calculate approach path
  3. Maintain social distance
  4. Coordinate with target

### Movement State Machine

```typescript
enum MovementState {
  IDLE = 'idle',
  PLANNING = 'planning',
  MOVING = 'moving',
  BLOCKED = 'blocked',
  ARRIVED = 'arrived',
  FAILED = 'failed'
}
```

#### State Transitions
- **IDLE → PLANNING**: Movement request received
- **PLANNING → MOVING**: Path calculated successfully
- **MOVING → BLOCKED**: Obstacle encountered
- **BLOCKED → MOVING**: Obstacle cleared
- **MOVING → ARRIVED**: Destination reached
- **PLANNING → FAILED**: No path found

### Movement Parameters

```typescript
interface MovementData {
  targetX: number;
  targetY: number;
  speed: number;
  pathfinding: boolean;
  callback?: (success: boolean) => void;
}
```

## Pathfinding System

### A* Algorithm Implementation

#### Core Algorithm
```typescript
findPath(start: Point, end: Point): Point[] {
  const openSet: PathNode[] = [];
  const closedSet: Set<string> = new Set();
  const startNode = new PathNode(start.x, start.y, 0, this.heuristic(start, end));
  
  openSet.push(startNode);
  
  while (openSet.length > 0) {
    const current = this.getLowestFScore(openSet);
    
    if (current.x === end.x && current.y === end.y) {
      return this.reconstructPath(current);
    }
    
    // Process neighbors...
  }
  
  return []; // No path found
}
```

#### Heuristic Function
- **Method**: Manhattan distance
- **Formula**: `|x1 - x2| + |y1 - y2|`
- **Purpose**: Guides A* towards target efficiently

#### Path Optimization
- **Smoothing**: Removes unnecessary waypoints
- **Caching**: Stores frequently used paths
- **Dynamic Updates**: Recalculates when obstacles change

### Collision Detection

#### Tile-Based Collision
```typescript
isTileWalkable(x: number, y: number): boolean {
  const tileData = this.getCollisionTile(x, y);
  return tileData === null || tileData.walkable;
}
```

#### Dynamic Obstacles
- **Other NPCs**: Temporary collision objects
- **Moving Objects**: Dynamic collision updates
- **Player Characters**: Real-time collision data

## Agent Coordination

### Position Management

#### Reservation System
```typescript
interface PositionReservation {
  position: string;
  agentId: string;
  expiresAt: number;
}
```

- **Purpose**: Prevents multiple agents from occupying same space
- **Duration**: 5-second reservation timeout
- **Cleanup**: Automatic cleanup of expired reservations

#### Conflict Resolution
1. **Priority System**: Higher priority agents get precedence
2. **Temporal Resolution**: First-come, first-served for equal priority
3. **Alternative Paths**: Find alternate routes when blocked
4. **Waiting Queues**: Queue system for popular locations

### Resource Coordination

#### Shared Resources
- **Workstations**: Anvils, ovens, tables
- **Gathering Points**: Wells, markets, docks
- **Social Spaces**: Town square, tavern, church

#### Access Management
```typescript
interface ResourceAccess {
  resourceId: string;
  agentIds: string[];
  maxCapacity: number;
  currentUsage: number;
}
```

- **Capacity Limits**: Maximum agents per resource
- **Usage Tracking**: Monitor current resource usage
- **Queue Management**: Fair access to limited resources

### Interaction Coordination

#### Social Interactions
- **Proximity Management**: Maintain appropriate distances
- **Conversation Zones**: Designated interaction areas
- **Group Dynamics**: Coordinate multi-agent interactions

#### Conflict Avoidance
- **Personal Space**: Respect agent personal boundaries
- **Movement Prediction**: Anticipate agent movements
- **Collision Prevention**: Proactive obstacle avoidance

## Integration Points

### Activity System Integration

#### Movement Triggers
- **Activity Changes**: New activities trigger movement
- **Schedule Updates**: Time-based movement initiation
- **Emergency Actions**: High-priority movement requests

#### Location Resolution
```typescript
// Activity system requests movement
const targetLocation = worldLocationRegistry.getLocation(locationId);
const success = agentMovementSystem.startMovement(agent, targetLocation.x, targetLocation.y);
```

### Game Server Integration

#### Real-time Updates
- **State Synchronization**: Movement state synced to clients
- **Position Broadcasting**: Real-time position updates
- **Collision Updates**: Dynamic collision map updates

#### Performance Optimization
- **Update Batching**: Batch movement updates
- **Culling**: Only update visible agents
- **Interpolation**: Smooth client-side movement

### Database Integration

#### State Persistence
- **Agent Positions**: Store current agent locations
- **Movement History**: Track movement patterns
- **Path Preferences**: Learn optimal paths

## Performance Optimizations

### Pathfinding Optimizations

#### Hierarchical Pathfinding
- **Zone-based**: Divide map into pathfinding zones
- **Abstraction**: High-level path planning
- **Refinement**: Detailed path calculation

#### Caching Strategy
```typescript
interface PathCache {
  key: string;
  path: Point[];
  timestamp: number;
  usageCount: number;
}
```

- **Common Paths**: Cache frequently used routes
- **TTL**: Time-to-live for cached paths
- **Usage Tracking**: Monitor cache effectiveness

### Movement Optimizations

#### Interpolation System
- **Smooth Movement**: Interpolate between waypoints
- **Predictive Movement**: Anticipate future positions
- **Frame Rate Independence**: Movement speed independent of FPS

#### Batch Processing
- **Movement Updates**: Process multiple agents together
- **Collision Queries**: Batch collision detection
- **Path Calculations**: Parallel pathfinding

### Memory Management

#### Object Pooling
- **Path Nodes**: Reuse pathfinding nodes
- **Movement Data**: Pool movement structures
- **Collision Objects**: Reuse collision detection objects

#### Garbage Collection
- **Cleanup Timers**: Remove expired data
- **Memory Monitoring**: Track memory usage
- **Optimization Triggers**: Automatic cleanup

## Error Handling

### Movement Failures

#### Path Not Found
- **Fallback Behavior**: Find nearest accessible location
- **Error Logging**: Log pathfinding failures
- **User Notification**: Inform about movement issues

#### Collision Conflicts
- **Retry Mechanism**: Attempt alternative paths
- **Timeout Handling**: Abandon stuck movements
- **State Recovery**: Reset to known good state

### Coordination Failures

#### Resource Conflicts
- **Arbitration**: Resolve resource disputes
- **Fallback Resources**: Use alternative resources
- **Queue Management**: Handle resource queues

#### Deadlock Prevention
- **Timeout Mechanisms**: Prevent infinite waiting
- **Priority Systems**: Break deadlocks with priorities
- **Alternative Solutions**: Find alternate approaches

## Monitoring & Debugging

### Movement Analytics

#### Performance Metrics
- **Path Calculation Time**: Measure pathfinding performance
- **Success Rate**: Track movement completion rates
- **Collision Frequency**: Monitor collision events

#### Usage Statistics
- **Popular Paths**: Identify commonly used routes
- **Bottlenecks**: Find movement congestion points
- **Efficiency Metrics**: Measure system effectiveness

### Debug Tools

#### Visual Debugging
- **Path Visualization**: Show calculated paths
- **Collision Overlay**: Display collision data
- **Agent States**: Show movement states

#### Logging System
- **Movement Events**: Log significant movement events
- **Error Tracking**: Track movement failures
- **Performance Logs**: Monitor system performance

## Configuration

### Movement Settings

#### Speed Configuration
```typescript
interface MovementConfig {
  defaultSpeed: number;        // Base movement speed
  runSpeed: number;           // Fast movement speed
  walkSpeed: number;          // Slow movement speed
  interpolationRate: number;  // Smoothing factor
}
```

#### Pathfinding Settings
```typescript
interface PathfindingConfig {
  maxSearchNodes: number;     // Maximum A* nodes
  pathCacheSize: number;      // Cache capacity
  recalculationThreshold: number; // When to recalculate
}
```

### Coordination Settings

#### Conflict Resolution
```typescript
interface CoordinationConfig {
  reservationTimeout: number;  // Position reservation time
  maxAgentsPerResource: number; // Resource capacity
  proximityRadius: number;     // Personal space radius
}
```

## Future Enhancements

### Advanced Movement

#### Behavioral Movement
- **Personality-based**: Movement styles based on personality
- **Emotional States**: Movement affected by emotions
- **Fatigue System**: Movement speed affected by energy

#### Group Movement
- **Formation Movement**: Agents move in formations
- **Leader Following**: Follow designated leader
- **Crowd Simulation**: Realistic crowd behavior

### Enhanced Coordination

#### Predictive Coordination
- **Movement Prediction**: Anticipate future movements
- **Conflict Prediction**: Prevent conflicts before they occur
- **Resource Prediction**: Predict resource needs

#### Social Coordination
- **Relationship-based**: Coordination based on relationships
- **Cultural Norms**: Movement etiquette and customs
- **Event Coordination**: Coordinate for special events

### Performance Improvements

#### Machine Learning
- **Path Learning**: Learn optimal paths from usage
- **Behavior Prediction**: Predict agent behavior
- **Optimization Learning**: Continuously improve performance

#### Hardware Acceleration
- **GPU Pathfinding**: Use GPU for parallel pathfinding
- **SIMD Optimization**: Vectorized movement calculations
- **Multi-threading**: Parallel movement processing

## Conclusion

The Agent Coordination and Movement System provides the foundation for believable NPC behavior in Heartwood Valley. By combining sophisticated pathfinding, intelligent coordination, and smooth movement, it creates a world where NPCs can navigate naturally while maintaining performance and avoiding conflicts.

The system's modular architecture allows for easy extension and optimization while providing the robustness needed for a persistent multiplayer world. The integration with the activity system ensures that movement is always purposeful and contextual, contributing to the overall believability of the autonomous agents.

Future enhancements will focus on more sophisticated behavioral movement, predictive coordination, and performance optimizations to support larger populations of autonomous NPCs in an increasingly complex world. 