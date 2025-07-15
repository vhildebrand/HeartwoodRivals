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
        this.cameras.main.setZoom(1);
        this.cameras.main.setLerp(0.1, 0.1); // Smooth camera movement
        
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
        if (this.room) {
            this.room.send('move', { direction });
            console.log(`[GAME] Sent move command: ${direction}`);
        }
    }

    private handleMoveStart(direction: string) {
        if (this.room) {
            this.room.send('move_start', { direction });
            console.log(`[GAME] Started moving: ${direction}`);
        }
    }

    private handleMoveStop(direction: string) {
        if (this.room) {
            this.room.send('move_stop', { direction });
            console.log(`[GAME] Stopped moving: ${direction}`);
        }
    }

    private handleMoveContinuous(directions: string[]) {
        if (this.room && directions.length > 0) {
            // Send continuous movement every few frames to avoid spam
            if (Math.random() < 0.1) { // 10% chance per frame = ~6 times per second at 60fps
                this.room.send('move_continuous', { directions });
                console.log(`[GAME] Continuous movement: ${directions.join(', ')}`);
            }
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
                // Make the camera follow the current player smoothly
                this.cameras.main.startFollow(mySprite, true, 0.1, 0.1);
            }
        }
    }

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