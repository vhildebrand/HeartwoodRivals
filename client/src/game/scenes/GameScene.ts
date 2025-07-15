// client/src/scenes/GameScene.ts
import { Scene } from "phaser";
import { Client } from "colyseus.js";

export class GameScene extends Scene {
    private client: Client;
    private room: any;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys: any;
    private lastInputState: any;
    private playerSprites: Map<string, Phaser.Physics.Arcade.Sprite>;
    private myPlayerId: string | null = null;
    private wallsLayer: Phaser.Tilemaps.TilemapLayer | null = null;

    constructor() {
        super("GameScene");
    }

    create() {
        console.log("=== GameScene.create() started ===");
        
        // Sub-task 3.2: Render the Map
        
        // Create the tilemap object
        console.log("Creating tilemap...");
        const map = this.make.tilemap({ key: 'town' });
        
        // Add the tileset to the map with correct tile size
        // The tileset uses 16x16 tiles as specified in the JSON
        console.log("Adding tileset...");
        const tileset = map.addTilesetImage('cute_fantasy', 'cute_fantasy', 16, 16);
        
        if (!tileset) {
            console.error("Failed to load tileset");
            return;
        }
        
        // Render the Ground layer
        const groundLayer = map.createLayer('Ground', tileset);
        
        // Render the Walls layer (if it exists)
        this.wallsLayer = map.createLayer('Walls', tileset);
        
        // Also render the Above layer if it exists
        const aboveLayer = map.createLayer('Above', tileset);
        
        // Set up camera to follow the map
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        
        console.log("GameScene: Map loaded with available layers");
        console.log("Available layers:", map.layers.map(layer => layer.name));

        // Initialize player sprites map
        this.playerSprites = new Map();

        // Sub-task 6.2: Create animations
        this.createAnimations();

        // Sub-task 4.1: Create Input Handler
        this.setupInputHandlers();

        // Setup click handlers for logging
        this.setupClickHandlers();

        // Sub-task 3.3: Connect to Colyseus
        this.connectToServer();
    }

    async connectToServer() {
        console.log("=== Starting connection to Colyseus server ===");
        
        try {
            // Create Colyseus client with proper WebSocket URL
            // Handle different environments (Docker vs local development)
            let endpoint: string;
            
            // The browser always connects to localhost:2567 since Docker exposes the port to the host
            endpoint = 'localhost:2567';
            
            console.log(`Attempting to connect to Colyseus server at: ws://${endpoint}`);
            console.log(`Current hostname: ${window.location.hostname}`);
            
            // Create client with explicit WebSocket URL
            console.log("Creating Colyseus client...");
            this.client = new Client(`ws://${endpoint}`);
            
            // Join the heartwood_room
            console.log("Joining heartwood_room...");
            this.room = await this.client.joinOrCreate('heartwood_room');
            
            console.log("Connected to Colyseus server, joined heartwood_room");
            
            // Store our player ID
            this.myPlayerId = this.room.sessionId;
            
            // Set up onStateChange listener for player synchronization
            this.room.onStateChange((state: any) => {
                this.handleStateChange(state);
            });
            
            // Handle when the room is left
            this.room.onLeave((code: number) => {
                console.log("Left room with code:", code);
            });
            
            // Handle errors
            this.room.onError((code: number, message: string) => {
                console.error("Room error:", code, message);
            });
            
        } catch (error) {
            console.error("Failed to connect to Colyseus server:", error);
            
            // More specific error handling
            if (error instanceof Error) {
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            
            console.error("Make sure the game server is running on port 2567");
            
            // Don't retry automatically to avoid infinite loops
            console.log("Connection failed. You can refresh the page to try again.");
        }
    }

    private setupInputHandlers() {
        // Create cursor keys for arrow key input
        this.cursors = this.input.keyboard!.createCursorKeys();
        
        // Create WASD keys for alternative input
        this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D');
        
        // Initialize last input state to track changes
        this.lastInputState = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        
        console.log("GameScene: Input handlers initialized");
    }

    private setupClickHandlers() {
        // Add click handler for the entire game scene
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handleClick(pointer);
        });

        // Add right-click handler
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.handleRightClick(pointer);
            }
        });

        console.log("GameScene: Click handlers initialized");
    }

    private handleClick(pointer: Phaser.Input.Pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 16);
        const tileY = Math.floor(worldPoint.y / 16);

        // Check if click is on another player
        let clickedPlayer: { sessionId: string; name: string } | null = null;
        this.playerSprites.forEach((sprite, sessionId) => {
            if (sprite.getBounds().contains(worldPoint.x, worldPoint.y)) {
                clickedPlayer = {
                    sessionId: sessionId,
                    name: sprite.getData('playerName')
                };
            }
        });

        // Client-side logging
        console.log(`[CLIENT] Click: Screen(${pointer.x}, ${pointer.y}) -> World(${worldPoint.x}, ${worldPoint.y}) -> Tile(${tileX}, ${tileY})`);
        if (clickedPlayer) {
            console.log(`  -> Clicked on player: ${(clickedPlayer as any).name} (${(clickedPlayer as any).sessionId})`);
        }

        // Send click information to server
        if (this.room) {
            this.room.send('click', {
                screenX: pointer.x,
                screenY: pointer.y,
                worldX: worldPoint.x,
                worldY: worldPoint.y,
                tileX: tileX,
                tileY: tileY,
                button: pointer.leftButtonDown() ? 'left' : 'right',
                timestamp: Date.now(),
                clickedPlayer: clickedPlayer
            });
        }
    }

    private handleRightClick(pointer: Phaser.Input.Pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 16);
        const tileY = Math.floor(worldPoint.y / 16);

        // Client-side logging for right-click
        console.log(`Client Right-Click: Screen(${pointer.x}, ${pointer.y}) -> World(${worldPoint.x}, ${worldPoint.y}) -> Tile(${tileX}, ${tileY})`);

        // Send right-click information to server
        if (this.room) {
            this.room.send('rightclick', {
                screenX: pointer.x,
                screenY: pointer.y,
                worldX: worldPoint.x,
                worldY: worldPoint.y,
                tileX: tileX,
                tileY: tileY,
                timestamp: Date.now()
            });
        }
    }

    private createAnimations() {
        // Sub-task 6.2: Implement Animations
        // Create animations for all 4 directions + idle
        // Improved animation setup with error handling and frame validation
        
        try {
            // Get the player texture to check available frames
            const playerTexture = this.textures.get('player');
            const frameCount = playerTexture.frameTotal;
            
            console.log(`GameScene: Player sprite has ${frameCount} frames available`);
            
            // Create animations with safe frame ranges
            // Idle animation (frame 0)
            this.anims.create({
                key: 'idle',
                frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
                frameRate: 1,
                repeat: -1
            });
            
            // Walk down animation - use frame 0 if not enough frames
            const walkDownFrames = frameCount > 3 ? { start: 1, end: 3 } : { start: 0, end: 0 };
            this.anims.create({
                key: 'walk_down',
                frames: this.anims.generateFrameNumbers('player', walkDownFrames),
                frameRate: 8,
                repeat: -1
            });
            
            // Walk up animation - fallback to frame 0 if not enough frames
            const walkUpFrames = frameCount > 6 ? { start: 4, end: 6 } : { start: 0, end: 0 };
            this.anims.create({
                key: 'walk_up',
                frames: this.anims.generateFrameNumbers('player', walkUpFrames),
                frameRate: 8,
                repeat: -1
            });
            
            // Walk left animation - fallback to frame 0 if not enough frames  
            const walkLeftFrames = frameCount > 9 ? { start: 7, end: 9 } : { start: 0, end: 0 };
            this.anims.create({
                key: 'walk_left',
                frames: this.anims.generateFrameNumbers('player', walkLeftFrames),
                frameRate: 8,
                repeat: -1
            });
            
            // Walk right animation - fallback to frame 0 if not enough frames
            const walkRightFrames = frameCount > 12 ? { start: 10, end: 12 } : { start: 0, end: 0 };
            this.anims.create({
                key: 'walk_right',
                frames: this.anims.generateFrameNumbers('player', walkRightFrames),
                frameRate: 8,
                repeat: -1
            });
            
            console.log("GameScene: Animations created successfully");
            console.log("  - idle: frame 0");
            console.log(`  - walk_down: frames ${walkDownFrames.start}-${walkDownFrames.end}`);
            console.log(`  - walk_up: frames ${walkUpFrames.start}-${walkUpFrames.end}`);
            console.log(`  - walk_left: frames ${walkLeftFrames.start}-${walkLeftFrames.end}`);
            console.log(`  - walk_right: frames ${walkRightFrames.start}-${walkRightFrames.end}`);
            
        } catch (error) {
            console.error("GameScene: Error creating animations:", error);
            // Fallback: create a simple idle animation
            this.anims.create({
                key: 'idle',
                frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
                frameRate: 1,
                repeat: -1
            });
        }
    }

    private handleStateChange(state: any) {
        // Sub-task 6.1: Spawn and Update Player Sprites
        if (state.players) {
            // Handle player updates
            state.players.forEach((player: any, sessionId: string) => {
                this.updatePlayerSprite(sessionId, player);
            });
            
            // Remove sprites for players who left
            this.playerSprites.forEach((sprite, sessionId) => {
                if (!state.players.has(sessionId)) {
                    sprite.destroy();
                    this.playerSprites.delete(sessionId);
                    console.log(`Removed sprite for player ${sessionId}`);
                }
            });
        }
    }

    private updatePlayerSprite(sessionId: string, playerData: any) {
        let sprite = this.playerSprites.get(sessionId);
        
        if (!sprite) {
            // Create new sprite for this player
            sprite = this.physics.add.sprite(playerData.x, playerData.y, 'player');
            sprite.setOrigin(0.5, 0.5);
            
            // Scale sprite appropriately for the game world
            sprite.setScale(1);
            
            // Set sprite properties
            sprite.setData('sessionId', sessionId);
            sprite.setData('playerName', playerData.name || sessionId);
            
            // Add to physics world
            this.physics.world.enable(sprite);
            
            // Set physics body size (adjust based on your sprite)
            if (sprite.body) {
                sprite.body.setSize(12, 12); // Slightly smaller than 16x16 for better collision feel
            }
            
            // Sub-task 6.4: Implement Client-Side Collision
            // Set up collision detection for water tiles (simplified approach)
            if (this.wallsLayer) {
                // For now, we'll use a simple approach where we don't set up tilemap collision
                // since the current tilemap doesn't have collision properties
                // The server handles the authoritative collision detection
                console.log("Walls layer available for collision (server-authoritative)");
            }
            
            // Start with idle animation
            sprite.play('idle');
            
            // Store sprite
            this.playerSprites.set(sessionId, sprite);
            
            console.log(`Created sprite for player ${sessionId} (${playerData.name || 'Unknown'}) at (${playerData.x}, ${playerData.y})`);
            
            // Highlight the current player's sprite
            if (sessionId === this.myPlayerId) {
                sprite.setTint(0x00ff00); // Green tint for current player
                console.log("Current player sprite highlighted in green");
            }
        } else {
            // Update existing sprite position
            sprite.setPosition(playerData.x, playerData.y);
        }
        
        // Update sprite properties and animations
        if (playerData.direction !== undefined) {
            sprite.setData('direction', playerData.direction);
            sprite.setData('isMoving', playerData.isMoving);
            
            // Sub-task 6.3: Play Animations
            this.updatePlayerAnimation(sprite, playerData.direction, playerData.isMoving);
        }
    }

    private updatePlayerAnimation(sprite: Phaser.Physics.Arcade.Sprite, direction: number, isMoving: boolean) {
        // Direction mapping: 0=down, 1=up, 2=left, 3=right
        const directionAnimations = ['walk_down', 'walk_up', 'walk_left', 'walk_right'];
        
        if (isMoving) {
            const animationKey = directionAnimations[direction];
            if (animationKey && sprite.anims.currentAnim?.key !== animationKey) {
                sprite.play(animationKey);
            }
        } else {
            // Play idle animation if not moving
            if (sprite.anims.currentAnim?.key !== 'idle') {
                sprite.play('idle');
            }
        }
    }

    private getInputState(): any {
        return {
            up: this.cursors.up.isDown || this.wasdKeys.W.isDown,
            down: this.cursors.down.isDown || this.wasdKeys.S.isDown,
            left: this.cursors.left.isDown || this.wasdKeys.A.isDown,
            right: this.cursors.right.isDown || this.wasdKeys.D.isDown
        };
    }

    private handleInput() {
        if (!this.room) {
            // Only log this occasionally to avoid spam
            if (Math.random() < 0.001) {
                console.log("No room connection available for input");
            }
            return;
        }

        const currentInput = this.getInputState();
        
        // Check for input changes to avoid spamming the server
        ['up', 'down', 'left', 'right'].forEach(direction => {
            if (currentInput[direction] && !this.lastInputState[direction]) {
                // Key was just pressed
                console.log(`[INPUT] Key pressed: ${direction}`);
                this.room.send('move', { direction });
                console.log(`[INPUT] Sent move command: ${direction}`);
            }
        });
        
        // Update last input state
        this.lastInputState = { ...currentInput };
    }

    update() {
        // Sub-task 4.2: Handle input and send to server
        this.handleInput();
        
        // Log that the update loop is running (occasionally)
        if (Math.random() < 0.001) {
            console.log("Game update loop is running");
        }
    }
}