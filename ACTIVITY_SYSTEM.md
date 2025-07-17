# Activity System Documentation

## Overview

The Activity System is a comprehensive framework that manages NPC behaviors and actions in Heartwood Valley. It translates text-based activity descriptions into concrete, believable actions that NPCs can perform in the game world. The system provides a flexible, extensible way to handle all NPC activities from basic work tasks to complex social interactions.

## Architecture

### Core Components

#### 1. ActivityManifest (`game-server/src/systems/ActivityManifest.ts`)
- **Purpose**: Defines all possible activities and their properties
- **Features**:
  - Activity type definitions (STATIONARY, MOVEMENT, SOCIAL, etc.)
  - Location requirements and preferences
  - Duration and priority settings
  - Alias resolution for natural language activity matching
  - Parameter handling for activity customization

#### 2. WorldLocationRegistry (`game-server/src/systems/WorldLocationRegistry.ts`)
- **Purpose**: Maps semantic names to physical coordinates
- **Features**:
  - 52 locations with comprehensive tagging system
  - Tag-based location matching
  - Distance-based location selection
  - Semantic location lookup by purpose

#### 3. Activity (`game-server/src/systems/Activity.ts`)
- **Purpose**: Individual activity state machine
- **Features**:
  - Activity lifecycle management
  - Location planning and pathfinding
  - Interruption handling
  - State transition management

#### 4. ActivityManager (`game-server/src/systems/ActivityManager.ts`)
- **Purpose**: Per-agent activity management
- **Features**:
  - Activity queue management
  - Priority-based activity scheduling
  - Schedule-driven activity execution
  - Activity completion handling

## Activity Types

### Core Activity Types

#### STATIONARY Activities
- **Description**: Move to location, then perform action in place
- **Examples**: eating, working, sleeping, studying
- **Behavior**: Agent moves to appropriate location and performs activity

#### ROUTINE_MOVEMENT Activities
- **Description**: Follow specific movement patterns
- **Examples**: patrolling, exercising, pacing
- **Behavior**: Agent follows predefined movement routes

#### GOTO_LOCATION Activities
- **Description**: Simple movement to specific locations
- **Examples**: traveling, visiting, going home
- **Behavior**: Agent moves to target location

#### SOCIAL_INTERACTION Activities
- **Description**: Interact with other agents or players
- **Examples**: socializing, meetings, conversations
- **Behavior**: Agent seeks social interaction opportunities

#### CRAFTING Activities
- **Description**: Work-related activities with specific tools
- **Examples**: smithing, baking, woodworking
- **Behavior**: Agent uses appropriate tools and locations

#### MAINTENANCE Activities
- **Description**: Equipment and facility maintenance
- **Examples**: cleaning, repairing, organizing
- **Behavior**: Agent performs upkeep tasks

#### OBSERVATION Activities
- **Description**: Watching and monitoring activities
- **Examples**: lighthouse keeping, patrol watching
- **Behavior**: Agent observes surroundings from strategic positions

#### ADMINISTRATION Activities
- **Description**: Paperwork and administrative tasks
- **Examples**: record keeping, planning, correspondence
- **Behavior**: Agent performs office-type work

## Activity Processing Flow

### 1. Activity Request
```typescript
interface ActivityRequest {
  activityName: string;
  priority?: number;
  parameters?: ActivityParameters;
  interruptCurrent?: boolean;
}
```

### 2. Activity Resolution
1. **Alias Resolution**: Convert natural language to canonical activity name
2. **Parameter Extraction**: Extract location and behavioral parameters
3. **Activity Creation**: Create Activity instance with resolved parameters
4. **Queue Management**: Add to priority queue or start immediately

### 3. Activity Execution
1. **Planning Phase**: Determine target location and requirements
2. **Movement Phase**: Navigate to activity location
3. **Action Phase**: Perform the activity
4. **Completion Phase**: Clean up and transition to next activity

## Location System

### Location Registry
- **52 Locations**: Covering all areas of Beacon Bay
- **Tag System**: 300+ location tags for semantic matching
- **Categories**: work, social, home, outdoor, indoor, etc.

### Location Matching
```typescript
// Example location matching
const eatingLocations = locationRegistry.findLocationsByTags(['food', 'eating']);
// Returns: Bakery, Cafe, Tavern, etc.
```

### Location Tags
- **Purpose-based**: food, work, social, rest, medical
- **Type-based**: indoor, outdoor, public, private
- **Profession-based**: blacksmith, medical, maritime, farming

## Schedule Integration

### Schedule-Driven Activities
- **PlanExecutor**: Triggers activities based on agent schedules
- **Dynamic Scheduling**: Activities can modify future schedules
- **Priority System**: Emergency activities can interrupt normal schedules

### Schedule Format
```json
{
  "9:00": {
    "activity": "smithing",
    "description": "craft fishing equipment and ship fittings"
  },
  "12:00": {
    "activity": "lunch",
    "description": "lunch break at tavern"
  }
}
```

## Advanced Features

### Natural Language Support
- **200+ Aliases**: Natural language to activity mapping
- **Fuzzy Matching**: "work on ship fittings" → `smithing`
- **Context Understanding**: Location extraction from descriptions

### Parameter System
```typescript
interface ActivityParameters {
  location?: string;
  specificLocation?: string;
  customDescription?: string;
  priority?: number;
  duration?: number;
  scheduledTime?: string;
  emergency?: boolean;
}
```

### Movement Integration
- **AgentMovementSystem**: Handles actual NPC movement
- **Pathfinding**: Efficient path calculation
- **Collision Detection**: Avoids obstacles and other agents

## Performance Optimizations

### Efficient Processing
- **Singleton Pattern**: Single instances of ActivityManifest and LocationRegistry
- **Hash Map Lookups**: O(1) activity resolution
- **Cached Location Data**: Pre-computed location information

### Memory Management
- **Activity Cleanup**: Proper disposal of completed activities
- **Queue Management**: Efficient priority queue operations
- **State Tracking**: Minimal memory footprint per activity

## Activity Examples

### Basic Work Activity
```typescript
// Agent schedule: "9:00": "craft fishing equipment"
// 1. Alias resolves to 'smithing' activity
// 2. Location resolver finds 'blacksmith_shop'
// 3. Agent moves to blacksmith shop
// 4. Agent performs smithing activity
// 5. Display shows "smithing" below character
```

### Social Activity
```typescript
// Agent schedule: "18:00": "dinner at tavern"
// 1. Alias resolves to 'eat' activity
// 2. Location resolver finds 'tavern'
// 3. Agent moves to tavern
// 4. Agent performs eating activity
// 5. May interact with other NPCs present
```

### Emergency Activity
```typescript
// Emergency triggered: "respond to fire at bakery"
// 1. High priority (10) interrupts current activity
// 2. Emergency location override to 'bakery'
// 3. Agent immediately moves to bakery
// 4. Agent performs emergency response
// 5. Normal schedule resumes after completion
```

## Integration Points

### Game Server Integration
- **HeartwoodRoom**: Coordinates activity system with game state
- **AgentSpawner**: Initializes activity managers for all agents
- **Game Loop**: Updates activity system every frame

### Database Integration
- **Agent Schedules**: Stored in PostgreSQL
- **Activity Logs**: Track activity completions
- **Plan Storage**: Generated plans stored for execution

### Client Integration
- **Visual Display**: Activity names shown below NPCs
- **Real-time Updates**: Activity changes visible to players
- **Smooth Transitions**: Seamless activity switching

## API Endpoints

### Activity Management
- **GET /activity/manifest**: Get all available activities
- **GET /activity/locations**: Get all locations with tags
- **POST /activity/trigger**: Manually trigger activity for testing

### Monitoring
- **GET /activity/status/{agentId}**: Get current activity status
- **GET /activity/history/{agentId}**: Get activity history
- **GET /activity/queue/{agentId}**: Get activity queue

## Future Enhancements

### Advanced Activity Types
- **Conditional Activities**: Activities that depend on game state
- **Collaborative Activities**: Multi-agent activities
- **Timed Activities**: Activities with specific timing requirements

### Enhanced Location System
- **Dynamic Locations**: Locations that change based on game state
- **Occupancy Tracking**: Prevent overcrowding of locations
- **Weather Effects**: Location preferences based on weather

### AI Integration
- **LLM Activity Generation**: AI-generated activity descriptions
- **Behavioral Learning**: Activities adapt based on outcomes
- **Social Dynamics**: Activities influenced by relationships

## Conclusion

The Activity System provides a robust, flexible framework for NPC behavior in Heartwood Valley. Its comprehensive activity type system, intelligent location matching, and seamless integration with the game server create believable, autonomous NPCs that enhance the player experience through natural, goal-oriented behaviors.

The system's architecture supports easy extension for new activity types and locations while maintaining high performance through efficient algorithms and caching strategies. This foundation enables the creation of a living, breathing world where NPCs pursue their own goals and interact meaningfully with players and each other. 