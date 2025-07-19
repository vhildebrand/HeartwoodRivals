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
    private cameraFollowingPlayer: boolean = false; // Track if camera is already following
    
    // New architecture components
    private inputManager: InputManager;
    private playerController: PlayerController;
    
    // Fixed-rate input sampling
    private lastInputSent: number = 0;
    private inputSendRate: number = 100; // Send input every 100ms (10 times per second)
    private pendingInputs: string[] = [];
    
    // NPC system
    private npcs: Map<string, { 
        sprite: Phaser.GameObjects.Sprite, 
        nameLabel: Phaser.GameObjects.Text, 
        actionLabel: Phaser.GameObjects.Text,
        name: string, 
        x: number, 
        y: number 
    }> = new Map();
    private interactionIndicator: Phaser.GameObjects.Text | null = null;
    private lastNpcCount: number = 0; // Track last NPC count to avoid spam logging
    
    // Building labels
    private buildingLabels: Phaser.GameObjects.Text[] = [];
    
    // Game state tracking (for UI updates)
    private currentGameTime: string = "06:00";
    private currentGameDay: number = 1;
    private currentSpeedMultiplier: number = 60;
    
    // Debug panel throttling
    private lastDebugUpdateTime: number = 0;
    private debugUpdateInterval: number = 2000; // Update every 2 seconds
    private previousNPCData: Map<string, any> = new Map();

    constructor() {
        super("GameScene");
    }

    create() {
        console.log("🎮 === GAME SCENE CREATE() STARTED ===");
        
        // Create the game world
        console.log("🌍 Starting world creation...");
        this.createWorld();
        console.log("🌍 World creation completed");
        
        // Initialize controllers
        this.initializeControllers();
        
        // Create NPCs
        this.createNPCs();
        
        // Create building labels
        this.createBuildingLabels();
        
        // Create time control instructions
        this.createTimeControlInstructions();
        
        // Connect to server
        this.connectToServer();

        // Listen for dialogue close events to disable movement blocking
        this.game.events.on('closeDialogue', () => {
            console.log(`💬 [GAME] Dialogue closed - re-enabling movement`);
            this.inputManager.setDialogueActive(false);
        });

        // Listen for player speech events from UIScene
        this.game.events.on('playerSpeech', (data: { message: string; type: string }) => {
            console.log(`🗣️ [GAME] Player public speech: "${data.message}"`);
            this.handlePlayerSpeech(data.message);
        });

        // Listen for player activity events from UIScene
        this.game.events.on('playerActivity', (data: { message: string; type: string }) => {
            console.log(`🎯 [GAME] Player activity update: "${data.message}"`);
            this.handlePlayerActivity(data.message);
        });

        // Listen for movement blocking events from UIScene
        this.game.events.on('blockMovement', (blocked: boolean) => {
            console.log(`🚫 [GAME] Movement ${blocked ? 'blocked' : 'unblocked'} for text input`);
            this.inputManager.setMovementBlocked(blocked);
        });
    }

    private createWorld() {
        // Create the tilemap object
        console.log("🗺️ === WORLD CREATION START ===");
        console.log("Creating tilemap with key 'beacon_bay'...");
        const map = this.make.tilemap({ key: 'beacon_bay' });
        
        if (!map) {
            console.error("❌ Failed to create tilemap!");
            return;
        }
        console.log("✅ Tilemap created successfully");
        
        // Add the tileset to the map
        console.log("Adding tileset...");
        const tileset = map.addTilesetImage('tileset', 'tileset', 16, 16);
        
        if (!tileset) {
            console.error("❌ Failed to load tileset");
            return;
        }
        console.log("✅ Tileset loaded successfully");
        
        // Render layers - Beacon Bay map has a single 'ground' layer
        console.log("Creating ground layer...");
        const groundLayer = map.createLayer('ground', tileset);
        if (!groundLayer) {
            console.error("❌ Failed to create ground layer");
        } else {
            console.log("✅ Ground layer created successfully");
        }
        
        this.wallsLayer = null; // No walls layer in Beacon Bay map
        // const aboveLayer = map.createLayer('Above', tileset); // No above layer in Beacon Bay map
        
        // Create building sprites from the object layer
        console.log("🏢 Attempting to create building sprites...");
        this.createBuildingSprites(map);
        
        // Set up camera with proper bounds
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        
        // Set camera zoom and smoothing
        this.cameras.main.setZoom(2); // Zoom in 2x
        this.cameras.main.setLerp(0.1, 0.1); // Smoother camera movement
        
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

    private createBuildingSprites(map: Phaser.Tilemaps.Tilemap) {
        console.log("🏗️ === BUILDING SPRITE CREATION START ===");
        
        // Debug: Log all available layers in the map
        console.log("🔍 Map layers:", map.layers.map((layer: any) => `${layer.name} (type: ${layer.type})`));
        console.log("🔍 Object layers:", map.objects);
        console.log("🔍 Object layer count:", map.objects.length);
        
        if (map.objects && map.objects.length > 0) {
            map.objects.forEach((objLayer: any, index: number) => {
                console.log(`🔍 Object layer ${index}: name="${objLayer.name}", objectCount=${objLayer.objects.length}`);
            });
        }
        
        // Get the city object layer
        const cityLayer = map.getObjectLayer('city');
        if (!cityLayer) {
            console.error("❌ No 'city' object layer found in map!");
            console.log("🔍 Available object layer names:", map.objects.map((layer: any) => layer.name));
            
            // Try to find any object layer
            if (map.objects && map.objects.length > 0) {
                console.log("🔍 Let's try the first object layer instead...");
                const firstObjectLayer = map.objects[0];
                console.log("🔍 First object layer:", firstObjectLayer.name, "with", firstObjectLayer.objects.length, "objects");
            }
            return;
        }
        
        console.log(`✅ Found city object layer with ${cityLayer.objects.length} building objects`);
        
        if (cityLayer.objects.length === 0) {
            console.warn("⚠️ City object layer is empty - no buildings to create");
            return;
        }
        
        // Create sprites for each building object
        cityLayer.objects.forEach((obj: any, index: number) => {
            // Since you didn't set type properties, we'll use the object name or a default
            // You can customize this logic based on your object naming scheme
            let textureKey = 'tile_ME_Singles_Generic_Building_16x16_Condo_4_30'; // Default texture
            let debugInfo = '';
            
            // Check if the object has a type property set in Tiled
            // First check the direct type field
            let typeValue = obj.type;
            
            // If direct type is empty, check the properties array for a "type" property
            if (!typeValue && obj.properties && obj.properties.length > 0) {
                const typeProperty = obj.properties.find((prop: any) => prop.name === 'type');
                if (typeProperty && typeProperty.value) {
                    typeValue = typeProperty.value;
                    debugInfo += `properties.type="${typeValue}"`;
                }
            } else if (typeValue) {
                debugInfo += `direct.type="${typeValue}"`;
            }
            
            if (typeValue) {
                // Use the type as the texture key (it should already include 'tile_' prefix or be the full texture name)
                const possibleKey = typeValue.startsWith('tile_') ? typeValue : `tile_${typeValue}`;
                debugInfo += ` -> key="${possibleKey}"`;
                if (this.textures.exists(possibleKey)) {
                    textureKey = possibleKey;
                    debugInfo += ' ✓ EXISTS';
                } else {
                    debugInfo += ' ✗ NOT_FOUND';
                    console.warn(`⚠️ Texture "${possibleKey}" not found for object type "${typeValue}"`);
                }
            }
            // Fallback: also check object name for backwards compatibility
            else if (obj.name) {
                const possibleKey = `tile_${obj.name}`;
                debugInfo += `name="${obj.name}" -> key="${possibleKey}"`;
                if (this.textures.exists(possibleKey)) {
                    textureKey = possibleKey;
                    debugInfo += ' ✓ EXISTS';
                } else {
                    debugInfo += ' ✗ NOT_FOUND';
                }
            } else {
                debugInfo = 'NO_TYPE_OR_NAME -> using default';
            }
            
            // Create the sprite at the object's position
            const sprite = this.add.sprite(obj.x, obj.y - obj.height, textureKey);
            sprite.setOrigin(0, 0); // Set origin to top-left to match Tiled positioning
            sprite.setDepth(obj.y); // Set depth based on Y position for proper layering
            
            console.log(`🏢 Building ${index + 1}: ${debugInfo} -> USING: ${textureKey}`);
        });
        
        console.log("Building sprites creation complete!");
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
        
        // Add key to zoom out camera for debugging
        this.input.keyboard?.addKey('Q').on('down', () => {
            const currentZoom = this.cameras.main.zoom;
            this.cameras.main.setZoom(Math.max(0.5, currentZoom - 0.5));
            console.log(`Camera zoom: ${this.cameras.main.zoom}`);
        });
        
        // Add key to zoom in camera
        this.input.keyboard?.addKey('Z').on('down', () => {
            const currentZoom = this.cameras.main.zoom;
            this.cameras.main.setZoom(Math.min(3, currentZoom + 0.5));
            console.log(`Camera zoom: ${this.cameras.main.zoom}`);
        });
        
        // Time control keys
        this.input.keyboard?.addKey('ONE').on('down', () => {
            this.setGameTime("06:00");
        });
        
        this.input.keyboard?.addKey('TWO').on('down', () => {
            this.setGameTime("09:00");
        });
        
        this.input.keyboard?.addKey('THREE').on('down', () => {
            this.setGameTime("12:00");
        });
        
        this.input.keyboard?.addKey('FOUR').on('down', () => {
            this.setGameTime("15:00");
        });
        
        this.input.keyboard?.addKey('FIVE').on('down', () => {
            this.setGameTime("18:00");
        });
        
        this.input.keyboard?.addKey('SIX').on('down', () => {
            this.setGameTime("21:00");
        });
        
        this.input.keyboard?.addKey('PLUS').on('down', () => {
            this.advanceTime(1);
        });
        
        this.input.keyboard?.addKey('MINUS').on('down', () => {
            this.advanceTime(-1);
        });
        
        this.input.keyboard?.addKey('ZERO').on('down', () => {
            this.toggleSpeed();
        });
        
        console.log("GameScene: Controllers initialized");
        console.log("🎮 Controls: WASD to move, E to interact, Q to zoom out, Z to zoom in");
        console.log("🕐 Time: 1-6 to set time, +/- to advance time, R to toggle speed");
    }

    private setGameTime(time: string) {
        if (this.room) {
            this.room.send("set_time", { time });
            console.log(`🕐 [CLIENT] Set time to: ${time}`);
        }
    }

    private advanceTime(hours: number) {
        if (this.room) {
            this.room.send("advance_time", { hours });
            console.log(`⏰ [CLIENT] Advanced time by ${hours} hours`);
        }
    }

    private toggleSpeed() {
        if (this.room) {
            // Cycle through speed multipliers: 1x -> 10x -> 60x -> 1x
            const speeds = [1, 10, 60];
            const currentIndex = speeds.indexOf(this.currentSpeedMultiplier);
            const nextIndex = (currentIndex + 1) % speeds.length;
            const newSpeed = speeds[nextIndex];
            
            this.room.send("set_speed", { speedMultiplier: newSpeed });
            console.log(`🚀 [CLIENT] Set speed to: ${newSpeed}x`);
        }
    }

    private async createNPCs() {
        // NPCs are now created automatically from server state updates
        // Create interaction indicator
        this.interactionIndicator = this.add.text(0, 0, 'Press E to talk', {
            fontSize: '12px',
            color: '#FFD700',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
        });
        this.interactionIndicator.setDepth(1000);
        this.interactionIndicator.setVisible(false);
        
        console.log('NPC system initialized - agents will be created from server state');
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
                    
                    // Calculate position near the top of the building
                    const centerX = (location.x + location.width / 2) * 16; // Convert to pixels (still centered horizontally)
                    const topY = (location.y + 2) * 16; // Convert to pixels (2 tiles from top edge)
                    
                    // Create text label
                    const label = this.add.text(centerX, topY, location.name, {
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
                    
                    console.log(`Created label for ${location.name} at (${centerX}, ${topY})`);
                }
            });
            
            console.log(`Created ${this.buildingLabels.length} building labels`);
        } catch (error) {
            console.error('Error creating building labels:', error);
        }
    }

    private createTimeControlInstructions() {
        // Create time control instructions (moved to bottom-left)
        const instructionsText = this.add.text(16, this.cameras.main.height - 100, 
            'Time Controls:\n' +
            '1-6: Set time (06:00, 09:00, 12:00, 15:00, 18:00, 21:00)\n' +
            '+/-: Advance time by ±1 hour\n' +
            'R: Toggle speed (1x, 10x, 60x)',
            {
                fontSize: '12px',
                color: '#CCCCCC',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: { x: 6, y: 4 },
                lineSpacing: 4
            }
        );
        instructionsText.setOrigin(0, 0);
        instructionsText.setDepth(1000);
        instructionsText.setScrollFactor(0); // Fixed to camera
        instructionsText.setVisible(true); // Ensure it's visible
        
        console.log('🕐 Time control instructions created');
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
        
        // Check if player is currently typing (speech or activity input)
        if (uiScene && (uiScene.speechInputActive || uiScene.activityInputActive)) {
            console.log(`🚫 [GAME] Cannot open dialogue while typing text input`);
            return;
        }
        
        // Check if player is near any NPC
        const nearbyNpc = this.getNearbyNPC(mySprite.x, mySprite.y);
        if (nearbyNpc) {
            console.log(`Opening dialogue with ${nearbyNpc.name}`);
            this.inputManager.setDialogueActive(true);
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

    private handlePlayerSpeech(message: string) {
        if (!this.room || !this.myPlayerId) {
            console.warn('🗣️ [GAME] Cannot send speech - no room or player ID');
            return;
        }

        // Get current player position
        const player = this.playerController.getPlayerSprite(this.myPlayerId);
        if (!player) {
            console.warn('🗣️ [GAME] Cannot send speech - no player sprite');
            return;
        }

        // Calculate tile position
        const tileX = Math.floor(player.x / 16);
        const tileY = Math.floor(player.y / 16);

        // Send public speech message to server
        this.room.send('player_speech', {
            message: message,
            location: `${tileX},${tileY}`,
            timestamp: Date.now()
        });

        console.log(`🗣️ [GAME] Sent public speech to server: "${message}" at (${tileX}, ${tileY})`);
    }

    private handlePlayerActivity(message: string) {
        if (!this.room || !this.myPlayerId) {
            console.warn('🎯 [GAME] Cannot send activity - no room or player ID');
            return;
        }

        // Get current player position
        const player = this.playerController.getPlayerSprite(this.myPlayerId);
        if (!player) {
            console.warn('🎯 [GAME] Cannot send activity - no player sprite');
            return;
        }

        // Calculate tile position
        const tileX = Math.floor(player.x / 16);
        const tileY = Math.floor(player.y / 16);

        // Update local player activity display
        this.playerController.updatePlayerActivity(this.myPlayerId, message);

        // Send activity update message to server
        this.room.send('player_activity', {
            message: message,
            location: `${tileX},${tileY}`,
            timestamp: Date.now()
        });

        console.log(`🎯 [GAME] Sent activity update to server: "${message}" at (${tileX}, ${tileY})`);
    }

    async connectToServer() {
        console.log("=== Starting connection to Colyseus server ===");
        
        try {
            this.client = new Client(`ws://localhost:2567`);
            
            // Get username from user or use default
            let username = localStorage.getItem('heartwoodUsername');
            if (!username) {
                username = prompt("Enter your username:") || `Player_${Date.now().toString().slice(-6)}`;
                localStorage.setItem('heartwoodUsername', username);
            }
            
            console.log(`Connecting with username: ${username}`);
            
            // Send username as option when joining
            this.room = await this.client.joinOrCreate('heartwood_room', { name: username });
            
            console.log("Connected to Colyseus server, joined heartwood_room");
            
            this.myPlayerId = this.room.sessionId;
            if (this.myPlayerId) {
                this.playerController.setMyPlayerId(this.myPlayerId);
                // Reset camera following flag when player joins
                this.cameraFollowingPlayer = false;
                // Emit player ID for UI Scene to set up dialogue manager
                this.game.events.emit('playerIdSet', this.myPlayerId);
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
            
            // Set up speed dating event listeners
            this.setupSpeedDatingEventListeners();
            
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
            
            // Emit player count update to UI
            const playerCount = state.players.size;
            this.game.events.emit('playerCountUpdate', playerCount);
            
            // Update camera to follow current player
            this.updateCameraFollow();
        }
        
        // Update agents from server state
        if (state.agents) {
            this.updateAgents(state.agents);
        }
        
        // Update game time from server state and emit to UI
        if (state.currentGameTime && state.currentGameTime !== this.currentGameTime) {
            this.currentGameTime = state.currentGameTime;
            console.log(`🕐 [GAME] Time updated to: ${this.currentGameTime}`);
        }
        
        if (state.gameDay && state.gameDay !== this.currentGameDay) {
            this.currentGameDay = state.gameDay;
            console.log(`📅 [GAME] Day updated to: ${this.currentGameDay}`);
        }
        
        // Update speed multiplier from server state
        if (state.speedMultiplier && state.speedMultiplier !== this.currentSpeedMultiplier) {
            this.currentSpeedMultiplier = state.speedMultiplier;
            console.log(`🚀 [GAME] Speed updated to: ${this.currentSpeedMultiplier}x`);
        }
        
        // Emit game state updates to UI
        this.game.events.emit('gameStateUpdate', {
            currentGameTime: this.currentGameTime,
            gameDay: this.currentGameDay,
            speedMultiplier: this.currentSpeedMultiplier
        });
    }

    private updateCameraFollow() {
        if (this.myPlayerId && !this.cameraFollowingPlayer) {
            const mySprite = this.playerController.getPlayerSprite(this.myPlayerId);
            if (mySprite) {
                // Set camera to follow the player only once
                this.cameras.main.startFollow(mySprite, true, 0.1, 0.1);
                this.cameraFollowingPlayer = true;
                console.log("Camera now following player");
            }
        }
    }

    private updateAgents(agentStates: any) {
        // Update existing agents and create new ones
        agentStates.forEach((agent: any, agentId: string) => {
            const existingAgent = this.npcs.get(agentId);
            
            if (existingAgent) {
                // Update existing agent position and state
                existingAgent.sprite.x = agent.x * 16; // Convert to pixels
                existingAgent.sprite.y = agent.y * 16;
                existingAgent.nameLabel.x = agent.x * 16;
                existingAgent.nameLabel.y = agent.y * 16 - 20;
                existingAgent.actionLabel.x = agent.x * 16;
                existingAgent.actionLabel.y = agent.y * 16 + 20;
                
                // Update action label text
                const actionText = agent.currentActivity || 'idle';
                existingAgent.actionLabel.setText(actionText);
                
                // Update stored position
                existingAgent.x = agent.x;
                existingAgent.y = agent.y;
            } else {
                // Create new agent
                this.createAgent(agentId, agent);
            }
        });
        
        // Remove agents that no longer exist
        const currentAgents = Array.from(this.npcs.keys());
        currentAgents.forEach(agentId => {
            if (!agentStates.has(agentId)) {
                this.removeAgent(agentId);
            }
        });
        
        // Show total agents in console only when count changes
        if (this.npcs.size !== this.lastNpcCount) {
            this.lastNpcCount = this.npcs.size;
            if (this.npcs.size > 0) {
                console.log(`🤖 [CLIENT] Total NPCs active: ${this.npcs.size}`);
            }
        }
        
        // Throttled debug panel updates (only every 2 seconds)
        const currentTime = Date.now();
        if (currentTime - this.lastDebugUpdateTime > this.debugUpdateInterval) {
            this.updateDebugPanelData(agentStates);
            this.lastDebugUpdateTime = currentTime;
        }
    }
    
    private updateDebugPanelData(agentStates: any) {
        // Create current NPC data
        const currentNPCData = new Map();
        agentStates.forEach((agent: any, agentId: string) => {
            currentNPCData.set(agentId, {
                id: agentId,
                name: agent.name,
                x: agent.x,
                y: agent.y,
                currentActivity: agent.currentActivity || 'idle',
                currentLocation: agent.currentLocation || 'Unknown'
            });
        });
        
        // Check if data has actually changed
        let hasChanged = false;
        
        // Check if number of NPCs changed
        if (currentNPCData.size !== this.previousNPCData.size) {
            hasChanged = true;
        } else {
            // Check if any NPC data changed
            for (const [agentId, currentData] of currentNPCData) {
                const previousData = this.previousNPCData.get(agentId);
                if (!previousData || 
                    previousData.x !== currentData.x ||
                    previousData.y !== currentData.y ||
                    previousData.currentActivity !== currentData.currentActivity ||
                    previousData.currentLocation !== currentData.currentLocation) {
                    hasChanged = true;
                    break;
                }
            }
        }
        
        // Only emit if data has changed
        if (hasChanged) {
            this.previousNPCData = new Map(currentNPCData);
            this.game.events.emit('npcDataUpdate', currentNPCData);
        }
    }

    private createAgent(agentId: string, agentData: any) {
        const agentSprite = this.add.sprite(agentData.x * 16, agentData.y * 16, 'player');
        agentSprite.setScale(1);
        agentSprite.setDepth(10);
        agentSprite.setTint(0x00ff00); // Green tint to distinguish from players
        
        // Create name label above agent
        const nameLabel = this.add.text(agentData.x * 16, agentData.y * 16 - 20, agentData.name, {
            fontSize: '10px',
            color: '#FFFFFF',
            backgroundColor: '#000000',
            padding: { x: 3, y: 1 }
        });
        nameLabel.setOrigin(0.5, 0.5);
        nameLabel.setDepth(15);
        
        // Create action label below agent
        const actionText = agentData.currentActivity || 'idle';
        const actionLabel = this.add.text(agentData.x * 16, agentData.y * 16 + 20, actionText, {
            fontSize: '9px',
            color: '#FF0000', // Red text as requested
            backgroundColor: '#000000',
            padding: { x: 3, y: 1 }
        });
        actionLabel.setOrigin(0.5, 0.5);
        actionLabel.setDepth(15);
        
        // Store agent data
        this.npcs.set(agentId, {
            sprite: agentSprite,
            nameLabel: nameLabel,
            actionLabel: actionLabel,
            name: agentData.name,
            x: agentData.x,
            y: agentData.y
        });
        
        console.log(`Created agent: ${agentData.name} at (${agentData.x}, ${agentData.y}) - ${actionText}`);
    }

    private removeAgent(agentId: string) {
        const agent = this.npcs.get(agentId);
        if (agent) {
            agent.sprite.destroy();
            agent.nameLabel.destroy();
            agent.actionLabel.destroy();
            this.npcs.delete(agentId);
            console.log(`Removed agent: ${agentId}`);
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

    private setupSpeedDatingEventListeners() {
        if (!this.room) return;
        
        console.log("🎮 [GAME_SCENE] Setting up speed dating event listeners");
        
        // Speed dating countdown started
        this.room.onMessage('speed_dating_countdown', (data: any) => {
            console.log('💕 [GAME_SCENE] Speed dating countdown started:', data);
            
            // Check if speed dating scene exists
            if (!this.scene.get('SpeedDatingScene')) {
                console.error('❌ [GAME_SCENE] SpeedDatingScene not found!');
                return;
            }
            
            // Launch speed dating scene if not already running
            if (!this.scene.isActive('SpeedDatingScene')) {
                console.log('💕 [GAME_SCENE] Launching SpeedDatingScene');
                this.scene.launch('SpeedDatingScene');
                
                // Give the scene time to initialize before sending the event
                this.time.delayedCall(100, () => {
                    this.game.events.emit('speed_dating_countdown', data);
                });
            } else {
                // Scene already active, just forward the event
                this.game.events.emit('speed_dating_countdown', data);
            }
        });
        
        // Speed dating gauntlet started
        this.room.onMessage('speed_dating_start', (data: any) => {
            console.log('💕 [GAME_SCENE] Speed dating gauntlet started:', data);
            
            // Pause regular game updates
            this.scene.pause();
            
            // Forward event to speed dating scene
            this.game.events.emit('speed_dating_start', data);
        });
        
        // Speed dating match started
        this.room.onMessage('speed_dating_match_start', (data: any) => {
            console.log('💕 [GAME_SCENE] Speed dating match started:', data);
            this.game.events.emit('speed_dating_match_start', data);
        });
        
        // Speed dating vibe update
        this.room.onMessage('speed_dating_vibe_update', (data: any) => {
            console.log('💕 [GAME_SCENE] Speed dating vibe update:', data);
            this.game.events.emit('speed_dating_vibe_update', data);
        });
        
        // Speed dating match ended
        this.room.onMessage('speed_dating_match_end', (data: any) => {
            console.log('💕 [GAME_SCENE] Speed dating match ended:', data);
            this.game.events.emit('speed_dating_match_end', data);
        });
        
        // Speed dating gauntlet completed
        this.room.onMessage('speed_dating_complete', (data: any) => {
            console.log('💕 [GAME_SCENE] Speed dating gauntlet completed:', data);
            
            // Resume regular game updates
            this.scene.resume();
            
            // Forward event to speed dating scene
            this.game.events.emit('speed_dating_complete', data);
        });
        
        // NPC response to player message
        this.room.onMessage('speed_dating_npc_response', (data: any) => {
            console.log('💕 [GAME_SCENE] NPC response:', data);
            this.game.events.emit('speed_dating_npc_response', data);
        });
    }

    private checkNearbyNPCs() {
        if (!this.myPlayerId) return;
        
        const player = this.playerController.players.get(this.myPlayerId);
        if (!player) return;
        
        const nearbyNPCs: any[] = [];
        const interactionRange = 100;
        
        this.npcs.forEach((npc, id) => {
            const distance = Phaser.Math.Distance.Between(
                player.sprite.x, player.sprite.y,
                npc.sprite.x, npc.sprite.y
            );
            
            if (distance <= interactionRange) {
                nearbyNPCs.push({
                    id: id,
                    name: npc.name,
                    distance: distance
                });
            }
        });
        
        // Sort by distance
        nearbyNPCs.sort((a, b) => a.distance - b.distance);
        
        // Update interaction indicator
        if (nearbyNPCs.length > 0 && this.interactionIndicator) {
            const closestNPC = nearbyNPCs[0];
            const npcData = this.npcs.get(closestNPC.id);
            
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
        
        // Clean up NPCs and their name labels
        this.npcs.forEach(npc => {
            npc.sprite.destroy();
            npc.nameLabel.destroy();
            npc.actionLabel.destroy();
        });
        this.npcs.clear();
        
        // Clean up interaction indicator
        if (this.interactionIndicator) {
            this.interactionIndicator.destroy();
        }
        
        // Clean up Colyseus connection
        if (this.room) {
            this.room.leave();
        }
        
        // Note: Phaser scenes don't have a destroy method to call with super
        console.log("GameScene: Cleaned up");
    }
}