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
            // Update player position
            player.x = newX;
            player.y = newY;
            player.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
            player.isMoving = true;
            player.lastUpdate = Date.now();
            
            // Log successful movement
            console.log(`Player ${player.name} moved to tile (${newTile.tileX}, ${newTile.tileY}), pixel (${newX}, ${newY})`);
        } else {
            // Log blocked movement
            console.log(`Player ${player.name} movement blocked at tile (${newTile.tileX}, ${newTile.tileY})`);
            
            // Update direction even if movement is blocked
            player.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
            player.isMoving = false;
            player.lastUpdate = Date.now();
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