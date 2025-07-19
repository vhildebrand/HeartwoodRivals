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
const MOVEMENT_SPEED = 360; // pixels per second (increased from 20)
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
    private databasePool!: DatabasePool;
    private agents: Map<string, SpawnedAgent> = new Map();
    private lastPlanningDay: number = 0;

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
        
        // Publish player speech as a witnessable event
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
        
        // Check if player is authorized to start speed dating (for now, any player can start)
        if (!this.speedDatingManager) {
            console.error('❌ [SPEED_DATING] SpeedDatingManager not available');
            return;
        }
        
        // Start the full speed dating event (initialize, register participants, then countdown)
        this.startSpeedDatingEvent();
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
            await thoughtSubscriber.subscribe('game_server_activity_change', (message: string) => {
                try {
                    const activityChange = JSON.parse(message);
                    console.log(`🧠 [THOUGHT] Received activity change request: ${activityChange.agentId} -> ${activityChange.activityName}`);
                    this.handleThoughtTriggeredActivity(activityChange);
                } catch (error) {
                    console.error('❌ Error processing thought-triggered activity:', error);
                }
            });

            // Listen for schedule updates from thoughts
            await thoughtSubscriber.subscribe('planning_system_update', (message: string) => {
                try {
                    const planUpdate = JSON.parse(message);
                    console.log(`🧠 [THOUGHT] Received planning update: ${planUpdate.agentId} -> ${planUpdate.activity}`);
                    this.handleThoughtTriggeredScheduleUpdate(planUpdate);
                } catch (error) {
                    console.error('❌ Error processing thought-triggered schedule update:', error);
                }
            });

            console.log('✅ Thought system listeners initialized');
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

    private async startSpeedDatingEvent() {
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
            
            // Create event
            await this.speedDatingManager.initializeEvent({
                eventName: `Daily Romance - Day ${this.gameTime.getCurrentDay()}`,
                location: 'town_square',
                seasonTheme: 'Harvest Romance'
            });
            
            // Register all online players
            const playerIds = Array.from(this.state.players.keys());
            for (const playerId of playerIds) {
                await this.speedDatingManager.registerPlayer(playerId);
                console.log(`💕 [SPEED_DATING] Registered player: ${playerId}`);
            }
            
            // Register a selection of NPCs based on player count
            // More players = fewer NPCs per player for reasonable match duration
            const playerCount = playerIds.length;
            const npcsPerEvent = Math.min(
                Math.max(2, 5 - playerCount), // 2-4 NPCs based on player count
                this.agents.size // Don't exceed available NPCs
            );
            
            // Randomly select NPCs
            const allNPCs = Array.from(this.agents.keys());
            const selectedNPCs: string[] = [];
            
            for (let i = 0; i < npcsPerEvent && i < allNPCs.length; i++) {
                const randomIndex = Math.floor(Math.random() * allNPCs.length);
                const npcId = allNPCs[randomIndex];
                if (!selectedNPCs.includes(npcId)) {
                    selectedNPCs.push(npcId);
                } else {
                    i--; // Try again if duplicate
                }
            }
            
            await this.speedDatingManager.registerNPCs(selectedNPCs);
            console.log(`💕 [SPEED_DATING] Registered ${selectedNPCs.length} NPCs for ${playerCount} players`);
            
            // Start countdown (15 seconds as specified in requirements)
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

    onDispose() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        console.log("HeartwoodRoom: Game loop stopped");
    }
} 