# Activity System Demo

This document demonstrates the new **Activity System** for Heartwood Rivals - a robust, abstract system that translates text activity descriptions into concrete, believable actions for NPCs.

## System Overview

The Activity System consists of four main components:

1. **World Location Registry** - Maps semantic names to physical coordinates
2. **Activity Manifest** - Defines the properties of all possible activities
3. **Activity Class** - State machine that manages individual activities
4. **Activity Manager** - Manages activities for each agent

## Key Features

### ✅ **Semantic Location Lookup**
Instead of hardcoding coordinates, agents can find locations by purpose:
```typescript
// Find locations for eating
const eatingLocations = locationRegistry.findLocationsByTags(['food', 'eating']);
// Returns: Bakery, Cafe, Tavern, etc.
```

### ✅ **Flexible Activity Definitions**
Activities are defined declaratively with all their properties:
```typescript
'eating': {
  activityType: ActivityType.STATIONARY,
  locationTags: ['food', 'eating'],
  animation: 'eat',
  duration: Duration.MEDIUM,
  priority: 7,
  interruptible: false,
  description: 'Eating a meal at a suitable location'
}
```

### ✅ **Multiple Activity Types**
- **STATIONARY**: Move to location, then perform action (eating, working, sleeping)
- **ROUTINE_MOVEMENT**: Follow movement patterns (pacing, patrolling, wandering)
- **GOTO_LOCATION**: Simple movement to specific locations
- **SOCIAL_INTERACTION**: Interact with other agents
- **CRAFTING**: Work-related activities with tools

### ✅ **Intelligent Activity Planning**
The system automatically:
- Finds appropriate locations for activities
- Plans pathfinding routes
- Manages state transitions
- Handles interruptions and priorities

## Usage Examples

### Example 1: Basic Activity Request
```typescript
// Agent requests to eat
const result = agent.activityManager.requestActivity({
  activityName: 'eating',
  priority: 7
});

// System automatically:
// 1. Finds nearest location with ['food', 'eating'] tags
// 2. Plans path to location
// 3. Moves agent to location
// 4. Plays eating animation
// 5. Completes after duration
```

### Example 2: Movement Activities
```typescript
// Agent wants to pace around neighborhood
agent.activityManager.requestActivity({
  activityName: 'pace_neighborhood',
  priority: 3
});

// System automatically:
// 1. Generates waypoints in a pacing pattern
// 2. Moves agent between waypoints
// 3. Continues for specified duration
```

### Example 3: Scheduled Activities
```typescript
// From PlanExecutor - scheduled activity at 12:00
agent.activityManager.handleScheduledActivity('lunch', '12:00');

// System resolves 'lunch' activity and executes it
```

## Activity Examples

### Eating Activities
- `eating` - General meal at any food location
- `breakfast` - Morning meal, prefers home locations
- `lunch` - Midday meal, any food location
- `dinner` - Evening meal, any food location

### Work Activities
- `working` - General work at business locations
- `smithing` - Blacksmith work at forge
- `crafting` - Creating/repairing items

### Movement Activities
- `pace_neighborhood` - Back and forth movement
- `patrol_area` - Rectangular patrol pattern
- `wander_town` - Random movement in public areas
- `go_to_town_square` - Direct movement to town square

### Social Activities
- `socializing` - General social interaction
- `meeting` - Formal meeting at business locations

### Rest Activities
- `sleeping` - Sleep at home
- `resting` - Short rest at home
- `relaxing` - Relaxation outdoors

## AI Agent Compatibility

The system is designed to be compatible with AI-generated activities:

```typescript
// AI generates: "The blacksmith should work on ship fittings"
const aiActivity = "work on ship fittings";

// System resolves to existing activity
const resolved = activityManifest.getActivity(aiActivity);
// Returns: 'smithing' activity with forge location

// Or AI generates: "Go meet the captain at the harbor"
const aiActivity2 = "meet captain at harbor";
// System can resolve this to socializing at harbor location
```

## Benefits

### 🎯 **For Pre-defined Schedules**
- Consistent behavior across all agents
- Easy to modify activity properties
- Automatic location resolution

### 🤖 **For AI-Generated Activities**
- Flexible activity name matching
- Fuzzy matching for natural language
- Extensible activity definitions

### 🎮 **For Game Development**
- Separation of concerns (what vs how)
- Easy to add new activities
- Robust error handling

## Code Structure

```
game-server/src/systems/
├── WorldLocationRegistry.ts    # Location lookup and tagging
├── ActivityManifest.ts        # Activity definitions and matching
├── Activity.ts               # Individual activity state machine
└── ActivityManager.ts        # Per-agent activity management
```

## Integration

The system integrates seamlessly with existing systems:

1. **PlanExecutor** - Uses ActivityManager for scheduled actions
2. **AgentStateMachine** - Activities transition agent states
3. **AgentMovementSystem** - Activities control agent movement
4. **Location Data** - Uses existing beacon_bay_locations.json

## Testing

Run the test script to see the system in action:
```bash
cd game-server
npm run test:activity-system
```

The test demonstrates:
- Location registry lookup
- Activity manifest resolution
- Activity manager functionality
- Complex activity sequences
- Debug information

## Future Enhancements

- **Dynamic Activity Creation**: Generate activities on-demand
- **Social Coordination**: Multi-agent activities
- **Conditional Activities**: Activities based on game state
- **Learning Activities**: Agents learn new activity patterns
- **Emotional Activities**: Activities affected by agent mood

This activity system provides the foundation for truly autonomous agents that can execute both pre-defined schedules and AI-generated activities with realistic, believable behavior. 