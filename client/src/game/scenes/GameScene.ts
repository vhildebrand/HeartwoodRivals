// client/src/scenes/GameScene.ts
import { Scene } from "phaser";
import { Client } from "colyseus.js";

export class GameScene extends Scene {
    private client: Client;
    private room: any;

    constructor() {
        super("GameScene");
    }

    create() {
        // Sub-task 3.2: Render the Map
        
        // Create the tilemap object
        const map = this.make.tilemap({ key: 'town' });
        
        // Add the tileset to the map with correct tile size
        // The tileset uses 16x16 tiles as specified in the JSON
        const tileset = map.addTilesetImage('cute_fantasy', 'cute_fantasy', 16, 16);
        
        if (!tileset) {
            console.error("Failed to load tileset");
            return;
        }
        
        // Render the Ground layer
        const groundLayer = map.createLayer('Ground', tileset);
        
        // Render the Walls layer (if it exists)
        const wallsLayer = map.createLayer('Walls', tileset);
        
        // Also render the Above layer if it exists
        const aboveLayer = map.createLayer('Above', tileset);
        
        // Set up camera to follow the map
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        
        console.log("GameScene: Map loaded with available layers");
        console.log("Available layers:", map.layers.map(layer => layer.name));

        // Sub-task 3.3: Connect to Colyseus
        this.connectToServer();
    }

    async connectToServer() {
        try {
            // Create Colyseus client with proper WebSocket URL
            // Try different URLs for different environments
            let endpoint: string;
            
            // If running in development (localhost), try localhost first
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                endpoint = 'localhost:2567';
            } else {
                // For other environments, use the current hostname
                endpoint = `${window.location.hostname}:2567`;
            }
            
            console.log(`Attempting to connect to Colyseus server at: ws://${endpoint}`);
            
            // Create client with just the endpoint (no ws:// prefix)
            this.client = new Client(endpoint);
            
            // Join the heartwood_room
            this.room = await this.client.joinOrCreate('heartwood_room');
            
            console.log("Connected to Colyseus server, joined heartwood_room");
            
            // Set up onStateChange listener that logs "State has changed!" to the console
            this.room.onStateChange((state: any) => {
                console.log("State has changed!", state);
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

    update() {
        // This is the game loop, where you'll handle player input and updates
    }
}