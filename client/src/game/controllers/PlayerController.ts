import { Scene } from "phaser";
import { MovementController } from "./MovementController";

export class PlayerController {
    private scene: Scene;
    private sprites: Map<string, Phaser.Physics.Arcade.Sprite>;
    private movementControllers: Map<string, MovementController>;
    private myPlayerId: string | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.sprites = new Map();
        this.movementControllers = new Map();
        console.log("PlayerController: Initialized");
    }

    public setMyPlayerId(playerId: string) {
        this.myPlayerId = playerId;
    }

    public createAnimations() {
        try {
            // Get the player texture to check available frames
            const playerTexture = this.scene.textures.get('player');
            const frameCount = playerTexture.frameTotal;
            
            console.log(`PlayerController: Player sprite has ${frameCount} frames available`);
            
            // Create animations with safe frame ranges
            // Idle animation (frame 0)
            this.scene.anims.create({
                key: 'idle',
                frames: this.scene.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
                frameRate: 1,
                repeat: -1
            });
            
            // Walk down animation - use frame 0 if not enough frames
            const walkDownFrames = frameCount > 3 ? { start: 1, end: 3 } : { start: 0, end: 0 };
            this.scene.anims.create({
                key: 'walk_down',
                frames: this.scene.anims.generateFrameNumbers('player', walkDownFrames),
                frameRate: 8,
                repeat: -1
            });
            
            // Walk up animation - fallback to frame 0 if not enough frames
            const walkUpFrames = frameCount > 6 ? { start: 4, end: 6 } : { start: 0, end: 0 };
            this.scene.anims.create({
                key: 'walk_up',
                frames: this.scene.anims.generateFrameNumbers('player', walkUpFrames),
                frameRate: 8,
                repeat: -1
            });
            
            // Walk left animation - fallback to frame 0 if not enough frames  
            const walkLeftFrames = frameCount > 9 ? { start: 7, end: 9 } : { start: 0, end: 0 };
            this.scene.anims.create({
                key: 'walk_left',
                frames: this.scene.anims.generateFrameNumbers('player', walkLeftFrames),
                frameRate: 8,
                repeat: -1
            });
            
            // Walk right animation - fallback to frame 0 if not enough frames
            const walkRightFrames = frameCount > 12 ? { start: 10, end: 12 } : { start: 0, end: 0 };
            this.scene.anims.create({
                key: 'walk_right',
                frames: this.scene.anims.generateFrameNumbers('player', walkRightFrames),
                frameRate: 8,
                repeat: -1
            });
            
            console.log("PlayerController: Animations created successfully");
            
        } catch (error) {
            console.error("PlayerController: Error creating animations:", error);
            // Fallback: create a simple idle animation
            this.scene.anims.create({
                key: 'idle',
                frames: this.scene.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
                frameRate: 1,
                repeat: -1
            });
        }
    }

    public updatePlayer(sessionId: string, playerData: any) {
        let sprite = this.sprites.get(sessionId);
        let movementController = this.movementControllers.get(sessionId);
        
        if (!sprite) {
            // Create new sprite and movement controller
            sprite = this.scene.physics.add.sprite(playerData.x, playerData.y, 'player');
            sprite.setOrigin(0.5, 0.5);
            sprite.setScale(1);
            
            // Set sprite properties
            sprite.setData('sessionId', sessionId);
            sprite.setData('playerName', playerData.name || sessionId);
            
            // Add to physics world
            this.scene.physics.world.enable(sprite);
            
            // Set physics body size
            if (sprite.body) {
                sprite.body.setSize(12, 12);
            }
            
            // Create movement controller
            movementController = new MovementController(this.scene);
            movementController.setPosition(playerData.x, playerData.y);
            
            // Start with idle animation
            sprite.play('idle');
            
            // Store components
            this.sprites.set(sessionId, sprite);
            this.movementControllers.set(sessionId, movementController);
            
            console.log(`PlayerController: Created player ${sessionId} at (${playerData.x}, ${playerData.y})`);
            
            // Highlight the current player's sprite
            if (sessionId === this.myPlayerId) {
                sprite.setTint(0x00ff00); // Green tint for current player
                console.log("PlayerController: Current player highlighted in green");
            }
        } else {
            // Update existing player with smooth movement
            movementController!.setTargetPosition(playerData.x, playerData.y);
        }
        
        // Update animation
        if (playerData.direction !== undefined) {
            sprite.setData('direction', playerData.direction);
            sprite.setData('isMoving', playerData.isMoving);
            
            this.updatePlayerAnimation(sprite, playerData.direction, playerData.isMoving);
        }
    }

    private updatePlayerAnimation(sprite: Phaser.Physics.Arcade.Sprite, direction: number, isMoving: boolean) {
        // Direction mapping: 0=down, 1=up, 2=left, 3=right
        const directionAnimations = ['walk_down', 'walk_up', 'walk_left', 'walk_right'];
        
        if (isMoving) {
            const animationKey = directionAnimations[direction];
            if (animationKey && sprite.anims.currentAnim?.key !== animationKey) {
                sprite.play(animationKey);
            }
        } else {
            // Play idle animation if not moving
            if (sprite.anims.currentAnim?.key !== 'idle') {
                sprite.play('idle');
            }
        }
    }

    public removePlayer(sessionId: string) {
        const sprite = this.sprites.get(sessionId);
        if (sprite) {
            sprite.destroy();
            this.sprites.delete(sessionId);
            this.movementControllers.delete(sessionId);
            console.log(`PlayerController: Removed player ${sessionId}`);
        }
    }

    public update(deltaTime: number) {
        // Update all movement controllers and sync sprites
        this.movementControllers.forEach((controller, sessionId) => {
            const newPosition = controller.update(deltaTime);
            const sprite = this.sprites.get(sessionId);
            
            if (sprite) {
                sprite.setPosition(newPosition.x, newPosition.y);
            }
        });
    }

    public getAllPlayers() {
        return Array.from(this.sprites.keys());
    }

    public getPlayerSprite(sessionId: string) {
        return this.sprites.get(sessionId);
    }

    public destroy() {
        // Clean up all sprites and controllers
        this.sprites.forEach((sprite) => sprite.destroy());
        this.sprites.clear();
        this.movementControllers.clear();
        console.log("PlayerController: Destroyed");
    }
}