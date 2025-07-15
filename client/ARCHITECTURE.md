# Client Architecture

## Overview
The client is a **Phaser 3** web-based game that provides the user interface for Heartwood Valley. It handles rendering, input management, multiplayer synchronization, and NPC interactions. Built with TypeScript for type safety and maintainability.

## Technology Stack
- **Phaser 3**: 2D game framework with WebGL/Canvas rendering
- **TypeScript**: Type-safe development
- **Vite**: Fast development server and build tool
- **Colyseus.js**: WebSocket client for multiplayer
- **PixiJS**: Underlying renderer (via Phaser)
- **CSS3**: Styling and UI components

## Core Architecture

### 1. Application Entry Point (`src/main.ts`)
```typescript
Simple initialization:
- Waits for DOM content loaded
- Starts the Phaser game instance
- Connects to specified container element
```

### 2. Game Configuration (`src/game/main.ts`)
```typescript
Phaser Game Configuration:
- Dimensions: 1600x1200 (large viewport)
- Auto-detect renderer: WebGL fallback to Canvas
- Physics: Arcade physics with no gravity
- Pixel Art: Optimized for crisp pixel graphics
- Scale: Fit container with center alignment
- Scene registration: PreloaderScene → GameScene → UIScene
```

## Scene Architecture

### 1. PreloaderScene (`src/game/scenes/PreloaderScene.ts`)
**Purpose**: Asset loading and initialization

**Key Features:**
- **Asset Loading**: Spritesheets, tilemaps, audio files
- **Loading Progress**: Visual progress indicator
- **Asset Validation**: Ensures all assets loaded correctly
- **Initialization**: Prepares game systems

**Asset Types:**
- **Spritesheets**: Player and NPC animations
- **Tilemaps**: World geometry and collision data
- **Static Assets**: Backgrounds, UI elements
- **Audio**: Sound effects and music (future)

### 2. GameScene (`src/game/scenes/GameScene.ts`)
**Purpose**: Main game world and gameplay

**Key Components:**
- **World Rendering**: Tilemap rendering with multiple layers
- **Player System**: Player movement and animation
- **NPC System**: Non-player character rendering and interaction
- **Multiplayer**: Colyseus integration for real-time sync
- **Input Handling**: Keyboard and mouse input processing

**Architecture Layers:**
```
Rendering Layer: Tilemap → Players → NPCs → Effects
Logic Layer: Input → Physics → State → Network
```

### 3. UIScene (`src/game/scenes/UIScene.ts`)
**Purpose**: User interface overlays

**Features:**
- **Chat System**: Player communication
- **Inventory**: Item management UI
- **Dialogue System**: NPC conversation interface
- **Menus**: Game menus and settings
- **HUD**: Health, energy, and status indicators

## Component Architecture

### 1. Input Management (`src/game/input/InputManager.ts`)
**Centralized Input Processing:**

**Features:**
- **Keyboard Input**: WASD/Arrow key movement
- **Mouse Input**: Click interactions and UI
- **Touch Support**: Mobile-friendly controls (future)
- **Input Buffering**: Smooth input handling
- **Context Sensitivity**: Different input modes

**Key Methods:**
- `setupKeyboard()`: Initialize keyboard controls
- `setupMouse()`: Initialize mouse controls
- `getMovementInput()`: Get current movement state
- `handleInteraction()`: Process interaction inputs

### 2. Player Controller (`src/game/controllers/PlayerController.ts`)
**Player Entity Management:**

**Features:**
- **Movement System**: 8-directional movement
- **Animation System**: Directional character animations
- **State Management**: Player state synchronization
- **Collision Detection**: World collision handling
- **Interpolation**: Smooth movement rendering

**Key Methods:**
- `update()`: Main update loop
- `move()`: Handle movement input
- `animate()`: Manage animation states
- `syncWithServer()`: Server state synchronization

### 3. Movement Controller (`src/game/controllers/MovementController.ts`)
**Movement Logic:**

**Features:**
- **Velocity-based Movement**: Smooth acceleration/deceleration
- **Collision Prediction**: Look-ahead collision detection
- **Path Validation**: Ensure valid movement paths
- **Network Optimization**: Efficient movement updates

### 4. Map Manager (`src/game/maps/MapManager.ts`)
**World Management:**

**Features:**
- **Tilemap Rendering**: Multi-layer map rendering
- **Collision Detection**: Client-side collision validation
- **Dynamic Loading**: Efficient map loading
- **Layer Management**: Background, collision, decoration layers

**Key Methods:**
- `createMap()`: Initialize tilemap
- `setupCollision()`: Configure collision detection
- `isWalkable()`: Check tile walkability
- `getSpawnPoints()`: Get valid spawn locations

### 5. Dialogue Manager (`src/game/ui/DialogueManager.ts`)
**NPC Interaction System:**

**Features:**
- **Conversation UI**: Rich dialogue interface
- **Text Rendering**: Typewriter effect text display
- **Response Options**: Multiple choice dialogue
- **Animation**: Character portraits and emotions
- **History**: Conversation history tracking

**Key Methods:**
- `startConversation()`: Initialize dialogue
- `displayMessage()`: Show NPC message
- `showOptions()`: Display player choices
- `endConversation()`: Clean up dialogue state

## Network Architecture

### Multiplayer Integration (Colyseus)
```typescript
Connection Flow:
1. Client connects to game server
2. Join or create room
3. Receive initial game state
4. Listen for state changes
5. Send player inputs
6. Handle disconnections
```

### State Synchronization
- **Player Positions**: Real-time position updates
- **NPC States**: Agent position and activity sync
- **World Events**: Shared world state changes
- **Chat Messages**: Real-time communication

### Network Optimization
- **State Prediction**: Client-side prediction
- **Lag Compensation**: Input delay compensation
- **Bandwidth Management**: Efficient data transmission
- **Reconnection**: Automatic reconnection handling

## Rendering Architecture

### Layer System
```
Z-Index Order (bottom to top):
1. Background Layer: Terrain and scenery
2. Collision Layer: Invisible collision detection
3. Object Layer: Interactive world objects
4. Character Layer: Players and NPCs
5. Effect Layer: Particles and animations
6. UI Layer: Interface elements
```

### Animation System
- **Sprite Sheets**: Efficient animation storage
- **Animation States**: Idle, walking, running, interaction
- **Directional Animations**: 4-direction character movement
- **Frame Management**: Optimized frame updates

### Camera System
- **Follow Camera**: Smooth player following
- **Zoom Control**: Dynamic zoom levels
- **Bounds Checking**: Camera boundary constraints
- **Smooth Transitions**: Eased camera movement

## Performance Optimizations

### Rendering Performance
- **Culling**: Off-screen object culling
- **Batching**: Sprite batching for efficiency
- **Texture Atlasing**: Reduced draw calls
- **Object Pooling**: Reusable game objects

### Memory Management
- **Asset Cleanup**: Proper texture disposal
- **Scene Management**: Efficient scene transitions
- **Garbage Collection**: Minimize memory allocations
- **Resource Monitoring**: Memory usage tracking

### Network Performance
- **Update Frequency**: Optimized update rates
- **Data Compression**: Efficient data transmission
- **Prediction**: Client-side prediction
- **Batching**: Input and state batching

## Error Handling & Resilience

### Connection Handling
- **Reconnection Logic**: Automatic reconnection
- **Offline Mode**: Graceful degradation
- **Error Recovery**: State recovery on reconnect
- **Timeout Handling**: Connection timeout management

### Asset Loading
- **Fallback Assets**: Default asset loading
- **Retry Logic**: Asset loading retry
- **Error Reporting**: Asset loading errors
- **Progressive Loading**: Lazy asset loading

### User Experience
- **Loading States**: Clear loading indicators
- **Error Messages**: User-friendly error messages
- **Graceful Degradation**: Functionality fallbacks
- **Performance Monitoring**: Client-side performance tracking

## Integration Points

### Game Server Integration
- **Real-time Sync**: WebSocket communication
- **State Management**: Server-authoritative state
- **Input Validation**: Server-side validation
- **Event Handling**: Server event processing

### Web API Integration
- **NPC Interactions**: HTTP API communication
- **Authentication**: Future JWT integration
- **Data Persistence**: Save/load functionality
- **Analytics**: Usage tracking

### Database Integration
- **Indirect Access**: Via web API
- **Caching**: Client-side data caching
- **Offline Storage**: Local storage utilization
- **Sync Management**: Data synchronization

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to localhost:5173
# Hot reload for instant updates
```

### Build Process
```bash
# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

### Development Tools
- **Vite DevServer**: Fast development server
- **TypeScript**: Type checking and IntelliSense
- **Hot Reload**: Instant code updates
- **Source Maps**: Debugging support

## Future Enhancements (Sprint 2+)

### Advanced Features
- **Mobile Support**: Touch controls and responsive design
- **Audio System**: Sound effects and music
- **Inventory System**: Item management interface
- **Crafting System**: Item crafting interface
- **Settings Menu**: Game configuration options

### Performance Improvements
- **WebGL Optimization**: Advanced rendering features
- **Asset Streaming**: Dynamic asset loading
- **Code Splitting**: Modular code loading
- **Service Worker**: Offline functionality

### User Experience
- **Accessibility**: Screen reader support
- **Internationalization**: Multi-language support
- **Customization**: User interface customization
- **Analytics**: User behavior tracking

## Testing Strategy

### Unit Testing
- **Component Testing**: Individual component testing
- **Logic Testing**: Game logic validation
- **Utility Testing**: Helper function testing
- **Mock Testing**: External dependency mocking

### Integration Testing
- **Network Testing**: Multiplayer functionality
- **API Testing**: Web API integration
- **Performance Testing**: Frame rate and memory
- **Cross-browser Testing**: Browser compatibility

### User Testing
- **Gameplay Testing**: User experience validation
- **Accessibility Testing**: Accessibility compliance
- **Performance Testing**: Real-world performance
- **Device Testing**: Multiple device support

## Monitoring & Analytics

### Performance Monitoring
- **Frame Rate**: FPS tracking and reporting
- **Memory Usage**: Memory consumption monitoring
- **Network Latency**: Connection quality tracking
- **Error Tracking**: Client-side error reporting

### User Analytics
- **Usage Patterns**: User behavior analysis
- **Feature Usage**: Feature adoption tracking
- **Performance Metrics**: User experience metrics
- **Conversion Tracking**: Goal completion tracking

This architecture provides a solid foundation for the client-side game experience, with efficient rendering, smooth multiplayer integration, and robust error handling. 