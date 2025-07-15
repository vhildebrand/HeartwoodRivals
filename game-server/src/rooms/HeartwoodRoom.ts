import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema";
import { MapManager } from "../maps/MapManager";
import * as fs from 'fs';
import * as path from 'path';

// Direction constants
const DIRECTIONS = {
    down: 0,
    up: 1,
    left: 2,
    right: 3
};

// Movement deltas for each direction
const TILE_SIZE = 16;
const MOVEMENT_SPEED = 120; // pixels per second (increased from 20)
const MOVEMENT_DELTAS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

export class HeartwoodRoom extends Room<GameState> {
    maxClients = 10;
    private mapManager!: MapManager;
    private readonly MAP_ID = 'large_town';
    private gameLoopInterval: NodeJS.Timeout | null = null;
    private readonly GAME_LOOP_RATE = 60; // 60 FPS server updates

    onJoin(client: Client, options: any) {
        console.log(`Player ${client.sessionId} joined the heartwood_room`);
        
        // Create new player with proper schema
        const player = new Player();
        player.id = client.sessionId;
        player.name = options.name || `Player_${client.sessionId.substring(0, 8)}`;
        
        // Set starting position (center of map, safe area)
        const startTileX = 50; // Center of 100-tile wide map
        const startTileY = 10;  // Safe area in upper portion
        
        // Ensure starting position is valid
        if (!this.mapManager.isTileWalkable(this.MAP_ID, startTileX, startTileY)) {
            console.warn(`Starting position (${startTileX}, ${startTileY}) is not walkable, finding alternative...`);
            // Try to find a nearby walkable position
            let foundValidPosition = false;
            for (let radius = 1; radius <= 10 && !foundValidPosition; radius++) {
                for (let dx = -radius; dx <= radius && !foundValidPosition; dx++) {
                    for (let dy = -radius; dy <= radius && !foundValidPosition; dy++) {
                        const testX = startTileX + dx;
                        const testY = startTileY + dy;
                        if (this.mapManager.isTileWalkable(this.MAP_ID, testX, testY)) {
                            foundValidPosition = true;
                            const safePixel = this.mapManager.tileToPixel(this.MAP_ID, testX, testY);
                            player.x = safePixel.pixelX;
                            player.y = safePixel.pixelY;
                            console.log(`Found safe spawn position at tile (${testX}, ${testY})`);
                        }
                    }
                }
            }
            
            if (!foundValidPosition) {
                console.error('Could not find valid spawn position, using default');
                player.x = 50 * 16; // Default fallback
                player.y = 10 * 16;
            }
        } else {
            const startPixel = this.mapManager.tileToPixel(this.MAP_ID, startTileX, startTileY);
            player.x = startPixel.pixelX;
            player.y = startPixel.pixelY;
        }
        player.direction = DIRECTIONS.down;
        player.isMoving = false;
        player.lastUpdate = Date.now();
        
        // Add player to state
        this.state.players.set(client.sessionId, player);
        
        console.log(`Player ${player.name} spawned at tile (${startTileX}, ${startTileY}), pixel (${player.x}, ${player.y})`);
    }

    onCreate(options: any) {
        console.log("HeartwoodRoom created!", options);
        
        // Initialize MapManager and load the large map
        this.mapManager = MapManager.getInstance();
        this.loadMap();
        
        // Initialize room state with proper schema
        this.setState(new GameState());
        this.state.timestamp = Date.now();
        
        // Update state with map dimensions
        const mapData = this.mapManager.getMap(this.MAP_ID);
        if (mapData) {
            this.state.mapWidth = mapData.width;
            this.state.mapHeight = mapData.height;
            this.state.tileSize = mapData.tileWidth;
        }
        
        // Register unified input message handler
        this.onMessage("player_input", (client: Client, message: { directions: string[], type: string, timestamp: number }) => {
            this.handlePlayerInput(client, message);
        });

        // Legacy message handlers (for backward compatibility)
        this.onMessage("move", (client: Client, message: { direction: string }) => {
            this.handlePlayerInput(client, { directions: [message.direction], type: 'discrete', timestamp: Date.now() });
        });

        this.onMessage("move_start", (client: Client, message: { direction: string }) => {
            this.handlePlayerInput(client, { directions: [message.direction], type: 'start', timestamp: Date.now() });
        });

        this.onMessage("move_stop", (client: Client, message: { direction: string }) => {
            this.handlePlayerInput(client, { directions: [], type: 'stop', timestamp: Date.now() });
        });

        this.onMessage("move_continuous", (client: Client, message: { directions: string[] }) => {
            this.handlePlayerInput(client, { directions: message.directions, type: 'continuous', timestamp: Date.now() });
        });

        this.onMessage("click", (client: Client, message: any) => {
            this.handlePlayerClick(client, message);
        });

        this.onMessage("rightclick", (client: Client, message: any) => {
            this.handlePlayerRightClick(client, message);
        });
        
        // Start the game loop
        this.startGameLoop();
        
        console.log("HeartwoodRoom: GameState initialized");
    }

    private loadMap() {
        try {
            // Load the large map data
            const mapPath = path.join(__dirname, '../maps/large_test_map.json');
            const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            
            // Load the map into the MapManager
            this.mapManager.loadMap(this.MAP_ID, mapData);
            
            console.log(`HeartwoodRoom: Loaded map ${this.MAP_ID} with dimensions ${mapData.width}x${mapData.height}`);
        } catch (error) {
            console.error('Failed to load map:', error);
            // Fallback to default small map dimensions
            this.state.mapWidth = 30;
            this.state.mapHeight = 20;
            this.state.tileSize = 16;
        }
    }

    private handlePlayerInput(client: Client, message: { directions: string[], type: string, timestamp: number }) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`Received input from unknown player: ${client.sessionId}`);
            return;
        }

        const { directions, type } = message;

        switch (type) {
            case 'discrete':
            case 'start':
                this.handleMovementStart(player, directions);
                break;
            case 'stop':
                this.handleMovementStop(player);
                break;
            case 'continuous':
                this.handleMovementContinuous(player, directions);
                break;
            default:
                console.warn(`Unknown input type: ${type}`);
        }
    }

    private handleMovementStart(player: Player, directions: string[]) {
        if (directions.length === 0) return;

        const direction = directions[0]; // Take first direction for single-direction start
        
        // Validate direction
        if (!MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS]) {
            console.warn(`Invalid direction received: ${direction}`);
            return;
        }

        // Set velocity for movement
        const delta = MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS];
        player.velocityX = delta.x * MOVEMENT_SPEED;
        player.velocityY = delta.y * MOVEMENT_SPEED;
        player.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
        player.isMoving = true;
        player.lastUpdate = Date.now();
        
        console.log(`Player ${player.name} started moving ${direction} with velocity (${player.velocityX}, ${player.velocityY})`);
    }

    private handleMovementStop(player: Player) {
        player.velocityX = 0;
        player.velocityY = 0;
        player.isMoving = false;
        player.lastUpdate = Date.now();
        
        console.log(`Player ${player.name} stopped moving`);
    }

    private handleMovementContinuous(player: Player, directions: string[]) {
        if (directions.length === 0) {
            this.handleMovementStop(player);
            return;
        }

        // Calculate combined velocity from all active directions
        let combinedVelocityX = 0;
        let combinedVelocityY = 0;
        let lastDirection = 0;
        
        directions.forEach(direction => {
            const delta = MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS];
            if (delta) {
                combinedVelocityX += delta.x * MOVEMENT_SPEED;
                combinedVelocityY += delta.y * MOVEMENT_SPEED;
                lastDirection = DIRECTIONS[direction as keyof typeof DIRECTIONS];
            }
        });

        // Normalize diagonal movement
        if (Math.abs(combinedVelocityX) > 0 && Math.abs(combinedVelocityY) > 0) {
            combinedVelocityX *= 0.707;
            combinedVelocityY *= 0.707;
        }

        // Update player with continuous movement
        player.velocityX = combinedVelocityX;
        player.velocityY = combinedVelocityY;
        player.direction = lastDirection;
        player.isMoving = true;
        player.lastUpdate = Date.now();
        
        console.log(`Player ${player.name} continuous movement: velocities (${player.velocityX}, ${player.velocityY})`);
    }

    // Legacy methods removed - now handled by unified handlePlayerInput system

    private handlePlayerClick(client: Client, message: any) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`Click from unknown player: ${client.sessionId}`);
            return;
        }

        // Server-side logging with comprehensive information
        console.log(`[SERVER] Player Click - Player: ${player.name} (${client.sessionId})`);
        console.log(`  Screen: (${message.screenX}, ${message.screenY})`);
        console.log(`  World: (${message.worldX}, ${message.worldY})`);
        console.log(`  Tile: (${message.tileX}, ${message.tileY})`);
        console.log(`  Button: ${message.button}`);
        console.log(`  Timestamp: ${new Date(message.timestamp).toISOString()}`);

        // You can add game logic here later, such as:
        // - Tile interaction
        // - Item placement
        // - Building construction
        // - NPC interaction
    }

    private handlePlayerRightClick(client: Client, message: any) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`Right-click from unknown player: ${client.sessionId}`);
            return;
        }

        // Server-side logging for right-click
        console.log(`[SERVER] Player Right-Click - Player: ${player.name} (${client.sessionId})`);
        console.log(`  Screen: (${message.screenX}, ${message.screenY})`);
        console.log(`  World: (${message.worldX}, ${message.worldY})`);
        console.log(`  Tile: (${message.tileX}, ${message.tileY})`);
        console.log(`  Timestamp: ${new Date(message.timestamp).toISOString()}`);

        // Right-click could be used for:
        // - Context menus
        // - Tool selection
        // - Quick actions
        // - Information display
    }

    onLeave(client: Client, consented: boolean) {
        console.log(`Player ${client.sessionId} left the heartwood_room`);
        
        // Remove player from state
        this.state.players.delete(client.sessionId);
    }

    private startGameLoop() {
        const deltaTime = 1000 / this.GAME_LOOP_RATE; // 16.67ms for 60 FPS
        
        this.gameLoopInterval = setInterval(() => {
            this.updateGameState(deltaTime);
        }, deltaTime);
        
        console.log(`Game loop started at ${this.GAME_LOOP_RATE} FPS`);
    }

    private updateGameState(deltaTime: number) {
        // Update all players
        this.state.players.forEach((player, sessionId) => {
            this.updatePlayerPhysics(player, deltaTime);
        });
        
        // Update game timestamp
        this.state.timestamp = Date.now();
    }

    private updatePlayerPhysics(player: Player, deltaTime: number) {
        if (!player.isMoving || (player.velocityX === 0 && player.velocityY === 0)) {
            return;
        }

        // Calculate movement delta based on velocity and time
        const deltaSeconds = deltaTime / 1000;
        const deltaX = player.velocityX * deltaSeconds;
        const deltaY = player.velocityY * deltaSeconds;
        
        // Calculate new position
        const newX = player.x + deltaX;
        const newY = player.y + deltaY;
        
        // Check bounds
        if (!this.mapManager.isPixelInBounds(this.MAP_ID, newX, newY)) {
            player.velocityX = 0;
            player.velocityY = 0;
            player.isMoving = false;
            return;
        }
        
        // Check collision
        const newTile = this.mapManager.pixelToTile(this.MAP_ID, newX, newY);
        if (this.mapManager.isTileWalkable(this.MAP_ID, newTile.tileX, newTile.tileY)) {
            player.x = newX;
            player.y = newY;
            player.lastUpdate = Date.now();
        } else {
            // Stop movement on collision
            player.velocityX = 0;
            player.velocityY = 0;
            player.isMoving = false;
        }
    }

    onDispose() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        console.log("HeartwoodRoom: Game loop stopped");
    }
} 