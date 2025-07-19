import { Scene } from "phaser";

export interface MovementConfig {
    speed: number;
    smoothing: number;
}

export class MovementController {
    private scene: Scene;
    private config: MovementConfig;
    private targetPosition: { x: number; y: number };
    private currentPosition: { x: number; y: number };
    private velocity: { x: number; y: number };
    private isMoving: boolean = false;

    constructor(scene: Scene, config: MovementConfig = { speed: 180, smoothing: 0.1 }) {
        this.scene = scene;
        this.config = config;
        this.velocity = { x: 0, y: 0 };
        this.targetPosition = { x: 0, y: 0 };
        this.currentPosition = { x: 0, y: 0 };
    }

    public setPosition(x: number, y: number) {
        this.currentPosition = { x, y };
        this.targetPosition = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.isMoving = false;
    }

    public setTargetPosition(x: number, y: number) {
        this.targetPosition = { x, y };
        this.calculateVelocity();
    }

    public startMoving(direction: string) {
        this.isMoving = true;
        
        // Calculate target based on direction
        const moveDistance = 16; // One tile
        const directionDeltas = {
            up: { x: 0, y: -moveDistance },
            down: { x: 0, y: moveDistance },
            left: { x: -moveDistance, y: 0 },
            right: { x: moveDistance, y: 0 }
        };

        const delta = directionDeltas[direction as keyof typeof directionDeltas];
        if (delta) {
            this.setTargetPosition(
                this.currentPosition.x + delta.x,
                this.currentPosition.y + delta.y
            );
        }
    }

    public stopMoving() {
        this.isMoving = false;
        this.velocity = { x: 0, y: 0 };
    }

    private calculateVelocity() {
        const dx = this.targetPosition.x - this.currentPosition.x;
        const dy = this.targetPosition.y - this.currentPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.1) {
            this.velocity.x = (dx / distance) * this.config.speed;
            this.velocity.y = (dy / distance) * this.config.speed;
        } else {
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.isMoving = false;
        }
    }

    public update(deltaTime: number) {
        if (!this.isMoving && this.velocity.x === 0 && this.velocity.y === 0) {
            return this.currentPosition;
        }

        // Convert deltaTime from milliseconds to seconds
        const dt = deltaTime / 1000;

        // Update position based on velocity
        this.currentPosition.x += this.velocity.x * dt;
        this.currentPosition.y += this.velocity.y * dt;

        // Check if we've reached the target
        const dx = this.targetPosition.x - this.currentPosition.x;
        const dy = this.targetPosition.y - this.currentPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 1) {
            // Snap to target and stop
            this.currentPosition = { ...this.targetPosition };
            this.velocity = { x: 0, y: 0 };
            this.isMoving = false;
        } else {
            // Recalculate velocity for smooth movement
            this.calculateVelocity();
        }

        return this.currentPosition;
    }

    public getPosition() {
        return { ...this.currentPosition };
    }

    public isCurrentlyMoving() {
        return this.isMoving;
    }
}