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
        player.lastUpdate = Date.now();
        
        // Add player to state
        this.state.players.set(client.sessionId, player);
        
        console.log(`✅ [SERVER] Player ${player.name} spawned at tile (${startTileX}, ${startTileY}) - Total players: ${this.state.players.size}`);
        
        // Publish player join action for agent observation
        this.publishPlayerAction({
            player_id: client.sessionId,
            action_type: 'join',
            location: `${startTileX},${startTileY}`,
            data: { name: player.name }
        });
        
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
        
        // Start the game loop
        this.startGameLoop();
        
        console.log("HeartwoodRoom: GameState initialized");
    }

    private loadMap() {
        try {
            // Load the Beacon Bay map data
            const mapPath = path.join(__dirname, '../maps/beacon_bay_map.json');
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
        
        //console.log(`Player ${player.name} continuous movement: velocities (${player.velocityX}, ${player.velocityY})`);
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
        } catch (error) {
            console.error('Error publishing player action:', error);
            // Don't break the game if Redis fails
        }
    }

    private publishPlayerMovement(playerId: string, tileX: number, tileY: number) {
        // Get player name from state
        const player = this.state.players.get(playerId);
        const playerName = player ? player.name : 'Unknown';
        
        // Publish movement event for agent observation system
        this.publishPlayerAction({
            player_id: playerId,
            action_type: 'move',
            location: `${tileX},${tileY}`,
            data: { name: playerName }
        });
    }

    onLeave(client: Client, consented: boolean) {
        const player = this.state.players.get(client.sessionId);
        const playerName = player ? player.name : 'Unknown';
        
        console.log(`👋 [SERVER] Player ${playerName} (${client.sessionId}) left the heartwood_room ${consented ? '(consented)' : '(disconnected)'}`);
        
        if (player) {
            // Publish player leave action for agent observation
            const tilePos = this.mapManager.pixelToTile(this.MAP_ID, player.x, player.y);
            this.publishPlayerAction({
                player_id: client.sessionId,
                action_type: 'leave',
                location: `${tilePos.tileX},${tilePos.tileY}`,
                data: { name: player.name }
            });
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
            // Store previous position
            const oldX = player.x;
            const oldY = player.y;
            
            // Update player position
            player.x = newX;
            player.y = newY;
            player.lastUpdate = Date.now();
            
            // Check if player moved to a new tile and publish movement event
            const oldTile = this.mapManager.pixelToTile(this.MAP_ID, oldX, oldY);
            if (oldTile.tileX !== newTile.tileX || oldTile.tileY !== newTile.tileY) {
                this.publishPlayerMovement(player.id, newTile.tileX, newTile.tileY);
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