import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema";
import { isTileWalkable, pixelToTile, tileToPixel, TILE_SIZE } from "../maps/townCollision";

// Direction constants
const DIRECTIONS = {
    down: 0,
    up: 1,
    left: 2,
    right: 3
};

// Movement deltas for each direction
const MOVEMENT_DELTAS = {
    up: { x: 0, y: -TILE_SIZE },
    down: { x: 0, y: TILE_SIZE },
    left: { x: -TILE_SIZE, y: 0 },
    right: { x: TILE_SIZE, y: 0 }
};

export class HeartwoodRoom extends Room<GameState> {
    maxClients = 10;

    onJoin(client: Client, options: any) {
        console.log(`Player ${client.sessionId} joined the heartwood_room`);
        
        // Create new player with proper schema
        const player = new Player();
        player.id = client.sessionId;
        player.name = options.name || `Player_${client.sessionId.substring(0, 8)}`;
        
        // Set starting position (center of map, safe area)
        const startTileX = 15; // Center of 30-tile wide map
        const startTileY = 5;  // Safe area in upper portion
        const startPixel = tileToPixel(startTileX, startTileY);
        
        player.x = startPixel.pixelX;
        player.y = startPixel.pixelY;
        player.direction = DIRECTIONS.down;
        player.isMoving = false;
        player.lastUpdate = Date.now();
        
        // Add player to state
        this.state.players.set(client.sessionId, player);
        
        console.log(`Player ${player.name} spawned at tile (${startTileX}, ${startTileY}), pixel (${player.x}, ${player.y})`);
    }

    onCreate(options: any) {
        console.log("HeartwoodRoom created!", options);
        
        // Initialize room state with proper schema
        this.setState(new GameState());
        this.state.timestamp = Date.now();
        
        // Register message handlers
        this.onMessage("move", (client: Client, message: { direction: string }) => {
            this.handlePlayerMovement(client, message);
        });

        this.onMessage("move_start", (client: Client, message: { direction: string }) => {
            this.handlePlayerMoveStart(client, message);
        });

        this.onMessage("move_stop", (client: Client, message: { direction: string }) => {
            this.handlePlayerMoveStop(client, message);
        });

        this.onMessage("move_continuous", (client: Client, message: { directions: string[] }) => {
            this.handlePlayerMoveContinuous(client, message);
        });

        this.onMessage("click", (client: Client, message: any) => {
            this.handlePlayerClick(client, message);
        });

        this.onMessage("rightclick", (client: Client, message: any) => {
            this.handlePlayerRightClick(client, message);
        });
        
        console.log("HeartwoodRoom: GameState initialized");
    }

    private handlePlayerMovement(client: Client, message: { direction: string }) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`Received message from unknown player: ${client.sessionId}`);
            return;
        }
    
        const { direction } = message;
        
        // Validate direction
        if (!MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS]) {
            console.warn(`Invalid direction received: ${direction}`);
            return;
        }
        
        // Calculate potential new position
        const delta = MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS];
        const newX = player.x + delta.x;
        const newY = player.y + delta.y;
        
        // Convert to tile coordinates for collision checking
        const newTile = pixelToTile(newX, newY);
        
        // Check if the new position is walkable
        if (isTileWalkable(newTile.tileX, newTile.tileY)) {
            // Update player position and velocity for smooth movement
            player.x = newX;
            player.y = newY;
            player.velocityX = delta.x;
            player.velocityY = delta.y;
            player.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
            player.isMoving = true;
            player.lastUpdate = Date.now();
            
            // Set velocity to 0 after a short time to stop movement
            setTimeout(() => {
                if (player) {
                    player.velocityX = 0;
                    player.velocityY = 0;
                    player.isMoving = false;
                }
            }, 200); // Adjust timing as needed
            
            console.log(`Player ${player.name} moved to tile (${newTile.tileX}, ${newTile.tileY}), pixel (${newX}, ${newY})`);
        } else {
            console.log(`Player ${player.name} movement blocked at tile (${newTile.tileX}, ${newTile.tileY})`);
            
            // Update direction even if movement is blocked
            player.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
            player.isMoving = false;
            player.velocityX = 0;
            player.velocityY = 0;
            player.lastUpdate = Date.now();
        }
    }

    private handlePlayerMoveStart(client: Client, message: { direction: string }) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`Move start from unknown player: ${client.sessionId}`);
            return;
        }

        const { direction } = message;
        
        // Validate direction
        if (!MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS]) {
            console.warn(`Invalid direction received: ${direction}`);
            return;
        }

        // Set velocity for continuous movement
        const delta = MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS];
        const moveSpeed = 2; // Pixels per frame - adjust as needed
        
        player.velocityX = (delta.x / Math.abs(delta.x || 1)) * moveSpeed;
        player.velocityY = (delta.y / Math.abs(delta.y || 1)) * moveSpeed;
        player.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
        player.isMoving = true;
        player.lastUpdate = Date.now();
        
        console.log(`Player ${player.name} started moving ${direction} with velocity (${player.velocityX}, ${player.velocityY})`);
    }

    private handlePlayerMoveStop(client: Client, message: { direction: string }) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`Move stop from unknown player: ${client.sessionId}`);
            return;
        }

        // Stop movement
        player.velocityX = 0;
        player.velocityY = 0;
        player.isMoving = false;
        player.lastUpdate = Date.now();
        
        console.log(`Player ${player.name} stopped moving`);
    }

    private handlePlayerMoveContinuous(client: Client, message: { directions: string[] }) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`Continuous move from unknown player: ${client.sessionId}`);
            return;
        }

        const { directions } = message;
        
        if (directions.length === 0) {
            // No directions, stop movement
            player.velocityX = 0;
            player.velocityY = 0;
            player.isMoving = false;
            return;
        }

        // Calculate combined velocity from all active directions
        let combinedVelocityX = 0;
        let combinedVelocityY = 0;
        let lastDirection = 0;
        const moveSpeed = 2; // Pixels per frame
        
        directions.forEach(direction => {
            const delta = MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS];
            if (delta) {
                combinedVelocityX += (delta.x / Math.abs(delta.x || 1)) * moveSpeed;
                combinedVelocityY += (delta.y / Math.abs(delta.y || 1)) * moveSpeed;
                lastDirection = DIRECTIONS[direction as keyof typeof DIRECTIONS];
            }
        });

        // Normalize diagonal movement
        if (Math.abs(combinedVelocityX) > 0 && Math.abs(combinedVelocityY) > 0) {
            combinedVelocityX *= 0.707; // 1/sqrt(2) for diagonal movement
            combinedVelocityY *= 0.707;
        }

        // Update player with continuous movement
        player.velocityX = combinedVelocityX;
        player.velocityY = combinedVelocityY;
        player.direction = lastDirection;
        player.isMoving = true;
        player.lastUpdate = Date.now();

        // Move the player smoothly
        const newX = player.x + combinedVelocityX;
        const newY = player.y + combinedVelocityY;
        
        // Check collision for new position
        const newTile = pixelToTile(newX, newY);
        if (isTileWalkable(newTile.tileX, newTile.tileY)) {
            player.x = newX;
            player.y = newY;
        } else {
            // Stop movement if collision
            player.velocityX = 0;
            player.velocityY = 0;
            player.isMoving = false;
        }
    }

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

    onDispose() {
        console.log("HeartwoodRoom disposed");
    }
} 