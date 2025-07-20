import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema";
import { MapManager } from "../maps/MapManager";
import { createClient } from 'redis';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { GameTime, GameTimeConfig } from "../systems/GameTime";
import { AgentSpawner, SpawnedAgent } from "../systems/AgentSpawner";
import { PlanExecutor } from "../systems/PlanExecutor";
import { AgentMovementSystem } from "../systems/AgentMovementSystem";
import { PlanningSystem } from "../systems/PlanningSystem";
import { ThoughtSystem } from "../systems/ThoughtSystem";
import { SpeedDatingManager } from "../systems/SpeedDatingManager";

// Database pool interface
interface DatabasePool {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

// Direction constants
const DIRECTIONS = {
    down: 0,
    up: 1,
    left: 2,
    right: 3
};

// Movement deltas for each direction
const TILE_SIZE = 16;
const MOVEMENT_SPEED = 180; // pixels per second (reduced from 360 for slower movement)
const MOVEMENT_DELTAS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

export class HeartwoodRoom extends Room<GameState> {
    maxClients = 10;
    private mapManager!: MapManager;
    private readonly MAP_ID = 'beacon_bay';
    private gameLoopInterval: NodeJS.Timeout | null = null;
    private readonly GAME_LOOP_RATE = 60; // 60 FPS server updates
    private redisClient: any; // Redis client for publishing player actions
    private playerLastTilePositions: Map<string, { x: number; y: number }> = new Map();
    
    // Agent systems
    private gameTime!: GameTime;
    private agentSpawner!: AgentSpawner;
    private planExecutor!: PlanExecutor;
    private agentMovementSystem!: AgentMovementSystem;
    private planningSystem!: PlanningSystem;
    private thoughtSystem!: ThoughtSystem;
    private speedDatingManager!: SpeedDatingManager;
    
    // Chat system
    private chatHistory: Array<{
        id: string;
        playerId: string;
        playerName: string;
        message: string;
        location: string;
        timestamp: number;
        type: 'public_speech' | 'system';
    }> = [];
    private chatMessageCounter = 1;
    private databasePool!: DatabasePool;
    private agents: Map<string, SpawnedAgent> = new Map();
    private lastPlanningDay: number = 0;
    
    // NPC-NPC conversation system
    private activeNPCConversations: Map<string, {
        id: string;
        initiatorId: string;
        responderId: string;
        topic: string;
        approach: string;
        currentTurn: number;
        maxTurns: number;
        conversationLog: Array<{ speaker: string, message: string, timestamp: number }>;
        startTime: number;
    }> = new Map();

    onJoin(client: Client, options: any) {
        console.log(`👤 [SERVER] Player ${client.sessionId} joined the heartwood_room`);
        
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
        player.currentActivity = "No activity set";
        player.lastUpdate = Date.now();
        
        // Add player to state
        this.state.players.set(client.sessionId, player);
        
        console.log(`✅ [SERVER] Player ${player.name} spawned at tile (${startTileX}, ${startTileY}) - Total players: ${this.state.players.size}`);
        

        
        console.log(`Player ${player.name} spawned at tile (${startTileX}, ${startTileY}), pixel (${player.x}, ${player.y})`);
    }

    onCreate(options: any) {
        console.log("HeartwoodRoom created!", options);
        
        // Initialize Redis client for agent observations
        this.initializeRedis();
        
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
        
        // Initialize agent systems
        this.initializeAgentSystems();
        
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
        
        // Time control message handlers
        this.onMessage("set_time", (client: Client, message: { time: string }) => {
            this.handleSetTime(client, message);
        });
        
        this.onMessage("advance_time", (client: Client, message: { hours: number }) => {
            this.handleAdvanceTime(client, message);
        });
        
        this.onMessage("set_speed", (client: Client, message: { speedMultiplier: number }) => {
            this.handleSetSpeed(client, message);
        });
        
        // Add debug time message handler
        this.onMessage("debug_time", (client: Client, message: any) => {
            this.handleDebugTime(client, message);
        });

        // Player text interface message handlers
        this.onMessage("player_speech", (client: Client, message: { message: string; location: string; timestamp: number }) => {
            this.handlePlayerSpeech(client, message);
        });

        this.onMessage("player_activity", (client: Client, message: { message: string; location: string; timestamp: number }) => {
            this.handlePlayerActivity(client, message);
        });

        // Speed dating message handler
        this.onMessage("speed_dating_message", (client, data) => {
            this.handleSpeedDatingMessage(client, data);
        });

        // Note: Gauntlet results are now automatically broadcast after event completion
        // No need for manual request handler

        // Manual speed dating start message handler
        this.onMessage("start_speed_dating", (client: Client, message: any) => {
            this.handleManualSpeedDatingStart(client, message);
        });

        // Chat history request handler
        this.onMessage("request_chat_history", (client: Client) => {
            this.sendChatHistory(client);
        });
        
        // Start the game loop
        this.startGameLoop();
        
        console.log("HeartwoodRoom: GameState initialized");
    }

    private loadMap() {
        try {
            // Load the Beacon Bay map data
            const mapPath = path.join(__dirname, '../maps/beacon_bay_map_copy.json');
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
        
        //console.log(`Player ${player.name} started moving ${direction} with velocity (${player.velocityX}, ${player.velocityY})`);
    }

    private handleMovementStop(player: Player) {
        player.velocityX = 0;
        player.velocityY = 0;
        player.isMoving = false;
        player.lastUpdate = Date.now();
        
        //console.log(`Player ${player.name} stopped moving`);
    }

    private calculateDirectionFromVelocity(velocityX: number, velocityY: number): number {
        // If no movement, return down as default
        if (velocityX === 0 && velocityY === 0) {
            return DIRECTIONS.down;
        }
        
        // For diagonal movement, prioritize the direction with the larger velocity component
        // This ensures the animation matches the primary direction of movement
        if (Math.abs(velocityX) > Math.abs(velocityY)) {
            // Horizontal movement is dominant
            return velocityX > 0 ? DIRECTIONS.right : DIRECTIONS.left;
        } else {
            // Vertical movement is dominant (or equal)
            return velocityY > 0 ? DIRECTIONS.down : DIRECTIONS.up;
        }
    }

    private handleMovementContinuous(player: Player, directions: string[]) {
        if (directions.length === 0) {
            this.handleMovementStop(player);
            return;
        }

        // Calculate combined velocity from all active directions
        let combinedVelocityX = 0;
        let combinedVelocityY = 0;
        
        directions.forEach(direction => {
            const delta = MOVEMENT_DELTAS[direction as keyof typeof MOVEMENT_DELTAS];
            if (delta) {
                combinedVelocityX += delta.x * MOVEMENT_SPEED;
                combinedVelocityY += delta.y * MOVEMENT_SPEED;
            }
        });

        // Normalize diagonal movement
        if (Math.abs(combinedVelocityX) > 0 && Math.abs(combinedVelocityY) > 0) {
            combinedVelocityX *= 0.707;
            combinedVelocityY *= 0.707;
        }
        
        // Round velocities to reduce floating point precision issues
        combinedVelocityX = Math.round(combinedVelocityX * 100) / 100;
        combinedVelocityY = Math.round(combinedVelocityY * 100) / 100;

        // Calculate proper direction based on combined velocity
        const calculatedDirection = this.calculateDirectionFromVelocity(combinedVelocityX, combinedVelocityY);

        // Update player with continuous movement
        player.velocityX = combinedVelocityX;
        player.velocityY = combinedVelocityY;
        player.direction = calculatedDirection;
        player.isMoving = true;
        player.lastUpdate = Date.now();
        
        //console.log(`Player ${player.name} continuous movement: velocities (${player.velocityX}, ${player.velocityY}), direction: ${calculatedDirection}`);
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

        // add game logic here later, such as:
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

    private handleSetTime(client: Client, message: { time: string }) {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        console.log(`🕐 [SERVER] Player ${player.name} set time to: ${message.time}`);
        
        if (this.gameTime) {
            this.gameTime.setTime(message.time);
            this.updateGameTimeState();
            
            // Trigger immediate agent schedule processing
            if (this.planExecutor) {
                this.planExecutor.processScheduledActions(this.agents);
            }
        }
    }

    private handleAdvanceTime(client: Client, message: { hours: number }) {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        console.log(`⏰ [SERVER] Player ${player.name} advanced time by ${message.hours} hours`);
        
        if (this.gameTime) {
            const currentTime = this.gameTime.getCurrentTime();
            const newTime = (currentTime + (message.hours * 60)) % 1440; // Wrap at 24 hours
            const newTimeString = this.formatTimeMinutes(newTime);
            
            this.gameTime.setTime(newTimeString);
            this.updateGameTimeState();
            
            // Trigger immediate agent schedule processing
            if (this.planExecutor) {
                this.planExecutor.processScheduledActions(this.agents);
            }
        }
    }

    private handleSetSpeed(client: Client, message: { speedMultiplier: number }) {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        console.log(`🚀 [SERVER] Player ${player.name} set speed multiplier to: ${message.speedMultiplier}x`);
        
        if (this.gameTime) {
            this.gameTime.setSpeedMultiplier(message.speedMultiplier);
            this.state.speedMultiplier = message.speedMultiplier;
            this.updateGameTimeState();
        }
    }

    private handleDebugTime(client: Client, message: any) {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        console.log(`🕐 [DEBUG] Player ${player.name} requested time debug info`);
        
        if (this.gameTime) {
            const debugInfo = this.gameTime.getDebugInfo();
            const currentTime = this.gameTime.getCurrentTime();
            const currentTimeString = this.gameTime.getCurrentTimeString();
            const currentDay = this.gameTime.getCurrentDay();
            
            console.log(`🕐 [DEBUG] Game Time Status:`, {
                ...debugInfo,
                currentTimeMinutes: currentTime,
                currentTimeString,
                currentDay,
                timestamp: Date.now()
            });
        } else {
            console.log(`❌ [DEBUG] GameTime not initialized`);
        }
    }

    private handlePlayerSpeech(client: Client, message: { message: string; location: string; timestamp: number }) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`🗣️ [SERVER] Public speech from unknown player: ${client.sessionId}`);
            return;
        }

        console.log(`🗣️ [SERVER] Player ${player.name} says publicly: "${message.message}" at ${message.location}`);
        
        // Create chat message entry
        const chatMessage = {
            id: `chat_${this.chatMessageCounter++}`,
            playerId: client.sessionId,
            playerName: player.name,
            message: message.message,
            location: message.location,
            timestamp: message.timestamp,
            type: 'public_speech' as const
        };
        
        // Store in chat history
        this.chatHistory.push(chatMessage);
        
        // Keep only last 100 messages
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }
        
        // Broadcast to all players
        this.broadcast('chat_message', chatMessage);
        
        // Publish player speech as a witnessable event for NPCs
        this.publishPlayerAction({
            player_id: client.sessionId,
            action_type: 'public_speech',
            location: message.location,
            data: { 
                name: player.name,
                speech: message.message,
                timestamp: message.timestamp
            }
        });

        // Send confirmation back to client
        client.send('speech_confirmed', {
            message: message.message,
            timestamp: Date.now()
        });
    }

    private handlePlayerActivity(client: Client, message: { message: string; location: string; timestamp: number }) {
        const player = this.state.players.get(client.sessionId);
        
        if (!player) {
            console.warn(`🎯 [SERVER] Activity update from unknown player: ${client.sessionId}`);
            return;
        }

        console.log(`🎯 [SERVER] Player ${player.name} updates activity: "${message.message}" at ${message.location}`);
        
        // Update player activity in game state so other players can see it
        player.currentActivity = message.message;
        
        // Publish player activity update as a witnessable event
        this.publishPlayerAction({
            player_id: client.sessionId,
            action_type: 'activity_update',
            location: message.location,
            data: { 
                name: player.name,
                activity: message.message,
                timestamp: message.timestamp
            }
        });

        // Send confirmation back to client
        client.send('activity_confirmed', {
            message: message.message,
            timestamp: Date.now()
        });
    }

    private handleSpeedDatingMessage(client: Client, message: { matchId: number; message: string }) {
        if (!this.speedDatingManager) {
            console.error('❌ [SPEED_DATING] SpeedDatingManager not available');
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (!player) {
            console.error('❌ [SPEED_DATING] Player not found');
            return;
        }

        console.log(`💕 [SPEED_DATING] Player ${player.id} sent message: "${message.message}"`);
        
        // Process the message through the speed dating manager
        this.speedDatingManager.processDateConversation(
            player.id,
            message.message
        );
    }

    private handleManualSpeedDatingStart(client: Client, message: any) {
        console.log(`🎯 [SPEED_DATING] Player ${client.sessionId} manually triggered speed dating start`);
        console.log(`📊 [SPEED_DATING] Message data:`, message);
        
        // Check if player is authorized to start speed dating (for now, any player can start)
        if (!this.speedDatingManager) {
            console.error('❌ [SPEED_DATING] SpeedDatingManager not available');
            return;
        }
        
        // Extract current player count from message or calculate from current players
        const currentPlayerCount = message.currentPlayerCount || this.state.players.size;
        console.log(`📊 [SPEED_DATING] Using player count: ${currentPlayerCount} (from message: ${message.currentPlayerCount}, actual: ${this.state.players.size})`);
        
        // Start the full speed dating event (initialize, register participants, then countdown)
        this.startSpeedDatingEvent(currentPlayerCount);
    }



    private formatTimeMinutes(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    private async initializeRedis() {
        try {
            this.redisClient = createClient({
                url: process.env.REDIS_URL || 'redis://redis:6379'
            });
            
            await this.redisClient.connect();
            console.log('✅ Redis connected in HeartwoodRoom - agent observations enabled');
            
            // Subscribe to plan generation requests
            const planSubscriber = this.redisClient.duplicate();
            await planSubscriber.connect();
            
            await planSubscriber.subscribe('generate_plan', (message: string) => {
                try {
                    const planRequest = JSON.parse(message);
                    console.log(`📋 [DEBUG] Received plan generation request for ${planRequest.agentName}`);
                    this.handlePlanGenerationRequest(planRequest);
                } catch (error) {
                    console.error('❌ Error processing plan generation request:', error);
                }
            });
            
            // Start processing emergency schedule reload queue
            this.startEmergencyScheduleProcessor();
            
            console.log('✅ Subscribed to plan generation and emergency schedule reload requests');
        } catch (error) {
            console.error('❌ Redis connection failed:', error);
            console.log('⚠️  Game will continue without agent observations');
            this.redisClient = null;
        }
    }

    private async setupThoughtSystemListeners() {
        if (!this.redisClient) {
            console.log('⚠️  No Redis client - thought system listeners disabled');
            return;
        }

        try {
            // Create subscriber for thought-triggered actions
            const thoughtSubscriber = this.redisClient.duplicate();
            await thoughtSubscriber.connect();

            // Listen for immediate activity changes triggered by thoughts
            await thoughtSubscriber.subscribe('immediate_activity_change', (message: string) => {
                try {
                    const activityChange = JSON.parse(message);
                    console.log(`🧠 [THOUGHT] Received immediate activity change: ${activityChange.agentId} -> ${activityChange.activity}`);
                    this.handleImmediateActivityChange(activityChange);
                } catch (error) {
                    console.error('❌ Error processing immediate activity change:', error);
                }
            });

            // Listen for scheduled activities from thoughts
            await thoughtSubscriber.subscribe('schedule_activity', (message: string) => {
                try {
                    const scheduleData = JSON.parse(message);
                    console.log(`🧠 [THOUGHT] Received schedule activity request: ${scheduleData.agentId} -> ${scheduleData.activity} at ${scheduleData.time}`);
                    this.handleScheduleActivity(scheduleData);
                } catch (error) {
                    console.error('❌ Error processing scheduled activity:', error);
                }
            });

            // Listen for conversation initiation from thoughts
            await thoughtSubscriber.subscribe('initiate_conversation', (message: string) => {
                try {
                    const conversationData = JSON.parse(message);
                    console.log(`💬 [THOUGHT] NPC ${conversationData.agentId} wants to initiate conversation with ${conversationData.target}`);
                    this.handleConversationInitiation(conversationData);
                } catch (error) {
                    console.error('❌ Error processing conversation initiation:', error);
                }
            });

            // Legacy listeners for backward compatibility
            await thoughtSubscriber.subscribe('game_server_activity_change', (message: string) => {
                try {
                    const activityChange = JSON.parse(message);
                    console.log(`🧠 [THOUGHT] Received legacy activity change request: ${activityChange.agentId} -> ${activityChange.activityName}`);
                    this.handleThoughtTriggeredActivity(activityChange);
                } catch (error) {
                    console.error('❌ Error processing thought-triggered activity:', error);
                }
            });

            await thoughtSubscriber.subscribe('planning_system_update', (message: string) => {
                try {
                    const planUpdate = JSON.parse(message);
                    console.log(`🧠 [THOUGHT] Received legacy planning update: ${planUpdate.agentId} -> ${planUpdate.activity}`);
                    this.handleThoughtTriggeredScheduleUpdate(planUpdate);
                } catch (error) {
                    console.error('❌ Error processing thought-triggered schedule update:', error);
                }
            });

            console.log('✅ Thought system listeners initialized (immediate_activity_change, schedule_activity, initiate_conversation)');
        } catch (error) {
            console.error('❌ Failed to setup thought system listeners:', error);
        }
    }

    private async initializeAgentSystems() {
        console.log('🤖 Initializing agent systems...');
        
        try {
            // Initialize PostgreSQL connection
            const pool = new Pool({
                host: process.env.DB_HOST || 'postgres',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'heartwood_db',
                user: process.env.DB_USER || 'heartwood_user',
                password: process.env.DB_PASSWORD || 'heartwood_password',
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
            
            // Test database connection
            try {
                await pool.query('SELECT 1');
                console.log('✅ Database connection established');
            } catch (dbError) {
                console.error('❌ Database connection failed:', dbError);
                console.log('⚠️  Using mock database - no agents will be spawned');
                // Fallback to mock database
                this.databasePool = {
                    query: async (text: string, params?: any[]) => {
                        console.log('Mock database query:', text);
                        return { rows: [] };
                    }
                };
            }
            
            this.databasePool = pool;
            
            // Initialize game time system
            const gameTimeConfig: GameTimeConfig = {
                startTime: "06:00",
                speedMultiplier: 30.0, // 1 minute = 2 seconds (for testing)
                dayDurationMs: 24 * 60 * 1000 // 24 minutes = 1 day
            };
            
            this.gameTime = GameTime.getInstance(gameTimeConfig);
            
            // Initialize agent systems
            this.agentSpawner = new AgentSpawner(this.databasePool, this.MAP_ID);
            this.planExecutor = new PlanExecutor(pool);
            this.agentMovementSystem = new AgentMovementSystem(this.MAP_ID);
            this.planningSystem = new PlanningSystem(pool, this.redisClient);
            
            // Initialize ThoughtSystem (requires memory manager - will be created in web-api)
            // For now, we'll just set up Redis listeners for thought-triggered actions
            this.setupThoughtSystemListeners();
            
            // Set up movement callbacks
            this.agentMovementSystem.onMovementUpdate((update) => {
                const agent = this.agents.get(update.agentId);
                if (agent) {
                    // Update agent in game state
                    this.state.agents.set(update.agentId, agent.schema);
                }
            });
            
            // Actually spawn agents from database
            try {
                const spawnedAgents = await this.agentSpawner.spawnAllAgents();
                this.agents = spawnedAgents;
                
                // Set movement system reference for all agents
                spawnedAgents.forEach((agent, agentId) => {
                    agent.movementSystem = this.agentMovementSystem;
                    this.state.agents.set(agentId, agent.schema);
                });
                
                console.log(`✅ Added ${spawnedAgents.size} agents to game state`);
                
                // Load agent schedules into the plan executor
                if (this.planExecutor && this.agents.size > 0) {
                    await this.planExecutor.loadAgentSchedules(this.agents);
                    console.log(`📅 [SERVER] Loaded schedules for ${this.agents.size} agents`);
                }
            } catch (spawnError) {
                console.error('❌ Failed to spawn agents:', spawnError);
            }
            
            // Initialize Speed Dating Manager with targeted broadcast support and player name lookup
            this.speedDatingManager = new SpeedDatingManager(this.agents, (eventType: string, data: any, targetPlayer?: string) => {
                if (targetPlayer) {
                    // Send to specific player
                    this.clients.forEach((client) => {
                        if (client.sessionId === targetPlayer) {
                            client.send(eventType, data);
                        }
                    });
                } else {
                    // Broadcast to all players
                    this.broadcast(eventType, data);
                }
            }, (playerId: string) => {
                // Player name lookup function
                const player = this.state.players.get(playerId);
                return player?.name || `Player_${playerId.substring(0, 8)}`;
            });
            console.log('💕 [SERVER] Speed Dating Manager initialized');
            
            // Speed dating is now manually triggered by players via UI button
            console.log('💕 [SERVER] Speed dating ready for manual activation');
            
            // Update game state with time
            this.updateGameTimeState();
            
        } catch (error) {
            console.error('❌ Failed to initialize agent systems:', error);
        }
    }

    private updateGameTimeState() {
        if (this.gameTime) {
            const newTime = this.gameTime.getCurrentTimeString();
            const newDay = this.gameTime.getCurrentDay();
            
            // Add debug logging every 30 seconds (at 60fps, that's about 1800 frames)
            if (Math.random() < 0.0006) { // About once every 30 seconds
                console.log(`🕐 [TIME_PROGRESS] Current time: ${newTime}, Day: ${newDay}`);
            }
            
            // Log time changes
            if (this.state.currentGameTime !== newTime) {
                console.log(`🕐 [SERVER] Game time updated: ${this.state.currentGameTime} -> ${newTime}`);
            }
            if (this.state.gameDay !== newDay) {
                console.log(`📅 [SERVER] Game day updated: ${this.state.gameDay} -> ${newDay}`);
            }
            
            this.state.currentGameTime = newTime;
            this.state.gameDay = newDay;
        }
    }

    private async startSpeedDatingEvent(currentPlayerCount?: number) {
        if (!this.speedDatingManager) {
            console.error('❌ [SPEED_DATING] SpeedDatingManager not initialized');
            return;
        }

        // Check if an event is already in progress
        const currentEventStatus = this.speedDatingManager.getEventStatus();
        if (currentEventStatus.status !== 'no_event') {
            console.warn(`⚠️ [SPEED_DATING] Event already in progress (status: ${currentEventStatus.status}), skipping new event`);
            return;
        }

        try {
            console.log('💕 [SPEED_DATING] Starting speed dating event...');
            
            // Use provided player count or fall back to current players
            const playerCount = currentPlayerCount || this.state.players.size;
            console.log(`📊 [SPEED_DATING] Initializing event for ${playerCount} players`);
            
            // Create event with current player count
            await this.speedDatingManager.initializeEvent({
                eventName: `Daily Romance - Day ${this.gameTime.getCurrentDay()}`,
                location: 'town_square',
                seasonTheme: 'Harvest Romance'
            }, playerCount);
            
            // Register all online players
            const playerIds = Array.from(this.state.players.keys());
            for (const playerId of playerIds) {
                await this.speedDatingManager.registerPlayer(playerId);
                console.log(`💕 [SPEED_DATING] Registered player: ${playerId}`);
            }
            
            // Register a selection of NPCs based on player count
            // Select exactly as many NPCs as there are players for balanced rotation
            const npcsPerEvent = Math.min(playerCount, this.agents.size); // Equal to player count
            
            // Randomly select NPCs using Fisher-Yates shuffle
            const allNPCs = Array.from(this.agents.keys());
            
            // Shuffle the array and take the first npcsPerEvent NPCs
            for (let i = allNPCs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allNPCs[i], allNPCs[j]] = [allNPCs[j], allNPCs[i]];
            }
            
            const selectedNPCs = allNPCs.slice(0, npcsPerEvent);
            
            await this.speedDatingManager.registerNPCs(selectedNPCs);
            console.log(`💕 [SPEED_DATING] Registered ${selectedNPCs.length} NPCs for ${playerCount} players`);
            
            // Start countdown (10 seconds as specified in requirements)
            // The SpeedDatingManager will handle all countdown broadcasts
            this.speedDatingManager.startCountdown();
            
            console.log('💕 [SPEED_DATING] Speed dating countdown started!');
            
        } catch (error) {
            console.error('❌ [SPEED_DATING] Failed to start speed dating event:', error);
        }
    }

    private async publishPlayerAction(action: {
        player_id: string;
        action_type: string;
        location: string;
        target?: string;
        data?: any;
    }) {
        if (!this.redisClient) {
            // Silently skip if Redis is not available
            return;
        }
        
        try {
            const actionData = {
                ...action,
                timestamp: new Date()
            };
            
            await this.redisClient.publish('player_actions', JSON.stringify(actionData));
            console.log(`📢 [REDIS] Published player action: ${action.action_type} at ${action.location} for ${action.data?.name || action.player_id}`);
        } catch (error) {
            console.error('Error publishing player action:', error);
            // Don't break the game if Redis fails
        }
    }



    private publishPlayerCurrentActivity(playerId: string, playerName: string, location: string, currentActivity: string) {
        if (!this.redisClient) {
            return;
        }
        
        try {
            const activityObservationData = {
                player_id: playerId,
                player_name: playerName,
                location: location,
                current_activity: currentActivity,
                timestamp: new Date()
            };
            
            this.redisClient.publish('player_current_activity', JSON.stringify(activityObservationData));
            console.log(`📢 [REDIS] Published current activity observation for ${playerName} at ${location}: ${currentActivity}`);
        } catch (error) {
            console.error('Error publishing player current activity:', error);
        }
    }

    onLeave(client: Client, consented: boolean) {
        const player = this.state.players.get(client.sessionId);
        const playerName = player ? player.name : 'Unknown';
        
        console.log(`👋 [SERVER] Player ${playerName} (${client.sessionId}) left the heartwood_room ${consented ? '(consented)' : '(disconnected)'}`);
        
        if (player) {
            // Player left - no observation needed
        }
        
        // Remove player from state
        this.state.players.delete(client.sessionId);
        
        console.log(`📊 [SERVER] Remaining players: ${this.state.players.size}`);
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
        
        // Update agent systems
        this.updateAgentSystems(deltaTime);
        
        // Update game timestamp
        this.state.timestamp = Date.now();
    }

    private updateAgentSystems(deltaTime: number) {
        if (!this.gameTime || !this.agentMovementSystem || !this.planExecutor) {
            return;
        }
        
        // Update game time
        this.gameTime.processEvents();
        this.updateGameTimeState();
        
        // Disable automatic daily planning - only use manual triggering
        // Check for new day and trigger planning
        // const currentDay = this.gameTime.getCurrentDay();
        // if (currentDay !== this.lastPlanningDay) {
        //     this.lastPlanningDay = currentDay;
        //     console.log(`📅 [SERVER] New day ${currentDay} started - triggering agent planning`);
        //     this.triggerDailyPlanning();
        // }
        
        // Update agent movement
        this.agentMovementSystem.updateMovement(this.agents, deltaTime / 1000);
        
        // Update agent state machines and activity managers
        for (const [agentId, agent] of this.agents) {
            agent.stateMachine.update();
            agent.activityManager.update();
        }
        
        // Process scheduled actions more frequently for responsiveness
        // Process every 10 frames (~6 times per second at 60fps) for better responsiveness
        if (Math.random() < 0.16) { // 16% chance per frame (~10 times per second at 60fps)
            this.planExecutor.processScheduledActions(this.agents);
            
            // Log NPC status occasionally
            if (Math.random() < 0.05) { // 5% of the time we process actions
                const activeAgents = Array.from(this.agents.values());
                if (activeAgents.length > 0) {
                    const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
                    console.log(`🤖 [SERVER] NPC ${randomAgent.schema.name} at (${randomAgent.schema.x}, ${randomAgent.schema.y}) - Activity: ${randomAgent.schema.currentActivity}`);
                }
            }
        }
    }

    /**
     * Handle manual plan generation request from debug panel
     */
    private async handlePlanGenerationRequest(planRequest: { agentId: string; agentName: string; forceRegenerate?: boolean; timestamp: number }) {
        try {
            const agent = this.agents.get(planRequest.agentId);
            if (!agent) {
                console.error(`❌ [DEBUG] Agent ${planRequest.agentId} not found`);
                return;
            }

            console.log(`📋 [DEBUG] Starting ${planRequest.forceRegenerate ? 'forced' : 'manual'} plan generation for ${agent.data.name}`);

            if (this.planningSystem) {
                let plan = null;
                
                if (planRequest.forceRegenerate) {
                    // Force regenerate the plan, replacing any existing plans
                    plan = await this.planningSystem.forceRegeneratePlan(agent);
                } else {
                    // Normal plan generation (only if needed)
                    const needsPlan = await this.planningSystem.needsDailyPlan(agent);
                    if (needsPlan) {
                        plan = await this.planningSystem.generateDailyPlan(agent);
                    } else {
                        console.log(`📋 [DEBUG] ${agent.data.name} already has a recent plan, skipping generation`);
                        return;
                    }
                }
                
                if (plan) {
                    console.log(`✅ [DEBUG] Generated plan for ${agent.data.name}: ${plan.daily_goal}`);
                    
                    // Reload schedules to use the new plan
                    if (this.planExecutor) {
                        await this.planExecutor.reloadSchedules(this.agents);
                        console.log(`📅 [DEBUG] Reloaded schedules with new plan for ${agent.data.name}`);
                    }
                } else {
                    console.error(`❌ [DEBUG] Failed to generate plan for ${agent.data.name}`);
                }
            } else {
                console.error(`❌ [DEBUG] Planning system not initialized`);
            }
        } catch (error) {
            console.error(`❌ [DEBUG] Error in manual plan generation:`, error);
        }
    }

    private async handleEmergencyScheduleReload(reloadRequest: { type: string; agent_id: string; timestamp: number }) {
        try {
            const agent = this.agents.get(reloadRequest.agent_id);
            if (!agent) {
                console.error(`❌ [EMERGENCY] Agent ${reloadRequest.agent_id} not found for emergency reload`);
                return;
            }
            
            if (this.planExecutor) {
                console.log(`🚨 [EMERGENCY] Processing emergency schedule reload for ${agent.data.name}`);
                
                // Reload the agent's schedule - this will automatically execute emergency actions
                await this.planExecutor.reloadAgentSchedule(reloadRequest.agent_id, this.agents);
                
                console.log(`✅ [EMERGENCY] Emergency schedule reload completed for ${agent.data.name}`);
            } else {
                console.error(`❌ [EMERGENCY] Plan executor not initialized`);
            }
        } catch (error) {
            console.error(`❌ [EMERGENCY] Error in emergency schedule reload:`, error);
        }
    }

    private async startEmergencyScheduleProcessor() {
        if (!this.redisClient) {
            console.error('❌ [EMERGENCY] Redis client not available for emergency schedule processing');
            return;
        }

        // Process emergency schedule reload queue more frequently for better responsiveness
        const processQueue = async () => {
            try {
                const queuedItem = await this.redisClient.brPop('schedule_reload_queue', 0.1);
                if (queuedItem) {
                    const reloadRequest = JSON.parse(queuedItem.element);
                    console.log(`🚨 [EMERGENCY] Processing schedule reload request for ${reloadRequest.agent_id}`);
                    await this.handleEmergencyScheduleReload(reloadRequest);
                }
            } catch (error) {
                console.error('❌ [EMERGENCY] Error processing emergency schedule queue:', error);
            }
        };

        // Process queue every 500ms for better responsiveness
        setInterval(processQueue, 500);
        console.log('✅ [EMERGENCY] Emergency schedule processor started (checking every 500ms)');
    }

    private async triggerDailyPlanning() {
        if (!this.planningSystem || this.agents.size === 0) {
            return;
        }
        
        try {
            console.log(`📋 [SERVER] Starting daily planning for ${this.agents.size} agents`);
            
            let plansGenerated = 0;
            
            // Generate plans for each agent that needs one
            for (const [agentId, agent] of this.agents) {
                try {
                    const needsPlan = await this.planningSystem.needsDailyPlan(agent);
                    if (needsPlan) {
                        console.log(`📋 [SERVER] Generating plan for ${agent.data.name}`);
                        const plan = await this.planningSystem.generateDailyPlan(agent);
                        if (plan) {
                            console.log(`✅ [SERVER] Generated plan for ${agent.data.name}: ${plan.daily_goal}`);
                            plansGenerated++;
                        }
                    }
                } catch (error) {
                    console.error(`❌ [SERVER] Error generating plan for ${agent.data.name}:`, error);
                }
            }
            
            // Reload schedules if any plans were generated
            if (plansGenerated > 0 && this.planExecutor) {
                console.log(`📅 [SERVER] Reloading schedules for ${plansGenerated} newly generated plans`);
                await this.planExecutor.reloadSchedules(this.agents);
            }
            
            console.log(`📋 [SERVER] Daily planning completed (${plansGenerated} plans generated)`);
        } catch (error) {
            console.error(`❌ [SERVER] Error in daily planning:`, error);
        }
    }

    /**
     * Handle thought-triggered immediate activity changes
     */
    private async handleThoughtTriggeredActivity(activityChange: any) {
        const { agentId, activityName, priority, interruptCurrent, parameters } = activityChange;
        
        const agent = this.agents.get(agentId);
        if (!agent) {
            console.error(`❌ [THOUGHT] Agent ${agentId} not found for activity change`);
            return;
        }

        try {
            console.log(`🧠 [THOUGHT] Processing activity change for ${agent.data.name}: ${activityName}`);
            
            // Use the existing activity manager to handle the change
            const result = agent.activityManager.requestActivity({
                activityName,
                priority: priority || 10,
                interruptCurrent: interruptCurrent || true,
                parameters: parameters || {}
            });

            if (result.success) {
                console.log(`✅ [THOUGHT] Successfully changed activity for ${agent.data.name}: ${activityName}`);
            } else {
                console.error(`❌ [THOUGHT] Failed to change activity for ${agent.data.name}: ${result.message}`);
            }
        } catch (error) {
            console.error(`❌ [THOUGHT] Error processing activity change for ${agent.data.name}:`, error);
        }
    }

    /**
     * Handle thought-triggered schedule updates
     */
    private async handleThoughtTriggeredScheduleUpdate(planUpdate: any) {
        const { agentId, action, activity, time, location, priority, reason } = planUpdate;
        
        const agent = this.agents.get(agentId);
        if (!agent) {
            console.error(`❌ [THOUGHT] Agent ${agentId} not found for schedule update`);
            return;
        }

        try {
            console.log(`🧠 [THOUGHT] Processing schedule update for ${agent.data.name}: ${action}`);
            
            if (action === 'add_scheduled_activity') {
                // Add the scheduled activity to the plan executor
                if (this.planExecutor) {
                    this.planExecutor.addCustomAction(agentId, {
                        agentId,
                        time,
                        action: activity,
                        description: reason,
                        location,
                        priority: priority || 7,
                        duration: 1800000 // 30 minutes default
                    });
                    
                    console.log(`✅ [THOUGHT] Added scheduled activity for ${agent.data.name}: ${activity} at ${time}`);
                }
            }
        } catch (error) {
            console.error(`❌ [THOUGHT] Error processing schedule update for ${agent.data.name}:`, error);
        }
    }

    private updatePlayerPhysics(player: Player, deltaTime: number) {
        if (!player.isMoving || (player.velocityX === 0 && player.velocityY === 0)) {
            return;
        }

        // Calculate movement delta based on velocity and time
        const deltaSeconds = deltaTime / 1000;
        const deltaX = Math.round(player.velocityX * deltaSeconds * 100) / 100;
        const deltaY = Math.round(player.velocityY * deltaSeconds * 100) / 100;
        
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
            // Store previous position
            const oldX = player.x;
            const oldY = player.y;
            
            // Update player position with precision rounding to reduce jitter
            player.x = Math.round(newX * 100) / 100; // Round to 2 decimal places
            player.y = Math.round(newY * 100) / 100;
            player.lastUpdate = Date.now();
            
            // Check if player moved to a new tile and publish current activity observation
            const oldTile = this.mapManager.pixelToTile(this.MAP_ID, oldX, oldY);
            if (oldTile.tileX !== newTile.tileX || oldTile.tileY !== newTile.tileY) {
                // Only publish current activity observation if player has a meaningful activity
                if (player.currentActivity && player.currentActivity !== 'idle' && player.currentActivity !== 'No activity set') {
                    this.publishPlayerCurrentActivity(player.id, player.name, `${newTile.tileX},${newTile.tileY}`, player.currentActivity);
                }
            }
        } else {
            // Stop movement on collision
            player.velocityX = 0;
            player.velocityY = 0;
            player.isMoving = false;
        }
    }

    /**
     * Send chat history to a specific client
     */
    private sendChatHistory(client: Client) {
        client.send('chat_history', {
            messages: this.chatHistory
        });
    }

    /**
     * Add a system message to chat
     */
    addSystemMessage(message: string) {
        const systemMessage = {
            id: `chat_${this.chatMessageCounter++}`,
            playerId: 'system',
            playerName: 'System',
            message: message,
            location: 'global',
            timestamp: Date.now(),
            type: 'system' as const
        };
        
        this.chatHistory.push(systemMessage);
        
        // Keep only last 100 messages
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }
        
        // Broadcast to all players
        this.broadcast('chat_message', systemMessage);
    }

    // Handler for immediate activity changes from ThoughtSystem
    private async handleImmediateActivityChange(data: any) {
        const { agentId, activity, location, reason, priority } = data;
        const agent = this.agents.get(agentId);
        
        if (!agent) {
            console.error(`❌ [THOUGHT] Agent ${agentId} not found for immediate activity change`);
            return;
        }

        console.log(`🚨 [THOUGHT] Executing immediate activity change for ${agent.data.name}: ${activity}`);
        
        try {
            // Force interrupt current activity with emergency priority
            const result = agent.activityManager.requestActivity({
                activityName: activity,
                priority: priority || 10,
                interruptCurrent: true,
                parameters: {
                    emergency: true,
                    reason: reason,
                    emergencyLocation: location
                }
            });

            if (result.success) {
                console.log(`✅ [THOUGHT] ${agent.data.name} started emergency activity: ${activity}`);
            } else {
                console.error(`❌ [THOUGHT] Failed to start emergency activity for ${agent.data.name}: ${result.message}`);
            }
        } catch (error) {
            console.error(`❌ [THOUGHT] Error executing immediate activity change for ${agentId}:`, error);
        }
    }

    // Handler for scheduled activities from ThoughtSystem  
    private async handleScheduleActivity(data: any) {
        const { agentId, activity, time, location, reason, priority } = data;
        
        console.log(`📅 [THOUGHT] Scheduling activity for ${agentId}: ${activity} at ${time}`);
        
        try {
            // Use the existing plan executor method if available
            if (this.planExecutor && 'addCustomAction' in this.planExecutor) {
                (this.planExecutor as any).addCustomAction(agentId, {
                    agentId,
                    time,
                    action: activity,
                    description: reason || `Thought-triggered activity: ${activity}`,
                    location,
                    priority: priority || 7,
                    duration: 1800000 // 30 minutes default
                });
                
                console.log(`✅ [THOUGHT] Scheduled ${activity} for agent ${agentId} at ${time}`);
            } else {
                console.error(`❌ [THOUGHT] PlanExecutor method not available for scheduling`);
            }
        } catch (error) {
            console.error(`❌ [THOUGHT] Error scheduling activity for ${agentId}:`, error);
        }
    }

    // Handler for conversation initiation from ThoughtSystem
    private async handleConversationInitiation(data: any) {
        const { agentId, target, topic, approach, timing, opening_message } = data;
        const initiatorAgent = this.agents.get(agentId);
        
        // Add debug logging for forced conversations
        if (data.forced_debug) {
            console.log(`🐛 [DEBUG] Processing forced conversation initiation: ${data.agentId} -> ${data.target}`);
            // Store in Redis for debug status endpoint
            await this.redisClient.lPush('conversation_debug_log', JSON.stringify({
                type: 'forced_initiation',
                agentId: data.agentId,
                target: data.target,
                topic: data.topic,
                approach: data.approach,
                timing: data.timing,
                opening_message: data.opening_message,
                timestamp: new Date().toISOString()
            }));
            await this.redisClient.expire('conversation_debug_log', 3600); // Keep for 1 hour
        }
        
        if (!initiatorAgent) {
            console.error(`❌ [CONVERSATION] Initiator agent ${agentId} not found`);
            if (data.forced_debug) {
                await this.redisClient.lPush('conversation_debug_log', JSON.stringify({
                    type: 'error',
                    message: `Initiator agent ${agentId} not found`,
                    timestamp: new Date().toISOString()
                }));
            }
            return;
        }

        console.log(`💬 [CONVERSATION] ${initiatorAgent.data.name} wants to initiate conversation with ${target} about ${topic}`);
        console.log(`💬 [CONVERSATION] Opening message: "${opening_message}"`);
        
        try {
            // Check if target is a player or NPC
            const isTargetPlayer = this.state.players.has(target);
            const isTargetNPC = this.agents.has(target);
            
            if (!isTargetPlayer && !isTargetNPC) {
                console.error(`❌ [CONVERSATION] Target ${target} not found (neither player nor NPC)`);
                if (data.forced_debug) {
                    await this.redisClient.lPush('conversation_debug_log', JSON.stringify({
                        type: 'error',
                        message: `Target ${target} not found`,
                        timestamp: new Date().toISOString()
                    }));
                }
                return;
            }

            if (timing === 'immediate') {
                // Execute conversation initiation immediately
                await this.executeConversationInitiation(initiatorAgent, target, topic, approach, opening_message, isTargetPlayer);
            } else {
                // Schedule conversation for later
                await this.scheduleConversationInitiation(initiatorAgent, target, topic, approach, timing, isTargetPlayer, opening_message);
            }
            
        } catch (error) {
            console.error(`❌ [CONVERSATION] Error handling conversation initiation:`, error);
            if (data.forced_debug) {
                await this.redisClient.lPush('conversation_debug_log', JSON.stringify({
                    type: 'error',
                    message: `Error handling conversation initiation: ${error}`,
                    timestamp: new Date().toISOString()
                }));
            }
        }
    }

    // Execute immediate conversation initiation
    private async executeConversationInitiation(initiatorAgent: any, target: string, topic: string, approach: string, opening_message: string, isTargetPlayer: boolean) {
        console.log(`💬 [CONVERSATION] Executing immediate conversation: ${initiatorAgent.data.name} -> ${target}`);
        console.log(`💬 [CONVERSATION] Topic: ${topic}, Approach: ${approach}, IsPlayer: ${isTargetPlayer}`);
        
        if (isTargetPlayer) {
            // Initiate conversation with player
            const targetPlayer = this.state.players.get(target);
            if (targetPlayer) {
                // Calculate distance to verify proximity
                const distance = Math.sqrt(
                    Math.pow(initiatorAgent.schema.x - targetPlayer.x, 2) + 
                    Math.pow(initiatorAgent.schema.y - targetPlayer.y, 2)
                );
                
                const conversationRange = 32;
                console.log(`💬 [CONVERSATION] Distance check: ${distance.toFixed(1)} pixels (range: ${conversationRange})`);
                
                if (distance <= conversationRange) {
                    // Send conversation initiation to specific player with LLM-generated opening message
                    this.clients.forEach((client) => {
                        if (client.sessionId === target) {
                            console.log(`💬 [CONVERSATION] Sending conversation initiation to client ${target}`);
                            client.send('npc_conversation_initiated', {
                                npcId: initiatorAgent.data.id,
                                npcName: initiatorAgent.data.name,
                                topic: topic,
                                approach: approach,
                                message: opening_message || `${initiatorAgent.data.name} approaches you to chat.`
                            });
                        }
                    });
                    
                    console.log(`✅ [CONVERSATION] ${initiatorAgent.data.name} initiated conversation with player ${targetPlayer.name}`);
                    console.log(`✅ [CONVERSATION] Opening message: "${opening_message}"`);
                } else {
                    console.log(`⚠️ [CONVERSATION] ${initiatorAgent.data.name} too far from player ${targetPlayer.name} (${distance.toFixed(1)} pixels)`);
                    // Schedule approach and then conversation
                    this.scheduleApproachAndConversation(initiatorAgent, targetPlayer, topic, approach, opening_message);
                }
            } else {
                console.error(`❌ [CONVERSATION] Player ${target} not found in game state`);
            }
        } else {
            // Initiate conversation with another NPC
            const targetAgent = this.agents.get(target);
            if (targetAgent) {
                console.log(`💬 [NPC-NPC] Starting conversation: ${initiatorAgent.data.name} -> ${targetAgent.data.name}`);
                await this.initiateNPCToNPCConversation(initiatorAgent, targetAgent, topic, approach, opening_message);
            } else {
                console.error(`❌ [CONVERSATION] Target NPC ${target} not found in agents map`);
            }
        }
    }

    // Schedule conversation for later
    private async scheduleConversationInitiation(initiatorAgent: any, target: string, topic: string, approach: string, timing: string, isTargetPlayer: boolean, opening_message: string) {
        console.log(`📅 [CONVERSATION] Scheduling conversation: ${initiatorAgent.data.name} -> ${target} (timing: ${timing})`);
        
        // Convert timing to schedule format
        let scheduleTime = 'NOW';
        if (timing === 'later_today') {
            // Schedule for 1-2 hours later
            const currentTime = this.gameTime?.getCurrentTimeString() || '12:00';
            const [hours, minutes] = currentTime.split(':').map(Number);
            const newHour = (hours + 1 + Math.floor(Math.random() * 2)) % 24;
            scheduleTime = `${newHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else if (timing === 'tomorrow') {
            scheduleTime = '09:00'; // Schedule for morning
        }

        // Schedule as a social activity
        await this.handleScheduleActivity({
            agentId: initiatorAgent.data.id,
            activity: 'initiate_conversation',
            time: scheduleTime,
            location: isTargetPlayer ? 'find_player' : 'find_npc',
            reason: `Initiate conversation with ${target} about ${topic}`,
            priority: 6,
            conversationData: { target, topic, approach, opening_message, isTargetPlayer }
        });
    }

    // Schedule approach and then conversation for distant targets
    private async scheduleApproachAndConversation(initiatorAgent: any, targetPlayer: any, topic: string, approach: string, opening_message: string) {
        console.log(`🚶 [CONVERSATION] ${initiatorAgent.data.name} scheduling approach to ${targetPlayer.name}`);
        
        // Schedule movement to player's location first
        await this.handleScheduleActivity({
            agentId: initiatorAgent.data.id,
            activity: 'approach_for_conversation',
            time: 'NOW',
            location: targetPlayer.currentLocation || 'find_player',
            reason: `Approach ${targetPlayer.name} for conversation about ${topic}`,
            priority: 8,
            conversationData: { target: targetPlayer.id, topic, approach, opening_message, isTargetPlayer: true }
        });
    }

    // Generate conversation opener based on approach and topic
    private generateConversationOpener(approach: string, topic: string): string {
        const openers = {
            friendly: [`Hey there! I wanted to talk to you about ${topic}.`, `Good to see you! Can we chat about ${topic}?`],
            professional: [`Excuse me, I'd like to discuss ${topic} with you.`, `I have some information about ${topic} to share.`],
            casual: [`Oh hey, did you hear about ${topic}?`, `I was just thinking about ${topic}...`],
            urgent: [`This is important - we need to talk about ${topic}!`, `I need to tell you something about ${topic} right away!`],
            curious: [`I'm curious about ${topic} - what do you think?`, `Have you noticed anything about ${topic}?`]
        };

        const approachOpeners = openers[approach as keyof typeof openers] || openers.friendly;
        return approachOpeners[Math.floor(Math.random() * approachOpeners.length)];
    }

    // NPC-NPC Conversation System (3 turns max)
    private async initiateNPCToNPCConversation(
        initiatorAgent: any, 
        targetAgent: any, 
        topic: string, 
        approach: string, 
        opening_message: string
    ): Promise<void> {
        const conversationId = `${initiatorAgent.data.id}_${targetAgent.data.id}_${Date.now()}`;
        
        console.log(`💬 [NPC-NPC] Initiating conversation ${conversationId}`);
        console.log(`💬 [NPC-NPC] ${initiatorAgent.data.name} -> ${targetAgent.data.name}: "${opening_message}"`);
        
        // Create conversation record
        const conversation = {
            id: conversationId,
            initiatorId: initiatorAgent.data.id,
            responderId: targetAgent.data.id,
            topic,
            approach,
            currentTurn: 1,
            maxTurns: 3,
            conversationLog: [{
                speaker: initiatorAgent.data.name,
                message: opening_message,
                timestamp: Date.now()
            }],
            startTime: Date.now()
        };
        
        this.activeNPCConversations.set(conversationId, conversation);
        
        // Broadcast the opening message to all clients for dialogue display
        this.broadcast('npc_dialogue_message', {
            speakerId: initiatorAgent.data.id,
            speakerName: initiatorAgent.data.name,
            listenerId: targetAgent.data.id,
            listenerName: targetAgent.data.name,
            message: opening_message,
            conversationId: conversationId,
            turn: 1,
            maxTurns: 3
        });
        
        // Trigger turn 2 (target NPC responds)
        setTimeout(async () => {
            await this.processNPCConversationTurn(conversationId);
        }, 2000); // 2 second delay between turns
    }

    private async processNPCConversationTurn(conversationId: string): Promise<void> {
        const conversation = this.activeNPCConversations.get(conversationId);
        if (!conversation) {
            console.error(`❌ [NPC-NPC] Conversation ${conversationId} not found`);
            return;
        }

        const initiator = this.agents.get(conversation.initiatorId);
        const responder = this.agents.get(conversation.responderId);
        
        if (!initiator || !responder) {
            console.error(`❌ [NPC-NPC] Missing agents for conversation ${conversationId}`);
            return;
        }

        if (conversation.currentTurn >= conversation.maxTurns) {
            // End conversation
            await this.endNPCConversation(conversationId);
            return;
        }

        conversation.currentTurn++;
        
        // Determine current speaker
        const isInitiatorTurn = conversation.currentTurn % 2 === 0;
        const currentSpeaker = isInitiatorTurn ? responder : initiator;
        const currentListener = isInitiatorTurn ? initiator : responder;
        
        console.log(`💬 [NPC-NPC] Turn ${conversation.currentTurn}: ${currentSpeaker.data.name} responding to ${currentListener.data.name}`);
        
        try {
            // Generate response using LLM
            const response = await this.generateNPCConversationResponse(
                currentSpeaker,
                currentListener,
                conversation
            );
            
            // Add to conversation log
            conversation.conversationLog.push({
                speaker: currentSpeaker.data.name,
                message: response,
                timestamp: Date.now()
            });
            
            console.log(`💬 [NPC-NPC] ${currentSpeaker.data.name}: "${response}"`);
            
            // Broadcast the response message to all clients for dialogue display
            this.broadcast('npc_dialogue_message', {
                speakerId: currentSpeaker.data.id,
                speakerName: currentSpeaker.data.name,
                listenerId: currentListener.data.id,
                listenerName: currentListener.data.name,
                message: response,
                conversationId: conversationId,
                turn: conversation.currentTurn,
                maxTurns: conversation.maxTurns
            });
            
            // Schedule next turn or end conversation
            if (conversation.currentTurn < conversation.maxTurns) {
                setTimeout(async () => {
                    await this.processNPCConversationTurn(conversationId);
                }, 2000);
            } else {
                // End conversation after final turn
                setTimeout(async () => {
                    await this.endNPCConversation(conversationId);
                }, 1000);
            }
            
        } catch (error) {
            console.error(`❌ [NPC-NPC] Error generating response for ${currentSpeaker.data.name}:`, error);
            await this.endNPCConversation(conversationId);
        }
    }

    private async generateNPCConversationResponse(
        speaker: any,
        listener: any,
        conversation: any
    ): Promise<string> {
        // Get recent conversation context
        const recentMessages = conversation.conversationLog.slice(-2).map((log: any) => 
            `${log.speaker}: "${log.message}"`
        ).join('\n');
        
        const isLastTurn = conversation.currentTurn === conversation.maxTurns;
        
        const prompt = `You are ${speaker.data.name}, having a brief conversation with ${listener.data.name}.

YOUR IDENTITY:
${speaker.data.constitution}

CONVERSATION CONTEXT:
- Topic: ${conversation.topic}
- Approach: ${conversation.approach}
- Turn ${conversation.currentTurn} of ${conversation.maxTurns} (${isLastTurn ? 'FINAL TURN' : 'continuing'})

RECENT CONVERSATION:
${recentMessages}

INSTRUCTIONS:
${isLastTurn ? 
  '- This is the FINAL turn. Wrap up the conversation naturally with a closing statement.' :
  '- Respond naturally and briefly to what was just said. Keep it conversational and authentic to your character.'
}
- Keep your response to 1-2 sentences maximum
- Stay in character and reflect your personality
- Be natural and conversational
- ${isLastTurn ? 'End on a friendly note' : 'Continue the conversation topic'}

Respond with ONLY your dialogue (no quotes or attribution needed):`;

        try {
            // Use web-api endpoint for consistency
            const response = await fetch('http://web-api:3000/npc/interact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    npcId: speaker.data.id,
                    message: prompt,
                    characterId: listener.data.id,
                    context: 'npc_conversation',
                    contextDetails: {
                        conversationId: conversation.id,
                        turn: conversation.currentTurn,
                        maxTurns: conversation.maxTurns,
                        topic: conversation.topic,
                        isLastTurn
                    }
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const result = await response.json() as any;
                if (result.status === 'processing') {
                    // For NPC conversations, use a simpler fallback if processing fails
                    return isLastTurn ? 
                        "Well, it's been good talking with you." :
                        "That's interesting to think about.";
                }
            }
            
            // Fallback response
            return isLastTurn ? 
                "I should get back to my work now. Good talking with you!" :
                "I see what you mean.";
                
        } catch (error) {
            console.error(`❌ [NPC-NPC] Error generating response:`, error);
            return isLastTurn ? 
                "I should get going now." :
                "Hmm, that's something to consider.";
        }
    }

    private async endNPCConversation(conversationId: string): Promise<void> {
        const conversation = this.activeNPCConversations.get(conversationId);
        if (!conversation) return;

        const initiator = this.agents.get(conversation.initiatorId);
        const responder = this.agents.get(conversation.responderId);
        
        console.log(`✅ [NPC-NPC] Ending conversation ${conversationId} after ${conversation.currentTurn} turns`);
        
        if (initiator && responder) {
            // Broadcast conversation end to clients for dialogue cleanup
            this.broadcast('npc_conversation_ended', {
                conversationId: conversationId,
                initiatorId: conversation.initiatorId,
                responderId: conversation.responderId
            });
            
            // Store conversation as memory for both NPCs
            await this.storeNPCConversationMemory(conversation, initiator, responder);
            
            console.log(`💭 [NPC-NPC] Stored conversation memory for ${initiator.data.name} and ${responder.data.name}`);
        }
        
        // Remove from active conversations
        this.activeNPCConversations.delete(conversationId);
    }

    private async storeNPCConversationMemory(
        conversation: any,
        initiator: any,
        responder: any
    ): Promise<void> {
        try {
            const conversationSummary = conversation.conversationLog
                .map((log: any) => `${log.speaker}: "${log.message}"`)
                .join(' ');

            const duration = Date.now() - conversation.startTime;

            // Store memory for initiator
            await this.publishPlayerAction({
                player_id: 'system',
                action_type: 'npc_conversation_memory',
                location: initiator.data.current_location,
                data: {
                    agentId: initiator.data.id,
                    memory: `Had a brief conversation with ${responder.data.name} about ${conversation.topic}. ${conversationSummary}`,
                    importance: 6,
                    relatedAgents: [responder.data.id]
                }
            });

            // Store memory for responder
            await this.publishPlayerAction({
                player_id: 'system',
                action_type: 'npc_conversation_memory',
                location: responder.data.current_location,
                data: {
                    agentId: responder.data.id,
                    memory: `Had a brief conversation with ${initiator.data.name} about ${conversation.topic}. ${conversationSummary}`,
                    importance: 6,
                    relatedAgents: [initiator.data.id]
                }
            });

        } catch (error) {
            console.error('❌ [NPC-NPC] Error storing conversation memory:', error);
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