# Client Architecture Documentation

## Overview

The Client Architecture in Heartwood Valley is built on **Phaser 3**, a powerful 2D game framework. The client handles rendering, input management, multiplayer synchronization, and provides the visual interface for players to interact with the autonomous NPC world. Built with TypeScript for type safety and maintainability.

## Architecture

### Core Components

#### 1. Application Entry Point (`src/main.ts`)
- **Purpose**: Bootstrap the application
- **Features**:
  - DOM content loading detection
  - Phaser game instance initialization
  - Container element connection

#### 2. Game Configuration (`src/game/main.ts`)
- **Purpose**: Configure Phaser game instance
- **Features**:
  - 1600x1200 viewport (large for better visibility)
  - Auto-detect renderer (WebGL with Canvas fallback)
  - Arcade physics with no gravity (top-down game)
  - Pixel art optimization for crisp graphics
  - Scene registration and management

#### 3. Scene Management
- **PreloaderScene**: Asset loading and initialization
- **GameScene**: Main game world and gameplay
- **UIScene**: User interface overlays and HUD

## Scene Architecture

### 1. PreloaderScene (`src/game/scenes/PreloaderScene.ts`)

#### Purpose
Asset loading and game initialization

#### Key Features
- **Asset Loading**: Spritesheets, tilemaps, audio files
- **Loading Progress**: Visual progress indicator
- **Asset Validation**: Ensures all assets loaded correctly
- **Map Integration**: Loads map into MapManager

#### Asset Types
```typescript
// Core assets loaded
this.load.tilemapTiledJSON('beacon_bay', 'assets/beacon_bay_map.json');
this.load.image('tileset', 'assets/tileset.png');
this.load.spritesheet('player', 'assets/Player.png', {
  frameWidth: 32,
  frameHeight: 32,
  endFrame: 23
});
this.load.json('beacon_bay_locations', 'assets/beacon_bay_locations.json');
```

### 2. GameScene (`src/game/scenes/GameScene.ts`)

#### Purpose
Main game world and gameplay logic

#### Key Components
- **World Rendering**: Tilemap rendering with collision
- **Player System**: Movement, animation, and input handling
- **NPC System**: Real-time NPC display and interaction
- **Multiplayer**: Colyseus WebSocket integration
- **Camera System**: Smooth following and zoom controls

#### Architecture Layers
```
Rendering Layer: Tilemap → Players → NPCs → Effects
Logic Layer: Input → Physics → State → Network
```

#### World Creation
```typescript
private createWorld() {
  const map = this.make.tilemap({ key: 'beacon_bay' });
  const tileset = map.addTilesetImage('tileset', 'tileset', 16, 16);
  const groundLayer = map.createLayer('ground', tileset);
  
  // Set up camera with proper bounds
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  this.cameras.main.setZoom(2);
  this.cameras.main.setLerp(0.25, 0.25);
}
```

#### NPC System Integration
```typescript
private updateAgents(agentStates: any) {
  agentStates.forEach((agent: any, agentId: string) => {
    const existingAgent = this.npcs.get(agentId);
    
    if (existingAgent) {
      // Update existing agent position and activity
      existingAgent.sprite.x = agent.x * 16;
      existingAgent.sprite.y = agent.y * 16;
      existingAgent.actionLabel.setText(agent.currentActivity || 'idle');
    } else {
      // Create new agent
      this.createAgent(agentId, agent);
    }
  });
}
```

### 3. UIScene (`src/game/scenes/UIScene.ts`)

#### Purpose
User interface overlays and HUD

#### Key Features
- **Game HUD**: Time, day, speed indicators
- **Chat System**: Player communication interface
- **Dialogue System**: NPC conversation interface
- **Debug Panel**: Development tools and NPC monitoring
- **Real-time Updates**: Game state display

#### HUD Components
```typescript
// Game time display
this.clockText = this.add.text(280, 10, `Day ${this.currentGameDay} - ${this.currentGameTime}`, {
  fontSize: "18px",
  color: "#FFD700",
  backgroundColor: "rgba(0, 0, 0, 0.7)"
});

// Speed indicator
this.speedText = this.add.text(480, 10, `Speed: ${this.currentSpeedMultiplier}x`, {
  fontSize: "14px",
  color: "#00FF00"
});
```

## Component Architecture

### 1. Input Management (`src/game/input/InputManager.ts`)

#### Purpose
Centralized input processing system

#### Features
- **Keyboard Input**: WASD/Arrow key movement
- **Mouse Input**: Click interactions and UI
- **Input Buffering**: Smooth input handling
- **Context Sensitivity**: Different input modes
- **Rate Limiting**: Fixed-rate input sampling

#### Input Flow
```typescript
private handleInput(directions: string[], inputType: 'discrete' | 'continuous') {
  if (inputType === 'continuous' && directions.length > 0) {
    this.pendingInputs = [...directions];
    
    const now = Date.now();
    if (now - this.lastInputSent >= this.inputSendRate) {
      this.room.send('player_input', { 
        directions: this.pendingInputs,
        type: 'continuous',
        timestamp: now
      });
      this.lastInputSent = now;
    }
  }
}
```

### 2. Player Controller (`src/game/controllers/PlayerController.ts`)

#### Purpose
Player entity management and coordination

#### Features
- **Movement System**: 8-directional movement
- **Animation System**: Directional character animations
- **State Management**: Player state synchronization
- **Collision Detection**: Client-side collision validation
- **Interpolation**: Smooth movement rendering

#### Player Management
```typescript
export class PlayerController {
  private sprites: Map<string, Phaser.Physics.Arcade.Sprite>;
  private nameLabels: Map<string, Phaser.GameObjects.Text>;
  private movementControllers: Map<string, MovementController>;
  
  updatePlayer(sessionId: string, playerData: any) {
    const sprite = this.sprites.get(sessionId);
    if (sprite) {
      sprite.x = playerData.x;
      sprite.y = playerData.y;
      sprite.setVelocity(playerData.velocityX, playerData.velocityY);
    }
  }
}
```

### 3. Movement Controller (`src/game/controllers/MovementController.ts`)

#### Purpose
Movement logic and physics handling

#### Features
- **Velocity-based Movement**: Smooth acceleration/deceleration
- **Collision Prediction**: Look-ahead collision detection
- **Path Validation**: Ensure valid movement paths
- **Network Optimization**: Efficient movement updates

### 4. Map Manager (`src/game/maps/MapManager.ts`)

#### Purpose
World management and collision detection

#### Features
- **Tilemap Rendering**: Multi-layer map rendering
- **Collision Detection**: Client-side collision validation
- **Dynamic Loading**: Efficient map loading
- **Layer Management**: Background, collision, decoration layers

#### Map Integration
```typescript
private loadMapIntoManager() {
  const mapData = this.cache.json.get('beacon_bay');
  const locationData = this.cache.json.get('beacon_bay_locations');
  
  MapManager.getInstance().setMap('beacon_bay', mapData);
  MapManager.getInstance().setLocations('beacon_bay', locationData);
}
```

### 5. Dialogue Manager (`src/game/ui/DialogueManager.ts`)

#### Purpose
NPC interaction and conversation system

#### Features
- **Conversation UI**: Rich dialogue interface
- **Text Rendering**: Typewriter effect text display
- **Response Options**: Multiple choice dialogue
- **History Tracking**: Conversation history
- **Animation**: Character portraits and emotions

#### Conversation Flow
```typescript
private async sendMessage(message: string) {
  if (!this.currentNpcId) return;
  
  this.isWaitingForResponse = true;
  this.showTypingIndicator();
  
  const response = await fetch(`http://localhost:3000/npc/interact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      npcId: this.currentNpcId,
      message: message,
      characterId: this.playerCharacterId
    })
  });
  
  const result = await response.json();
  this.pollForResponse(result.jobId);
}
```

## Network Architecture

### Multiplayer Integration (Colyseus)

#### Connection Flow
```typescript
async connectToServer() {
  this.client = new Client(`ws://localhost:2567`);
  
  let username = localStorage.getItem('heartwoodUsername');
  if (!username) {
    username = prompt("Enter your username:") || `Player_${Date.now().toString().slice(-6)}`;
    localStorage.setItem('heartwoodUsername', username);
  }
  
  this.room = await this.client.joinOrCreate('heartwood_room', { name: username });
  this.myPlayerId = this.room.sessionId;
  
  this.room.onStateChange((state: any) => {
    this.handleStateChange(state);
  });
}
```

#### State Synchronization
```typescript
private handleStateChange(state: any) {
  // Update players
  if (state.players) {
    state.players.forEach((player: any, sessionId: string) => {
      this.playerController.updatePlayer(sessionId, player);
    });
  }
  
  // Update NPCs
  if (state.agents) {
    this.updateAgents(state.agents);
  }
  
  // Update game time
  if (state.currentGameTime) {
    this.currentGameTime = state.currentGameTime;
    this.game.events.emit('gameStateUpdate', {
      currentGameTime: this.currentGameTime,
      gameDay: state.gameDay,
      speedMultiplier: state.speedMultiplier
    });
  }
}
```

#### Network Optimization
- **State Prediction**: Client-side prediction for responsiveness
- **Lag Compensation**: Input delay compensation
- **Bandwidth Management**: Efficient data transmission
- **Reconnection**: Automatic reconnection handling

## Rendering Architecture

### Layer System
```
Z-Index Order (bottom to top):
1. Background Layer: Terrain and scenery
2. Object Layer: Interactive world objects
3. Character Layer: Players and NPCs
4. Effect Layer: Particles and animations
5. UI Layer: Interface elements
```

### Animation System
```typescript
// Player animation creation
createAnimations() {
  // Walking animations for all directions
  this.scene.anims.create({
    key: 'player_walk_down',
    frames: this.scene.anims.generateFrameNumbers('player', { start: 0, end: 2 }),
    frameRate: 8,
    repeat: -1
  });
  
  // Additional animations for up, left, right...
}
```

### Camera System
```typescript
// Camera configuration
this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
this.cameras.main.setZoom(2);
this.cameras.main.setLerp(0.25, 0.25); // Smooth following

// Dynamic camera controls
this.input.keyboard?.addKey('Q').on('down', () => {
  const currentZoom = this.cameras.main.zoom;
  this.cameras.main.setZoom(Math.max(0.5, currentZoom - 0.5));
});
```

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
- **Update Frequency**: Optimized update rates (10 Hz for continuous input)
- **Data Compression**: Efficient data transmission
- **Prediction**: Client-side prediction for responsiveness
- **Input Batching**: Batched input transmission

## Integration Points

### Game Server Integration

#### Real-time Synchronization
```typescript
// Send player input to server
this.room.send('player_input', { 
  directions: this.pendingInputs,
  type: 'continuous',
  timestamp: now
});

// Receive and process server updates
this.room.onStateChange((state: any) => {
  this.handleStateChange(state);
});
```

#### NPC Integration
```typescript
// Display NPC activities
private createAgent(agentId: string, agent: any) {
  const sprite = this.add.sprite(agent.x * 16, agent.y * 16, 'player');
  const nameLabel = this.add.text(agent.x * 16, agent.y * 16 - 20, agent.name);
  const actionLabel = this.add.text(agent.x * 16, agent.y * 16 + 20, agent.currentActivity || 'idle');
  
  this.npcs.set(agentId, {
    sprite, nameLabel, actionLabel,
    name: agent.name,
    x: agent.x,
    y: agent.y
  });
}
```

### Web API Integration

#### HTTP Communication
```typescript
// NPC conversation API
const response = await fetch(`http://localhost:3000/npc/interact`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    npcId: this.currentNpcId,
    message: message,
    characterId: this.playerCharacterId
  })
});
```

#### Debug API Integration
```typescript
// Debug panel API calls
async refreshDebugPanel() {
  const response = await fetch('http://localhost:3000/npc/list');
  const data = await response.json();
  
  this.updateDebugPanelContent(data.agents);
}
```

## Error Handling & Resilience

### Connection Handling
```typescript
this.room.onLeave((code: number) => {
  console.log("Left room with code:", code);
});

this.room.onError((code: number, message: string) => {
  console.error("Room error:", code, message);
});
```

### Asset Loading
```typescript
// Asset loading with error handling
this.load.on('loaderror', (file: any) => {
  console.error('Failed to load asset:', file.key);
});

this.load.on('complete', () => {
  console.log('All assets loaded successfully');
});
```

### Graceful Degradation
- **Offline Mode**: Graceful degradation when server unavailable
- **Fallback Assets**: Default assets when loading fails
- **Error Recovery**: State recovery mechanisms
- **User Feedback**: Clear error messages and loading states

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Game runs on localhost:5173
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
- **Vite DevServer**: Fast development server with HMR
- **TypeScript**: Type checking and IntelliSense
- **Hot Reload**: Instant code updates
- **Source Maps**: Debugging support

## Configuration

### Game Configuration
```typescript
const config: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1600,
  height: 1200,
  parent: "game-container",
  backgroundColor: "#1a1a1a",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [PreloaderScene, GameScene, UIScene],
};
```

### Input Configuration
```typescript
// Input sampling rate
private inputSendRate: number = 100; // 10 Hz

// Camera controls
this.input.keyboard?.addKey('Q').on('down', () => {
  this.cameras.main.setZoom(Math.max(0.5, currentZoom - 0.5));
});
```

## Future Enhancements

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
```typescript
// Component testing example
describe('PlayerController', () => {
  it('should update player position', () => {
    const controller = new PlayerController(mockScene);
    controller.updatePlayer('player1', { x: 100, y: 200 });
    // Assert position update
  });
});
```

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
```typescript
// Frame rate monitoring
this.time.addEvent({
  delay: 1000,
  callback: () => {
    console.log(`FPS: ${this.game.loop.actualFps}`);
  },
  loop: true
});
```

### User Analytics
- **Usage Patterns**: User behavior analysis
- **Feature Usage**: Feature adoption tracking
- **Performance Metrics**: User experience metrics
- **Error Tracking**: Client-side error reporting

## Conclusion

The Client Architecture provides a robust, scalable foundation for the Heartwood Valley game client. Built on Phaser 3 with TypeScript, it delivers:

- **High Performance**: Optimized rendering and network communication
- **Responsive UI**: Smooth, interactive user interface
- **Seamless Multiplayer**: Real-time synchronization with game server
- **Rich NPC Integration**: Visual display of autonomous agent behaviors
- **Extensible Architecture**: Easy to extend with new features

The modular design allows for easy maintenance and feature addition while maintaining performance. The integration with the game server and web API creates a cohesive user experience that showcases the sophisticated NPC AI systems.

Future enhancements will focus on mobile support, advanced audio/visual features, and improved accessibility to reach a broader audience while maintaining the core vision of a living, breathing world populated by autonomous agents. 