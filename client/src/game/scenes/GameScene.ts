import { Scene } from "phaser";
import { Client } from "colyseus.js";
import { InputManager } from "../input/InputManager";
import { PlayerController } from "../controllers/PlayerController";
import { MapManager } from "../maps/MapManager";

export class GameScene extends Scene {
    private client: Client;
    private room: any;
    private myPlayerId: string | null = null;
    private wallsLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    
    // New architecture components
    private inputManager: InputManager;
    private playerController: PlayerController;
    
    // Fixed-rate input sampling
    private lastInputSent: number = 0;
    private inputSendRate: number = 100; // Send input every 100ms (10 times per second)
    private pendingInputs: string[] = [];

    constructor() {
        super("GameScene");
    }

    create() {
        console.log("=== GameScene.create() started ===");
        
        // Create the game world
        this.createWorld();
        
        // Initialize controllers
        this.initializeControllers();
        
        // Connect to server
        this.connectToServer();
    }

    private createWorld() {
        // Create the tilemap object
        console.log("Creating tilemap...");
        const map = this.make.tilemap({ key: 'large_town' });
        
        // Add the tileset to the map
        console.log("Adding tileset...");
        const tileset = map.addTilesetImage('tileset', 'tileset', 16, 16);
        
        if (!tileset) {
            console.error("Failed to load tileset");
            return;
        }
        
        // Render layers
        const groundLayer = map.createLayer('Ground', tileset);
        this.wallsLayer = map.createLayer('Walls', tileset);
        const aboveLayer = map.createLayer('Above', tileset);
        
        // Set up camera with proper bounds
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        
        // Set camera zoom and smoothing
        this.cameras.main.setZoom(3); // Zoom in 3x
        this.cameras.main.setLerp(0.05, 0.05); // Reduced camera smoothing for better responsiveness
        
        // Set the camera viewport to the game size
        this.cameras.main.setViewport(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        console.log("GameScene: Large map loaded with available layers");
        console.log("Available layers:", map.layers.map(layer => layer.name));
        console.log(`Map dimensions: ${map.widthInPixels}x${map.heightInPixels} pixels (${map.width}x${map.height} tiles)`);
        console.log(`Camera bounds: ${this.cameras.main.getBounds()}`);
        
        // Get the MapManager to access collision data
        const mapManager = MapManager.getInstance();
        const mapData = mapManager.getMap('large_town');
        if (mapData) {
            console.log(`MapManager: Loaded map with ${mapData.width}x${mapData.height} tiles`);
        }
    }

    private initializeControllers() {
        // Initialize player controller
        this.playerController = new PlayerController(this);
        this.playerController.createAnimations();
        
        // Initialize input manager
        this.inputManager = new InputManager(this);
        this.inputManager.setCallbacks({
            onMove: (direction: string) => this.handleMove(direction),
            onMoveStart: (direction: string) => this.handleMoveStart(direction),
            onMoveStop: (direction: string) => this.handleMoveStop(direction),
            onMoveContinuous: (directions: string[]) => this.handleMoveContinuous(directions),
            onClick: (clickData: any) => this.handleClick(clickData),
            onRightClick: (clickData: any) => this.handleRightClick(clickData)
        });
        
        console.log("GameScene: Controllers initialized");
    }

    private handleMove(direction: string) {
        this.handleInput([direction], 'discrete');
    }

    private handleMoveStart(direction: string) {
        this.handleInput([direction], 'start');
    }

    private handleMoveStop(direction: string) {
        this.handleInput([], 'stop');
    }

    private handleMoveContinuous(directions: string[]) {
        this.handleInput(directions, 'continuous');
    }

    private handleInput(directions: string[], inputType: 'discrete' | 'start' | 'stop' | 'continuous') {
        if (!this.room) return;

        // Send unified input message at fixed rate
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
                console.log(`[GAME] Continuous input: ${this.pendingInputs.join(', ')}`);
            }
        } else {
            // Send immediate input for discrete actions
            this.room.send('player_input', { 
                directions: directions,
                type: inputType,
                timestamp: Date.now()
            });
            
            if (inputType === 'stop') {
                this.pendingInputs = [];
            }
            
            console.log(`[GAME] ${inputType} input: ${directions.join(', ')}`);
        }
    }

    private handleClick(clickData: any) {
        // Check if click is on another player
        const allPlayers = this.playerController.getAllPlayers();
        let clickedPlayer = null;
        
        for (const sessionId of allPlayers) {
            const sprite = this.playerController.getPlayerSprite(sessionId);
            if (sprite && sprite.getBounds().contains(clickData.worldX, clickData.worldY)) {
                clickedPlayer = {
                    sessionId: sessionId,
                    name: sprite.getData('playerName')
                };
                break;
            }
        }

        if (clickedPlayer) {
            console.log(`[GAME] Clicked on player: ${clickedPlayer.name} (${clickedPlayer.sessionId})`);
            clickData.clickedPlayer = clickedPlayer;
        }

        if (this.room) {
            this.room.send('click', clickData);
        }
    }

    private handleRightClick(clickData: any) {
        if (this.room) {
            this.room.send('rightclick', clickData);
        }
    }

    async connectToServer() {
        console.log("=== Starting connection to Colyseus server ===");
        
        try {
            this.client = new Client(`ws://localhost:2567`);
            this.room = await this.client.joinOrCreate('heartwood_room');
            
            console.log("Connected to Colyseus server, joined heartwood_room");
            
            this.myPlayerId = this.room.sessionId;
            if (this.myPlayerId) {
                this.playerController.setMyPlayerId(this.myPlayerId);
            }
            
            // Set up state change handler
            this.room.onStateChange((state: any) => {
                this.handleStateChange(state);
            });
            
            this.room.onLeave((code: number) => {
                console.log("Left room with code:", code);
            });
            
            this.room.onError((code: number, message: string) => {
                console.error("Room error:", code, message);
            });
            
        } catch (error) {
            console.error("Failed to connect to Colyseus server:", error);
            if (error instanceof Error) {
                console.error("Error message:", error.message);
            }
        }
    }

    private handleStateChange(state: any) {
        if (state.players) {
            // Update all players
            state.players.forEach((player: any, sessionId: string) => {
                this.playerController.updatePlayer(sessionId, player);
            });
            
            // Remove players who left
            const currentPlayers = this.playerController.getAllPlayers();
            currentPlayers.forEach(sessionId => {
                if (!state.players.has(sessionId)) {
                    this.playerController.removePlayer(sessionId);
                }
            });
            
            // Update camera to follow current player
            this.updateCameraFollow();
        }
    }

    private updateCameraFollow() {
        if (this.myPlayerId) {
            const mySprite = this.playerController.getPlayerSprite(this.myPlayerId);
            if (mySprite) {
                // Make the camera follow the current player more responsively
                this.cameras.main.startFollow(mySprite, true, 0.2, 0.2);
            }
        }
    }

    // Client-side prediction methods removed for stability - server-side optimizations provide sufficient performance

    update(time: number, delta: number) {
        // Update all controllers
        this.inputManager.update();
        this.playerController.update(delta);
        
        // Occasional logging
        if (Math.random() < 0.001) {
            console.log("Game update loop is running with smooth movement");
        }
    }

    destroy() {
        // Clean up controllers
        this.inputManager?.destroy();
        this.playerController?.destroy();
        
        // Clean up Colyseus connection
        if (this.room) {
            this.room.leave();
        }
        
        // Note: Phaser scenes don't have a destroy method to call with super
        console.log("GameScene: Cleaned up");
    }
}