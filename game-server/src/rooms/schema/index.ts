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

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type("number") timestamp!: number;
    @type("number") mapWidth = 30;
    @type("number") mapHeight = 20;
    @type("number") tileSize = 16;
}