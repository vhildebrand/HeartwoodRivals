# Game Server Architecture

## Overview
The game server is built on **Colyseus**, a multiplayer framework for Node.js that provides real-time, authoritative game state management. It handles player connections, movement synchronization, and world state management for the Heartwood Valley game.

## Technology Stack
- **Colyseus**: Real-time multiplayer framework
- **WebSocket**: Real-time communication transport
- **TypeScript**: Type-safe development
- **@colyseus/schema**: Binary serialization for efficient state synchronization

## Core Components

### 1. Server Entry Point (`src/index.ts`)
```typescript
- Creates HTTP server and Colyseus game server
- Registers the HeartwoodRoom
- Listens on port 2567 (default Colyseus port)
- Accessible from all interfaces (0.0.0.0) for Docker compatibility
```

### 2. Game Room (`src/rooms/HeartwoodRoom.ts`)
The main game room that manages the multiplayer session:

**Key Features:**
- **Max Clients**: 10 players per room
- **Game Loop**: 60 FPS server updates
- **Map Integration**: Uses MapManager for collision detection
- **Player Management**: Handles join/leave events and player spawning

**Core Methods:**
- `onCreate()`: Initialize room and load map data
- `onJoin()`: Handle player connection and spawn
- `onLeave()`: Handle player disconnection
- `onMessage()`: Process player inputs (movement, interactions)
- `gameLoop()`: 60 FPS server tick for state updates

### 3. Game State Schema (`src/rooms/schema/index.ts`)
Defines the synchronized game state using Colyseus Schema:

```typescript
Player Schema:
- id: string (session ID)
- name: string (player name)
- x, y: number (world position)
- velocityX, velocityY: number (movement velocity)
- direction: number (0=down, 1=up, 2=left, 3=right)
- isMoving: boolean (movement state)
- lastUpdate: number (timestamp)

GameState Schema:
- players: MapSchema<Player> (all connected players)
- timestamp: number (server timestamp)
- mapWidth, mapHeight: number (map dimensions)
- tileSize: number (tile size in pixels)
```

### 4. Map Management (`src/maps/MapManager.ts`)
Handles world collision detection and map data:

**Features:**
- **Collision Detection**: Validates player movement against map boundaries
- **Map Loading**: Loads tilemap data from JSON files
- **Tile Validation**: Checks if tiles are walkable
- **Multi-layer Support**: Handles different map layers (collision, decoration, etc.)

**Key Methods:**
- `isTileWalkable(mapId, x, y)`: Check if position is valid
- `getTileCollision(mapId, x, y)`: Get collision data for tile
- `loadMap(mapId)`: Load map data from file system

### 5. Movement System
**Real-time Movement Processing:**
- **Input Validation**: Server validates all movement requests
- **Collision Detection**: Prevents invalid movements
- **Smooth Interpolation**: Velocity-based movement for smooth client rendering
- **Rate Limiting**: Controls input frequency to prevent spam

**Movement Flow:**
1. Client sends movement input
2. Server validates against collision map
3. Server updates player velocity and position
4. State changes broadcast to all clients
5. Clients interpolate smooth movement

## Data Flow Architecture

### Player Connection Flow
```
Client → WebSocket Connection → HeartwoodRoom.onJoin()
↓
Create Player Schema → Set Starting Position → Add to GameState
↓
Broadcast New Player State → All Clients Update
```

### Movement Flow
```
Client Input → room.send("move", direction)
↓
HeartwoodRoom.onMessage("move") → MapManager.isTileWalkable()
↓
Update Player Position & Velocity → GameState Schema
↓
Colyseus Auto-Broadcast → All Clients Receive Update
```

### Game Loop Flow
```
60 FPS Server Tick → Update Player Positions
↓
Apply Velocity to Positions → Validate Boundaries
↓
Update GameState.timestamp → Broadcast Changes
```

## Network Architecture

### WebSocket Communication
- **Transport**: WebSocket with binary patching
- **State Synchronization**: Automatic via Colyseus Schema
- **Message Types**: Movement, interaction, chat (future)
- **Error Handling**: Graceful disconnect handling

### State Management
- **Authoritative Server**: All game state changes validated server-side
- **Binary Patching**: Only changes are sent to clients
- **Efficient Updates**: Schema-based serialization minimizes bandwidth

## Performance Optimizations

### Server Performance
- **Fixed-rate Updates**: 60 FPS game loop prevents frame drops
- **Efficient Collision**: O(1) map tile lookups
- **Memory Management**: Proper cleanup on player disconnect

### Network Performance
- **Binary Patching**: Minimal network traffic
- **State Compression**: Schema-based efficient serialization
- **Input Batching**: Rate-limited input processing

## Integration Points

### Database Integration
- **Future**: Player persistence and character data
- **NPCs**: Agent state synchronization (Sprint 2+)
- **World State**: Persistent world changes

### Web API Integration
- **NPC Interactions**: Communication with LLM service
- **Authentication**: JWT-based player authentication (future)
- **Inventory**: Item and economy management (future)

### Client Integration
- **Scene Management**: Coordinates with Phaser scenes
- **Input Processing**: Handles player input validation
- **State Rendering**: Provides data for smooth client rendering

## Security Considerations

### Server Authority
- **Input Validation**: All player actions validated server-side
- **Rate Limiting**: Prevents input flooding
- **Position Validation**: Prevents teleporting/cheating

### Data Protection
- **Session Management**: Secure session handling
- **Input Sanitization**: Prevents injection attacks
- **Error Handling**: Graceful error responses

## Development Workflow

### Local Development
```bash
# Start in development mode
npm run dev

# Server runs on localhost:2567
# Auto-restart on code changes (nodemon)
```

### Docker Deployment
```bash
# Built via docker-compose
# Exposed on port 2567
# Connects to other services via Docker network
```

## Future Enhancements (Sprint 2+)

### Agent Integration
- **NPC Management**: Autonomous agent movement
- **AI Behavior**: Integration with Agent Management System
- **Social Interactions**: Agent-player and agent-agent interactions

### Advanced Features
- **Persistence**: Player data and world state persistence
- **Inventory System**: Item management and trading
- **Chat System**: Real-time messaging
- **Events**: Server-triggered world events

## Monitoring & Debugging

### Logging
- **Connection Events**: Player join/leave tracking
- **Movement Validation**: Collision detection logs
- **Error Tracking**: Comprehensive error logging

### Performance Metrics
- **Room Capacity**: Player count monitoring
- **Update Frequency**: Game loop performance
- **Memory Usage**: Server resource monitoring

This architecture provides a solid foundation for the multiplayer aspects of Heartwood Valley, with clean separation of concerns and efficient real-time communication. 