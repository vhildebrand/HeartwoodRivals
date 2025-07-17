import { Scene } from "phaser";
import { MovementController } from "./MovementController";

export class PlayerController {
    private scene: Scene;
    private sprites: Map<string, Phaser.Physics.Arcade.Sprite>;
    private nameLabels: Map<string, Phaser.GameObjects.Text>;
    private activityLabels: Map<string, Phaser.GameObjects.Text>;
    private movementControllers: Map<string, MovementController>;
    private myPlayerId: string | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.sprites = new Map();
        this.nameLabels = new Map();
        this.activityLabels = new Map();
        this.movementControllers = new Map();
        console.log("PlayerController: Initialized");
    }

    public setMyPlayerId(playerId: string) {
        this.myPlayerId = playerId;
    }
    
    public updatePlayerActivity(sessionId: string, activity: string) {
        const activityLabel = this.activityLabels.get(sessionId);
        if (activityLabel) {
            activityLabel.setText(activity || "No activity set");
            console.log(`PlayerController: Updated activity for ${sessionId} to: ${activity}`);
        }
    }

    public createAnimations() {
        try {
            console.log("PlayerController: Creating animations for Player.png sprite");
            
            // Row 1: Idle animation (frames 0-5)
            this.scene.anims.create({
                key: 'idle',
                frames: this.scene.anims.generateFrameNumbers('player', { start: 0, end: 5 }),
                frameRate: 6,
                repeat: -1
            });
            
            // Row 2: Walk right animation (frames 6-11)
            this.scene.anims.create({
                key: 'walk_right',
                frames: this.scene.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
                frameRate: 10,
                repeat: -1
            });
            
            // Row 3: Walk up animation (frames 12-17)
            this.scene.anims.create({
                key: 'walk_up',
                frames: this.scene.anims.generateFrameNumbers('player', { start: 12, end: 17 }),
                frameRate: 10,
                repeat: -1
            });
            
            // Row 4: Walk down animation (frames 18-23)
            this.scene.anims.create({
                key: 'walk_down',
                frames: this.scene.anims.generateFrameNumbers('player', { start: 18, end: 23 }),
                frameRate: 10,
                repeat: -1
            });
            
            // Walk left animation (using flipped walk right frames)
            this.scene.anims.create({
                key: 'walk_left',
                frames: this.scene.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
                frameRate: 10,
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
        let nameLabel = this.nameLabels.get(sessionId);
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
            
            // Create name label above player
            nameLabel = this.scene.add.text(playerData.x, playerData.y - 20, playerData.name || sessionId, {
                fontSize: '10px',
                color: '#FFFFFF',
                backgroundColor: '#000000',
                padding: { x: 3, y: 1 }
            });
            nameLabel.setOrigin(0.5, 0.5);
            nameLabel.setDepth(15);
            
            // Create activity label below name
            const activityLabel = this.scene.add.text(playerData.x, playerData.y - 8, "No activity set", {
                fontSize: '8px',
                color: '#AAAAAA',
                backgroundColor: '#000000',
                padding: { x: 2, y: 1 }
            });
            activityLabel.setOrigin(0.5, 0.5);
            activityLabel.setDepth(15);
            
            // Create movement controller
            movementController = new MovementController(this.scene);
            movementController.setPosition(playerData.x, playerData.y);
            
            // Start with idle animation
            sprite.play('idle');
            
            // Store components
            this.sprites.set(sessionId, sprite);
            this.nameLabels.set(sessionId, nameLabel);
            this.activityLabels.set(sessionId, activityLabel);
            this.movementControllers.set(sessionId, movementController);
            
            console.log(`PlayerController: Created player ${sessionId} at (${playerData.x}, ${playerData.y})`);
            
            // Optional: Highlight the current player's sprite (removed green tint)
            // if (sessionId === this.myPlayerId) {
            //     sprite.setTint(0x00ff00); // Green tint for current player
            //     console.log("PlayerController: Current player highlighted in green");
            // }
        } else {
            // Update existing player
            if (playerData.isMoving) {
                // For moving players, trust server position directly to avoid interpolation conflicts
                sprite.setPosition(playerData.x, playerData.y);
                movementController!.setPosition(playerData.x, playerData.y);
            } else {
                // For stationary players, use smooth interpolation for corrections
                const currentPos = movementController!.getPosition();
                const distance = Math.sqrt(
                    Math.pow(playerData.x - currentPos.x, 2) + 
                    Math.pow(playerData.y - currentPos.y, 2)
                );
                
                // Only interpolate if the correction is significant
                if (distance > 3) {
                    movementController!.setTargetPosition(playerData.x, playerData.y);
                }
            }
        }
        
        // Update activity label with server data
        const activityLabel = this.activityLabels.get(sessionId);
        if (activityLabel && playerData.currentActivity) {
            if (activityLabel.text !== playerData.currentActivity) {
                activityLabel.setText(playerData.currentActivity);
            }
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
            
            // Handle sprite flipping for walk left
            if (direction === 2) { // left
                sprite.setFlipX(true);  // Flip horizontally for left movement
                if (sprite.anims.currentAnim?.key !== 'walk_left') {
                    sprite.play('walk_left');
                }
            } else {
                sprite.setFlipX(false); // Reset flip for other directions
                if (animationKey && sprite.anims.currentAnim?.key !== animationKey) {
                    sprite.play(animationKey);
                }
            }
        } else {
            // Reset flip when idle
            sprite.setFlipX(false);
            // Play idle animation if not moving
            if (sprite.anims.currentAnim?.key !== 'idle') {
                sprite.play('idle');
            }
        }
    }

    public removePlayer(sessionId: string) {
        const sprite = this.sprites.get(sessionId);
        const nameLabel = this.nameLabels.get(sessionId);
        
        if (sprite) {
            sprite.destroy();
            this.sprites.delete(sessionId);
        }
        
        if (nameLabel) {
            nameLabel.destroy();
            this.nameLabels.delete(sessionId);
        }
        
        const activityLabel = this.activityLabels.get(sessionId);
        if (activityLabel) {
            activityLabel.destroy();
            this.activityLabels.delete(sessionId);
        }
        
        this.movementControllers.delete(sessionId);
        console.log(`PlayerController: Removed player ${sessionId}`);
    }

    public update(deltaTime: number) {
        // Update all movement controllers and sync sprites and name labels
        this.movementControllers.forEach((controller, sessionId) => {
            const sprite = this.sprites.get(sessionId);
            const nameLabel = this.nameLabels.get(sessionId);
            
            // Only update position from MovementController if player is not moving
            // (for moving players, position is set directly from server in updatePlayer)
            const isMoving = sprite?.getData('isMoving') || false;
            
            if (!isMoving) {
                const newPosition = controller.update(deltaTime);
                
                if (sprite) {
                    sprite.setPosition(newPosition.x, newPosition.y);
                }
                
                if (nameLabel) {
                    nameLabel.setPosition(newPosition.x, newPosition.y - 20);
                }
                
                // Update activity label position
                const activityLabel = this.activityLabels.get(sessionId);
                if (activityLabel) {
                    activityLabel.setPosition(newPosition.x, newPosition.y - 8);
                }
            } else {
                // For moving players, just update name label position to match sprite
                if (nameLabel && sprite) {
                    nameLabel.setPosition(sprite.x, sprite.y - 20);
                }
                
                // Update activity label position for moving players
                const activityLabel = this.activityLabels.get(sessionId);
                if (activityLabel && sprite) {
                    activityLabel.setPosition(sprite.x, sprite.y - 8);
                }
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
        // Clean up all sprites, name labels, and controllers
        this.sprites.forEach((sprite) => sprite.destroy());
        this.nameLabels.forEach((nameLabel) => nameLabel.destroy());
        this.sprites.clear();
        this.nameLabels.clear();
        this.movementControllers.clear();
        console.log("PlayerController: Destroyed");
    }
}