# AI Activity System Documentation

## Overview

The AI Activity System is a comprehensive framework that manages NPC behaviors and actions in Heartwood Valley. It translates natural language activity descriptions into concrete, believable actions that NPCs can perform in the game world, creating a seamless bridge between AI-generated plans and observable NPC behavior.

**Status**: ✅ Fully Operational with 61 activities and 200+ aliases

## Architecture

### Core Components

#### 1. ActivityManifest
**Location**: `game-server/src/systems/ActivityManifest.ts`  
**Purpose**: Defines all possible activities and their properties

**Key Features**:
- **61 Core Activities**: Comprehensive set of NPC actions
- **200+ Aliases**: Natural language mappings for AI compatibility
- **Activity Types**: STATIONARY, MOVEMENT, SOCIAL, CRAFTING, MAINTENANCE
- **Location Requirements**: Semantic location matching via tags
- **Parameter Handling**: Flexible activity customization

#### 2. WorldLocationRegistry
**Location**: `game-server/src/systems/WorldLocationRegistry.ts`  
**Purpose**: Maps semantic activity requirements to physical world locations

**Key Features**:
- **52 Locations**: Complete town mapping with coordinates
- **Tag-based Matching**: Semantic location lookup by purpose
- **Distance Calculation**: Pathfinding integration
- **Resource Management**: Shared location access coordination

#### 3. Activity State Machine
**Location**: `game-server/src/systems/Activity.ts`  
**Purpose**: Individual activity lifecycle management

**Key Features**:
- **State Management**: Planning → Movement → Execution → Completion
- **Movement Patterns**: Pacing, patrolling, wandering, circles
- **Interruption Handling**: Graceful activity cancellation
- **Context Preservation**: Maintains activity parameters and state

#### 4. ActivityManager
**Location**: `game-server/src/systems/ActivityManager.ts`  
**Purpose**: Per-agent activity coordination and queue management

**Key Features**:
- **Activity Queue**: Priority-based activity scheduling
- **Current Activity**: Active state management
- **Display Integration**: Rich activity descriptions for client
- **Interruption Logic**: Seamless activity transitions

## Activity Types

### Core Activity Categories

#### 1. STATIONARY Activities
**Purpose**: Location-based activities performed in place  
**Behavior**: Move to location, then perform action

**Examples**:
- `work`: General work activities
- `eat`: Meal consumption
- `sleep`: Rest and recovery
- `study`: Learning and research
- `read`: Reading books or documents
- `organize`: Arranging and tidying

#### 2. MOVEMENT Activities
**Purpose**: Activities focused on movement and navigation  
**Behavior**: Continuous movement with patterns

**Examples**:
- `goto_location`: Move to specific destination
- `patrol`: Regular route monitoring
- `routine_movement`: Pacing, wandering, circles
- `walk`: General movement activities
- `pace`: Back-and-forth movement

#### 3. SOCIAL Activities
**Purpose**: Interpersonal interactions and communication  
**Behavior**: Location-based with social context

**Examples**:
- `talk`: Conversations and discussions
- `greet`: Welcoming and acknowledgments
- `socialize`: General social interaction
- `visit`: Calling on others
- `collaborate`: Working together

#### 4. CRAFTING Activities
**Purpose**: Creating, building, and making objects  
**Behavior**: Location-based with creation context

**Examples**:
- `craft`: General crafting activities
- `build`: Construction and assembly
- `create`: Making new items
- `repair`: Fixing and maintenance
- `cook`: Food preparation

#### 5. MAINTENANCE Activities
**Purpose**: Cleaning, organizing, and upkeep  
**Behavior**: Location-based with maintenance context

**Examples**:
- `clean`: Cleaning and tidying
- `organize`: Arranging and sorting
- `maintain`: General upkeep
- `prepare`: Getting ready for activities
- `setup`: Arranging for future use

## Activity Manifest Structure

### Activity Definition
```typescript
interface ActivityManifestEntry {
  name: string;
  aliases: string[];
  description: string;
  activityType: ActivityType;
  requiredLocationTags: string[];
  preferredLocationTags: string[];
  duration: string;
  movementPattern?: MovementPattern;
  animation?: string;
  requirements?: string[];
  socialContext?: boolean;
}
```

### Example Activity Definition
```typescript
{
  name: 'work',
  aliases: ['working', 'doing_work', 'job', 'labor', 'employment'],
  description: 'General work activities',
  activityType: ActivityType.STATIONARY,
  requiredLocationTags: ['work', 'workplace', 'office', 'shop'],
  preferredLocationTags: ['indoor', 'professional'],
  duration: '30m',
  animation: 'working',
  requirements: ['working_hours'],
  socialContext: false
}
```

## World Location Registry

### Location Structure
```typescript
interface LocationEntry {
  id: string;
  displayName: string;
  coordinates: { x: number; y: number };
  tags: string[];
  capacity?: number;
  description?: string;
}
```

### Location Examples
```typescript
// Professional locations
{
  id: 'blacksmith_shop',
  displayName: 'Blacksmith Shop',
  coordinates: { x: 832, y: 384 },
  tags: ['work', 'crafting', 'metalwork', 'indoor', 'professional'],
  capacity: 2,
  description: 'Elara\'s metalworking workshop'
}

// Social locations
{
  id: 'town_square',
  displayName: 'Town Square',
  coordinates: { x: 688, y: 576 },
  tags: ['social', 'public', 'gathering', 'outdoor', 'central'],
  capacity: 10,
  description: 'Central gathering place for the community'
}
```

### Tag-based Location Matching
The system uses semantic tags to match activities with appropriate locations:

```typescript
// Activity requires 'work' tag
const workActivity = { requiredLocationTags: ['work'] };

// System finds all locations with 'work' tag
const workLocations = [
  'blacksmith_shop',    // tags: ['work', 'crafting', 'metalwork']
  'bakery',            // tags: ['work', 'food', 'baking']
  'town_hall',         // tags: ['work', 'administration', 'public']
];
```

## Activity State Machine

### State Flow
```
PLANNING → MOVING_TO_LOCATION → PERFORMING_ACTION → COMPLETED
    ↓              ↓                    ↓
FAILED         INTERRUPTED         INTERRUPTED
```

### State Descriptions

#### 1. PLANNING
**Purpose**: Determine location and activity requirements  
**Actions**:
- Resolve activity name through aliases
- Find appropriate location using tags
- Validate activity requirements
- Set up activity parameters

#### 2. MOVING_TO_LOCATION
**Purpose**: Navigate to the activity location  
**Actions**:
- Calculate pathfinding route
- Initiate agent movement
- Monitor arrival at destination
- Handle movement failures

#### 3. PERFORMING_ACTION
**Purpose**: Execute the main activity  
**Actions**:
- Set appropriate agent state
- Display activity description
- Update agent animation
- Maintain activity until completion

#### 4. ROUTINE_MOVEMENT
**Purpose**: Follow movement patterns  
**Actions**:
- Execute movement waypoints
- Follow specified patterns (pace, patrol, circle)
- Handle continuous movement
- Maintain display text

### Movement Patterns

#### Supported Patterns
- **PACE**: Back-and-forth movement
- **PATROL**: Following a route
- **WANDER**: Random movement within area
- **CIRCLE**: Circular movement pattern
- **LAPS**: Repeated route following
- **PERIMETER**: Boundary movement
- **ZIGZAG**: Diagonal movement pattern

#### Pattern Implementation
```typescript
// Example: Setting up pacing movement
private setupPaceWaypoints(centerPoint: Point): void {
  this.movementWaypoints = [
    { x: centerPoint.x - 32, y: centerPoint.y }, // Left
    { x: centerPoint.x + 32, y: centerPoint.y }  // Right
  ];
  this.currentWaypointIndex = 0;
}
```

## Activity Execution Flow

### Natural Language Processing
1. **Activity Request**: "work at the blacksmith shop"
2. **Alias Resolution**: "work" → core activity
3. **Location Matching**: "blacksmith shop" → coordinates
4. **Activity Creation**: New Activity instance
5. **State Machine**: Planning → Execution

### Schedule Integration
```typescript
// Daily schedule entry
{
  "9:00": {
    "activity": "work",
    "description": "begin metalworking at the blacksmith shop"
  }
}

// Execution process
1. PlanExecutor triggers at 9:00
2. ActivityManager receives request
3. Activity resolves to blacksmith_shop location
4. Agent moves to location and begins working
```

### Emergency Interruption
```typescript
// High-priority emergency activity
const emergencyActivity = {
  activityName: 'emergency_response',
  priority: 10,
  interruptCurrent: true,
  parameters: {
    urgency: 'high',
    reason: 'Medical emergency at docks'
  }
};

// System interrupts current activity and executes emergency
agent.activityManager.requestActivity(emergencyActivity);
```

## Activity Display System

### Rich Activity Descriptions
Activities provide contextual descriptions for client display:

```typescript
// Activity generates display text
getDisplayText(): string {
  const activity = this.context.resolvedActivityName;
  const location = this.context.targetLocation?.displayName;
  const parameters = this.context.parameters;
  
  if (parameters.customDescription) {
    return parameters.customDescription;
  }
  
  return `${activity}${location ? ` at ${location}` : ''}`;
}
```

### Client Integration
```typescript
// GameScene displays activity
agent.schema.currentActivity = activityManager.getDisplayText();
// Client shows: "working at Blacksmith Shop"
```

## Performance Optimization

### Activity Caching
- **Location Lookups**: Cached location coordinate mappings
- **Activity Aliases**: Pre-resolved activity name mappings
- **Path Calculations**: Cached pathfinding results

### Memory Management
- **Activity Lifecycle**: Proper cleanup on completion
- **State Transitions**: Efficient state management
- **Resource Sharing**: Shared location registries

### Coordination Efficiency
- **Location Capacity**: Prevent overcrowding
- **Movement Coordination**: Shared pathfinding system
- **State Synchronization**: Efficient client updates

## Integration Points

### Planning System Integration
```typescript
// Daily planning generates natural language activities
const dailyPlan = [
  "6:00 - wake up and prepare for the day",
  "7:00 - work at the blacksmith shop",
  "12:00 - eat lunch at the tavern",
  "19:00 - socialize at the town square"
];

// Activity system translates to concrete actions
planExecutor.executeScheduledActions(agents);
```

### Memory System Integration
- **Activity Observations**: NPCs observe each other's activities
- **Activity Memories**: Activities stored in memory system
- **Context Awareness**: Activities inform memory generation

### Movement System Integration
- **Pathfinding**: A* integration for movement
- **Collision Detection**: Tile-based movement validation
- **Smooth Movement**: Velocity-based interpolation

## Development Tools

### Activity Testing
- **Activity Manifest Validation**: Verify all activities are properly defined
- **Location Coverage**: Ensure all activity types have appropriate locations
- **Alias Resolution**: Test natural language to activity mapping

### Debug Interfaces
- **Activity Visualization**: See current agent activities
- **State Debugging**: Monitor activity state transitions
- **Performance Metrics**: Track activity execution times

### Configuration
```typescript
// Activity system configuration
const activityConfig = {
  maxActivityQueue: 5,
  defaultActivityDuration: '30m',
  movementSpeed: 1.0,
  interruptionGracePeriod: 5000
};
```

## Future Enhancements

### Planned Improvements
1. **Complex Activities**: Multi-step activity sequences
2. **Collaborative Activities**: Multiple agents working together
3. **Resource Requirements**: Activities requiring specific items
4. **Conditional Activities**: Weather and time-dependent activities

### Technical Enhancements
1. **Activity Optimization**: More efficient state management
2. **Advanced Pathfinding**: Improved movement algorithms
3. **Activity Analytics**: Performance and usage metrics
4. **Real-time Updates**: Live activity stream for debugging

## Conclusion

The AI Activity System provides a robust framework for translating high-level AI plans into concrete, observable NPC behaviors. By combining semantic location matching, flexible activity definitions, and sophisticated state management, the system creates believable and engaging NPC activities.

The modular architecture enables easy extension with new activities and locations, while the natural language processing capabilities ensure seamless integration with AI-generated plans. This system forms a crucial bridge between AI cognition and observable game world behavior, making NPCs feel truly alive and purposeful. 