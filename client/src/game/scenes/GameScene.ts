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
    
    // NPC system
    private npcs: Map<string, { sprite: Phaser.GameObjects.Sprite, name: string, x: number, y: number }> = new Map();
    private interactionIndicator: Phaser.GameObjects.Text | null = null;
    
    // Building labels
    private buildingLabels: Phaser.GameObjects.Text[] = [];

    constructor() {
        super("GameScene");
    }

    create() {
        console.log("=== GameScene.create() started ===");
        
        // Create the game world
        this.createWorld();
        
        // Initialize controllers
        this.initializeControllers();
        
        // Create NPCs
        this.createNPCs();
        
        // Create building labels
        this.createBuildingLabels();
        
        // Connect to server
        this.connectToServer();
    }

    private createWorld() {
        // Create the tilemap object
        console.log("Creating tilemap...");
        const map = this.make.tilemap({ key: 'beacon_bay' });
        
        // Add the tileset to the map
        console.log("Adding tileset...");
        const tileset = map.addTilesetImage('tileset', 'tileset', 16, 16);
        
        if (!tileset) {
            console.error("Failed to load tileset");
            return;
        }
        
        // Render layers - Beacon Bay map has a single 'ground' layer
        const groundLayer = map.createLayer('ground', tileset);
        this.wallsLayer = null; // No walls layer in Beacon Bay map
        // const aboveLayer = map.createLayer('Above', tileset); // No above layer in Beacon Bay map
        
        // Set up camera with proper bounds
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        
        // Set camera zoom and smoothing
        this.cameras.main.setZoom(1); // Zoom in 3x
        this.cameras.main.setLerp(0.25, 0.25); // Reduced camera smoothing for better responsiveness
        
        // Set the camera viewport to the game size
        this.cameras.main.setViewport(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        console.log("GameScene: Large map loaded with available layers");
        console.log("Available layers:", map.layers.map(layer => layer.name));
        console.log(`Map dimensions: ${map.widthInPixels}x${map.heightInPixels} pixels (${map.width}x${map.height} tiles)`);
        console.log(`Camera bounds: ${this.cameras.main.getBounds()}`);
        
        // Get the MapManager to access collision data
        const mapManager = MapManager.getInstance();
        const mapData = mapManager.getMap('beacon_bay');
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
        
        // Add E key handler for NPC interaction
        this.input.keyboard?.addKey('E').on('down', () => {
            this.handleInteraction();
        });
        
        console.log("GameScene: Controllers initialized");
    }

    private async createNPCs() {
        try {
            // Fetch NPCs from the web API
            const response = await fetch('http://localhost:3000/npc/list');
            if (!response.ok) {
                console.error('Failed to fetch NPCs from API');
                return;
            }
            
            const data = await response.json();
            const npcs = data.npcs || [];
            
            // Create sprites for each NPC
            for (const npc of npcs) {
                const npcSprite = this.add.sprite(npc.x_position * 16, npc.y_position * 16, 'player');
                npcSprite.setScale(1);
                npcSprite.setDepth(10);
                npcSprite.setTint(0x00ff00); // Green tint to distinguish from players
                
                // Create animations for NPC (idle animation)
                npcSprite.play('idle_down');
                
                // Store NPC data
                this.npcs.set(npc.id, {
                    sprite: npcSprite,
                    name: npc.name,
                    x: npc.x_position,
                    y: npc.y_position
                });
                
                console.log(`Created NPC: ${npc.name} at (${npc.x_position}, ${npc.y_position})`);
            }
            
            // Create interaction indicator
            this.interactionIndicator = this.add.text(0, 0, 'Press E to talk', {
                fontSize: '12px',
                color: '#FFD700',
                backgroundColor: '#000000',
                padding: { x: 4, y: 2 }
            });
            this.interactionIndicator.setDepth(1000);
            this.interactionIndicator.setVisible(false);
            
            console.log(`Created ${npcs.length} NPCs`);
        } catch (error) {
            console.error('Error creating NPCs:', error);
        }
    }

    private createBuildingLabels() {
        try {
            // Get the locations data that was loaded in PreloaderScene
            const locationsData = this.cache.json.get('beacon_bay_locations');
            if (!locationsData) {
                console.error('Failed to load beacon_bay_locations.json');
                return;
            }
            
            // Create labels for each building
            Object.entries(locationsData).forEach(([key, location]: [string, any]) => {
                if (key === 'water_areas') return; // Skip water areas
                
                if (location.name && location.x !== undefined && location.y !== undefined && 
                    location.width !== undefined && location.height !== undefined) {
                    
                    // Calculate center position of the building
                    const centerX = (location.x + location.width / 2) * 16; // Convert to pixels
                    const centerY = (location.y + location.height / 2) * 16; // Convert to pixels
                    
                    // Create text label
                    const label = this.add.text(centerX, centerY, location.name, {
                        fontSize: '12px',
                        color: '#FFFFFF',
                        backgroundColor: '#000000',
                        padding: { x: 4, y: 2 },
                        stroke: '#000000',
                        strokeThickness: 2
                    });
                    
                    // Center the text origin
                    label.setOrigin(0.5, 0.5);
                    
                    // Set depth to appear above buildings but below UI
                    label.setDepth(100);
                    
                    // Make labels scale with camera zoom
                    label.setScrollFactor(1);
                    
                    // Store label reference
                    this.buildingLabels.push(label);
                    
                    console.log(`Created label for ${location.name} at (${centerX}, ${centerY})`);
                }
            });
            
            console.log(`Created ${this.buildingLabels.length} building labels`);
        } catch (error) {
            console.error('Error creating building labels:', error);
        }
    }

    private handleInteraction() {
        if (!this.myPlayerId) return;
        
        const mySprite = this.playerController.getPlayerSprite(this.myPlayerId);
        if (!mySprite) return;
        
        // Check if dialogue is already open
        const uiScene = this.scene.get('UIScene') as any;
        if (uiScene && uiScene.getDialogueManager()?.isDialogueActive()) {
            return;
        }
        
        // Check if player is near any NPC
        const nearbyNpc = this.getNearbyNPC(mySprite.x, mySprite.y);
        if (nearbyNpc) {
            console.log(`Opening dialogue with ${nearbyNpc.name}`);
            this.game.events.emit('openDialogue', nearbyNpc.id, nearbyNpc.name);
        }
    }

    private getNearbyNPC(playerX: number, playerY: number): { id: string, name: string } | null {
        const interactionDistance = 32; // 2 tiles
        
        for (const [npcId, npcData] of this.npcs) {
            const npcX = npcData.sprite.x;
            const npcY = npcData.sprite.y;
            
            const distance = Math.sqrt(
                Math.pow(playerX - npcX, 2) + Math.pow(playerY - npcY, 2)
            );
            
            if (distance <= interactionDistance) {
                return { id: npcId, name: npcData.name };
            }
        }
        
        return null;
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
        
        // Update interaction indicator
        this.updateInteractionIndicator();
        
        // Occasional logging
        if (Math.random() < 0.001) {
            console.log("Game update loop is running with smooth movement");
        }
    }

    private updateInteractionIndicator() {
        if (!this.myPlayerId || !this.interactionIndicator) return;
        
        const mySprite = this.playerController.getPlayerSprite(this.myPlayerId);
        if (!mySprite) return;
        
        const nearbyNpc = this.getNearbyNPC(mySprite.x, mySprite.y);
        
        if (nearbyNpc) {
            // Show interaction indicator above the NPC
            const npcData = this.npcs.get(nearbyNpc.id);
            if (npcData) {
                this.interactionIndicator.setPosition(
                    npcData.sprite.x - 40, 
                    npcData.sprite.y - 30
                );
                this.interactionIndicator.setVisible(true);
            }
        } else {
            this.interactionIndicator.setVisible(false);
        }
    }

    destroy() {
        // Clean up controllers
        this.inputManager?.destroy();
        this.playerController?.destroy();
        
        // Clean up building labels
        this.buildingLabels.forEach(label => label.destroy());
        this.buildingLabels = [];
        
        // Clean up Colyseus connection
        if (this.room) {
            this.room.leave();
        }
        
        // Note: Phaser scenes don't have a destroy method to call with super
        console.log("GameScene: Cleaned up");
    }
}