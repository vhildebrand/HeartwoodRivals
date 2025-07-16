import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
    @type("string") id!: string;
    @type("string") name!: string;
    @type("number") x!: number;
    @type("number") y!: number;
    @type("number") velocityX!: number;  // Add velocity for smooth movement
    @type("number") velocityY!: number;  // Add velocity for smooth movement
    @type("number") direction!: number;  // 0=down, 1=up, 2=left, 3=right
    @type("boolean") isMoving!: boolean;
    @type("number") lastUpdate!: number;
}

export class Agent extends Schema {
    @type("string") id!: string;
    @type("string") name!: string;
    @type("number") x!: number;
    @type("number") y!: number;
    @type("number") velocityX!: number;
    @type("number") velocityY!: number;
    @type("number") direction!: number;  // 0=down, 1=up, 2=left, 3=right
    @type("boolean") isMoving!: boolean;
    @type("string") currentState!: string;  // Agent state (idle, moving, working, etc.)
    @type("string") currentActivity!: string;  // Current activity description
    @type("string") currentLocation!: string;  // Current location name
    @type("number") energyLevel!: number;  // Energy level (0-100)
    @type("string") mood!: string;  // Current mood
    @type("number") lastUpdate!: number;
    @type("string") interactionTarget!: string;  // Who/what they're interacting with
    @type("boolean") isInteractable!: boolean;  // Can players interact with this agent
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Agent }) agents = new MapSchema<Agent>();
    @type("number") timestamp!: number;
    @type("number") mapWidth = 30;
    @type("number") mapHeight = 20;
    @type("number") tileSize = 16;
    @type("string") currentGameTime!: string;  // Current game time (HH:MM format)
    @type("number") gameDay!: number;  // Current game day
    @type("number") speedMultiplier = 60;  // Speed multiplier for game time
}