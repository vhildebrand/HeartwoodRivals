/**
 * Agent Spawner System
 * Handles spawning agents from database into the game world
 * Manages agent initialization and positioning
 */

import { Agent } from '../rooms/schema';
import { AgentStateMachine, AgentState, AgentStateData } from './AgentStateMachine';
import { MapManager } from '../maps/MapManager';
import { Pathfinding } from './Pathfinding';
import { ActivityManager } from './ActivityManager';
import { AgentMovementSystem } from './AgentMovementSystem';
import { GameTime } from './GameTime';
import * as fs from 'fs';
import * as path from 'path';

// Database connection interface (simplified for this system)
interface DatabasePool {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export interface AgentData {
  id: string;
  name: string;
  constitution: string;
  current_location: string;
  current_activity: string;
  energy_level: number;
  mood: string;
  primary_goal: string;
  secondary_goals: string[];
  personality_traits: string[];
  likes: string[];
  dislikes: string[];
  background: string;
  schedule: object;
  current_plans: string[];
  current_x: number;
  current_y: number;
  current_direction: string;
  current_action: string;
  emotional_state: object;
  physical_state: object;
}

export interface SpawnedAgent {
  schema: Agent;
  data: AgentData;
  stateMachine: AgentStateMachine;
  pathfinding: Pathfinding;
  activityManager: ActivityManager;
  movementSystem?: AgentMovementSystem; // Reference to the movement system
  nextScheduledAction?: string;
  nextScheduledTime?: string;
}

export class AgentSpawner {
  private pool: DatabasePool;
  private mapManager: MapManager;
  private mapId: string;
  private gameTime: GameTime;
  private spawnedAgents: Map<string, SpawnedAgent> = new Map();
  private locationMappings: Map<string, { x: number; y: number }> = new Map();

  constructor(pool: DatabasePool, mapId: string) {
    this.pool = pool;
    this.mapManager = MapManager.getInstance();
    this.mapId = mapId;
    this.gameTime = GameTime.getInstance();
    this.initializeLocationMappings();
  }

  /**
   * Spawn all agents from database
   */
  public async spawnAllAgents(): Promise<Map<string, SpawnedAgent>> {
    console.log('🎯 Starting agent spawning process...');
    
    try {
      let agentData = await this.loadAgentsFromDatabase();
      
      // If database is empty, try to load from JSON files
      if (agentData.length === 0) {
        console.log('⚠️ No agents found in database, attempting to load from JSON files...');
        agentData = await this.loadAgentsFromJsonFiles();
      }
      
      if (agentData.length === 0) {
        console.log('❌ No agents found in database or JSON files');
        return this.spawnedAgents;
      }
      
      for (const data of agentData) {
        const spawnedAgent = await this.spawnAgent(data);
        if (spawnedAgent) {
          this.spawnedAgents.set(data.id, spawnedAgent);
          console.log(`✅ Spawned agent: ${data.name} at (${spawnedAgent.schema.x}, ${spawnedAgent.schema.y})`);
        }
      }
      
      console.log(`🎉 Successfully spawned ${this.spawnedAgents.size} agents!`);
      return this.spawnedAgents;
      
    } catch (error) {
      console.error('❌ Error spawning agents:', error);
      throw error;
    }
  }

  /**
   * Spawn individual agent
   */
  public async spawnAgent(data: AgentData): Promise<SpawnedAgent | null> {
    try {
      // Create agent schema
      const agentSchema = new Agent();
      agentSchema.id = data.id;
      agentSchema.name = data.name;
      agentSchema.currentActivity = data.current_activity;
      agentSchema.currentLocation = data.current_location;
      agentSchema.energyLevel = data.energy_level;
      agentSchema.mood = data.mood;
      agentSchema.currentState = AgentState.IDLE;
      agentSchema.interactionTarget = '';
      agentSchema.isInteractable = true;
      
      // Set position
      const position = this.getAgentPosition(data);
      agentSchema.x = position.x;
      agentSchema.y = position.y;
      agentSchema.velocityX = 0;
      agentSchema.velocityY = 0;
      agentSchema.direction = this.parseDirection(data.current_direction || 'down');
      agentSchema.isMoving = false;
      agentSchema.lastUpdate = Date.now();
      
      // Create state machine
      const stateMachine = new AgentStateMachine(data.id, AgentState.IDLE);
      
      // Create pathfinding
      const pathfinding = new Pathfinding(this.mapId);
      
      // Schedule initial actions
      const nextAction = this.getNextScheduledAction(data);
      
      const spawnedAgent: SpawnedAgent = {
        schema: agentSchema,
        data,
        stateMachine,
        pathfinding,
        activityManager: new ActivityManager({
          schema: agentSchema,
          data,
          stateMachine,
          pathfinding,
          activityManager: null as any, // Will be set after creation
          nextScheduledAction: nextAction?.action,
          nextScheduledTime: nextAction?.time
        }),
        nextScheduledAction: nextAction?.action,
        nextScheduledTime: nextAction?.time
      };
      
      // Set the activity manager's agent reference
      spawnedAgent.activityManager = new ActivityManager(spawnedAgent);
      
      // Set up state machine callbacks
      this.setupStateMachineCallbacks(spawnedAgent);
      
      return spawnedAgent;
      
    } catch (error) {
      console.error(`❌ Error spawning agent ${data.name}:`, error);
      return null;
    }
  }

  /**
   * Get spawned agent by ID
   */
  public getAgent(agentId: string): SpawnedAgent | undefined {
    return this.spawnedAgents.get(agentId);
  }

  /**
   * Get all spawned agents
   */
  public getAllAgents(): Map<string, SpawnedAgent> {
    return this.spawnedAgents;
  }

  /**
   * Remove agent from spawned list
   */
  public removeAgent(agentId: string): void {
    this.spawnedAgents.delete(agentId);
  }

  /**
   * Update agent position in database
   */
  public async updateAgentPosition(agentId: string, x: number, y: number): Promise<void> {
    try {
      await this.pool.query(
        'UPDATE agent_states SET current_x = $1, current_y = $2, updated_at = now() WHERE agent_id = $3',
        [x, y, agentId]
      );
    } catch (error) {
      console.error(`Error updating agent position for ${agentId}:`, error);
    }
  }

  /**
   * Update agent state in database
   */
  public async updateAgentState(agentId: string, state: AgentState, activity?: string): Promise<void> {
    try {
      const updateQuery = activity
        ? 'UPDATE agent_states SET current_action = $1, updated_at = now() WHERE agent_id = $2'
        : 'UPDATE agent_states SET updated_at = now() WHERE agent_id = $1';
      
      const params = activity ? [activity, agentId] : [agentId];
      await this.pool.query(updateQuery, params);
      
      // Also update the agents table if activity changed
      if (activity) {
        await this.pool.query(
          'UPDATE agents SET current_activity = $1, updated_at = now() WHERE id = $2',
          [activity, agentId]
        );
      }
    } catch (error) {
      console.error(`Error updating agent state for ${agentId}:`, error);
    }
  }

  /**
   * Load agents from JSON files (fallback method)
   */
  private async loadAgentsFromJsonFiles(): Promise<AgentData[]> {
    const agentData: AgentData[] = [];
    
    try {
      // Look for JSON files in the db/agents directory
      const agentsDir = path.join(__dirname, '../../..', 'db', 'agents');
      
      if (!fs.existsSync(agentsDir)) {
        console.log('❌ No agents directory found at:', agentsDir);
        return agentData;
      }
      
      const agentFiles = fs.readdirSync(agentsDir).filter(file => file.endsWith('.json'));
      console.log(`📁 Found ${agentFiles.length} agent files`);
      
      for (const file of agentFiles) {
        const filePath = path.join(agentsDir, file);
        const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Convert JSON structure to AgentData format
        const agent: AgentData = {
          id: rawData.id,
          name: rawData.name,
          constitution: rawData.constitution,
          current_location: rawData.current_location,
          current_activity: rawData.current_activity,
          energy_level: rawData.energy_level,
          mood: rawData.mood,
          primary_goal: rawData.primary_goal,
          secondary_goals: rawData.secondary_goals || [],
          personality_traits: rawData.personality_traits || [],
          likes: rawData.likes || [],
          dislikes: rawData.dislikes || [],
          background: rawData.background,
          schedule: rawData.schedule,
          current_plans: rawData.current_plans || [],
          current_x: rawData.current_x,
          current_y: rawData.current_y,
          current_direction: rawData.current_direction || 'down',
          current_action: rawData.current_action || 'idle',
          emotional_state: rawData.emotional_state || {},
          physical_state: rawData.physical_state || {}
        };
        
        agentData.push(agent);
        console.log(`📄 Loaded agent ${agent.name} from JSON file`);
      }
      
    } catch (error) {
      console.error('❌ Error loading agents from JSON files:', error);
    }
    
    return agentData;
  }

  /**
   * Load agents from database
   */
  private async loadAgentsFromDatabase(): Promise<AgentData[]> {
    try {
      const query = `
        SELECT 
          a.id, a.name, a.constitution, a.current_location, a.current_activity,
          a.energy_level, a.mood, a.primary_goal, a.secondary_goals,
          a.personality_traits, a.likes, a.dislikes, a.background,
          a.schedule, a.current_plans,
          s.current_x, s.current_y, s.current_direction, s.current_action,
          s.emotional_state, s.physical_state
        FROM agents a
        LEFT JOIN agent_states s ON a.id = s.agent_id
        ORDER BY a.name
      `;
      
      const result = await this.pool.query(query);
      console.log(`📊 Database query returned ${result.rows.length} agents`);
      return result.rows;
    } catch (error) {
      console.error('❌ Database query failed:', error);
      return [];
    }
  }

  /**
   * Get agent position (from database or location mapping)
   */
  private getAgentPosition(data: AgentData): { x: number; y: number } {
    // If we have explicit coordinates, use them
    if (data.current_x !== null && data.current_y !== null) {
      return { x: data.current_x, y: data.current_y };
    }
    
    // Otherwise, try to map location name to coordinates
    const locationPosition = this.locationMappings.get(data.current_location);
    if (locationPosition) {
      return locationPosition;
    }
    
    // Fallback to a default safe position
    console.warn(`⚠️ No position found for agent ${data.name} at location ${data.current_location}, using default`);
    return this.findSafeSpawnPosition();
  }

  /**
   * Find a safe spawn position
   */
  private findSafeSpawnPosition(): { x: number; y: number } {
    const mapData = this.mapManager.getMap(this.mapId);
    if (!mapData) {
      return { x: 50, y: 50 }; // Fallback
    }
    
    // Try to find a walkable tile near the center
    const centerX = Math.floor(mapData.width / 2);
    const centerY = Math.floor(mapData.height / 2);
    
    for (let radius = 1; radius < 20; radius++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
          if (this.mapManager.isTileWalkable(this.mapId, x, y)) {
            return { x, y };
          }
        }
      }
    }
    
    return { x: centerX, y: centerY };
  }

  /**
   * Parse direction string to number
   */
  private parseDirection(direction: string): number {
    switch (direction.toLowerCase()) {
      case 'up': return 1;
      case 'down': return 0;
      case 'left': return 2;
      case 'right': return 3;
      default: return 0;
    }
  }

  /**
   * Get next scheduled action for agent
   */
  private getNextScheduledAction(data: AgentData): { action: string; time: string } | null {
    if (!data.schedule || typeof data.schedule !== 'object') {
      return null;
    }
    
    const schedule = data.schedule as { [key: string]: string | { activity: string; description: string } };
    const currentTime = this.gameTime.getCurrentTimeString();
    
    // Find next action after current time
    const sortedTimes = Object.keys(schedule).sort();
    
    for (const time of sortedTimes) {
      if (time > currentTime) {
        const scheduleEntry = schedule[time];
        const action = typeof scheduleEntry === 'string' ? scheduleEntry : scheduleEntry.activity;
        return { action, time };
      }
    }
    
    // If no action found for today, return first action of next day
    if (sortedTimes.length > 0) {
      const firstTime = sortedTimes[0];
      const scheduleEntry = schedule[firstTime];
      const action = typeof scheduleEntry === 'string' ? scheduleEntry : scheduleEntry.activity;
      return { action, time: firstTime };
    }
    
    return null;
  }

  /**
   * Setup state machine callbacks
   */
  private setupStateMachineCallbacks(spawnedAgent: SpawnedAgent): void {
    const { stateMachine, schema } = spawnedAgent;
    
    // Update schema when state changes
    stateMachine.onStateChange(AgentState.IDLE, (stateData: AgentStateData) => {
      schema.currentState = AgentState.IDLE;
      schema.isMoving = false;
      schema.velocityX = 0;
      schema.velocityY = 0;
    });
    
    stateMachine.onStateChange(AgentState.MOVING, (stateData: AgentStateData) => {
      schema.currentState = AgentState.MOVING;
      schema.isMoving = true;
    });
    
    stateMachine.onStateChange(AgentState.WORKING, (stateData: AgentStateData) => {
      schema.currentState = AgentState.WORKING;
      schema.isMoving = false;
      schema.velocityX = 0;
      schema.velocityY = 0;
      
      if (stateData.data) {
        schema.currentActivity = stateData.data.activity || schema.currentActivity;
      }
    });
    
    stateMachine.onStateChange(AgentState.INTERACTING, (stateData: AgentStateData) => {
      schema.currentState = AgentState.INTERACTING;
      schema.isMoving = false;
      schema.velocityX = 0;
      schema.velocityY = 0;
      
      if (stateData.data) {
        schema.interactionTarget = stateData.data.targetId || '';
      }
    });
  }

  /**
   * Initialize location mappings from map data
   */
  private initializeLocationMappings(): void {
    try {
      // Load location mappings from the beacon bay locations file
      const locationsPath = require('path').join(__dirname, '../maps/beacon_bay_locations.json');
      const locations = require(locationsPath);
      
      for (const [locationKey, locationData] of Object.entries(locations)) {
        if (typeof locationData === 'object' && locationData !== null) {
          const location = locationData as any;
          if (location.x !== undefined && location.y !== undefined) {
            this.locationMappings.set(locationKey, { x: location.x, y: location.y });
            
            // Also map by name if available
            if (location.name) {
              this.locationMappings.set(location.name.toLowerCase(), { x: location.x, y: location.y });
            }
          }
        }
      }
      
      console.log(`📍 Loaded ${this.locationMappings.size} location mappings`);
      
    } catch (error) {
      console.error('⚠️ Error loading location mappings:', error);
    }
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): object {
    return {
      spawnedAgents: this.spawnedAgents.size,
      locationMappings: this.locationMappings.size,
      mapId: this.mapId
    };
  }
} 