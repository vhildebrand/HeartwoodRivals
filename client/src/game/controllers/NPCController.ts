import { Scene } from "phaser";
import { MovementController } from "./MovementController";

interface NPCData {
    sprite: Phaser.GameObjects.Sprite;
    nameLabel: Phaser.GameObjects.Text;
    actionLabel: Phaser.GameObjects.Text;
    movementController: MovementController;
    dialogueBubble: Phaser.GameObjects.Container | null;
    name: string;
    x: number;
    y: number;
    lastDirection: number;
    isMoving: boolean;
    lastMoveTimestamp: number; // Timestamp of last movement in ms
}

export class NPCController {
    private scene: Scene;
    private npcs: Map<string, NPCData> = new Map();

    constructor(scene: Scene) {
        this.scene = scene;
        console.log("NPCController: Initialized");
    }

    public createNPCAnimations() {
        try {
            console.log("NPCController: Creating animations for all NPC sprite sheets");
            
            // List of all NPC IDs that correspond to sprite sheet names
            const npcIds = [
                'amelia_librarian', 'captain_finn', 'captain_rodriguez', 'coach_jason',
                'dj_nova', 'dr_helena', 'elara_blacksmith', 'father_michael',
                'isabella_baker', 'judge_patricia_wells', 'luna_tailor', 'marcus_merchant',
                'maya_teacher', 'mayor_henderson', 'melody_sinclair', 'officer_blake',
                'oliver_lighthouse_keeper', 'professor_cornelius', 'sarah_farmer', 'sophia_apothecary',
                'sterling_blackwood', 'thomas_tavern_keeper', 'victoria_woodworker', 'william_shipwright'
            ];

            npcIds.forEach(npcId => {
                const textureKey = `npc_${npcId}`;
                
                if (!this.scene.textures.exists(textureKey)) {
                    console.warn(`NPCController: Texture ${textureKey} not found, skipping animations`);
                    return;
                }

                // Create animations for each NPC based on Universal LPC sprite sheet layout
                // Universal LPC format: 13 columns, walking animations on rows 8-11
                
                // Row 8 (frames 104-112): up movement animations (13 columns)
                this.scene.anims.create({
                    key: `${npcId}_walk_up`,
                    frames: this.scene.anims.generateFrameNumbers(textureKey, { start: 104, end: 112 }),
                    frameRate: 8,
                    repeat: -1
                });

                // Row 9 (frames 117-125): left movement animations (13 columns)
                this.scene.anims.create({
                    key: `${npcId}_walk_left`,
                    frames: this.scene.anims.generateFrameNumbers(textureKey, { start: 117, end: 125 }),
                    frameRate: 8,
                    repeat: -1
                });

                // Row 10 (frames 130-138): down movement animations (13 columns)
                this.scene.anims.create({
                    key: `${npcId}_walk_down`,
                    frames: this.scene.anims.generateFrameNumbers(textureKey, { start: 130, end: 138 }),
                    frameRate: 8,
                    repeat: -1
                });

                // Row 11 (frames 143-151): right movement animations (13 columns)
                this.scene.anims.create({
                    key: `${npcId}_walk_right`,
                    frames: this.scene.anims.generateFrameNumbers(textureKey, { start: 143, end: 151 }),
                    frameRate: 8,
                    repeat: -1
                });

                // Create idle animation (using first frame of down movement)
                this.scene.anims.create({
                    key: `${npcId}_idle`,
                    frames: this.scene.anims.generateFrameNumbers(textureKey, { start: 130, end: 130 }),
                    frameRate: 1,
                    repeat: -1
                });
                
                console.log(`NPCController: Created animations for ${npcId}`);
            });

            console.log("NPCController: All NPC animations created successfully");
            
        } catch (error) {
            console.error("NPCController: Error creating NPC animations:", error);
        }
    }

    public createNPC(npcId: string, npcData: any): void {
        // Remove existing NPC if it exists
        if (this.npcs.has(npcId)) {
            this.removeNPC(npcId);
        }

        const textureKey = `npc_${npcId}`;
        
        // Use fallback texture if specific NPC texture doesn't exist
        const actualTextureKey = this.scene.textures.exists(textureKey) ? textureKey : 'player';
        
        // Create the NPC sprite
        const sprite = this.scene.add.sprite(npcData.x * 16, npcData.y * 16, actualTextureKey);
        // Scale down 64x64 Universal LPC sprites to match 32x32 player sprites
        sprite.setScale(actualTextureKey.startsWith('npc_') ? 0.5 : 1);
        sprite.setDepth(10000 + (npcData.y * 16));
        sprite.setOrigin(0.5, 0.5);

        // Create name label above NPC
        const nameLabel = this.scene.add.text(npcData.x * 16, npcData.y * 16 - 20, npcData.name, {
            fontSize: '10px',
            color: '#FFFFFF',
            backgroundColor: '#000000',
            padding: { x: 3, y: 1 }
        });
        nameLabel.setOrigin(0.5, 0.5);
        nameLabel.setDepth(10000 + (npcData.y * 16) + 5);

        // Create action label below NPC
        const actionText = npcData.currentActivity || 'idle';
        const actionLabel = this.scene.add.text(npcData.x * 16, npcData.y * 16 + 20, actionText, {
            fontSize: '9px',
            color: '#FF0000',
            backgroundColor: '#000000',
            padding: { x: 3, y: 1 }
        });
        actionLabel.setOrigin(0.5, 0.5);
        actionLabel.setDepth(10000 + (npcData.y * 16) + 5);

        // Create movement controller
        const movementController = new MovementController(this.scene);
        movementController.setPosition(npcData.x * 16, npcData.y * 16);

        // Start with idle animation
        if (this.scene.textures.exists(textureKey)) {
            sprite.play(`${npcId}_idle`);
        }

        // Store NPC data
        this.npcs.set(npcId, {
            sprite,
            nameLabel,
            actionLabel,
            movementController,
            dialogueBubble: null,
            name: npcData.name,
            x: npcData.x,
            y: npcData.y,
            lastDirection: 2, // Default to down (2)
            isMoving: false,
            lastMoveTimestamp: Date.now()
        });

        console.log(`NPCController: Created NPC ${npcData.name} at (${npcData.x}, ${npcData.y}) - ${actionText}`);
    }

    public updateNPC(npcId: string, npcData: any): void {
        const npc = this.npcs.get(npcId);
        if (!npc) {
            // Create new NPC if it doesn't exist
            this.createNPC(npcId, npcData);
            return;
        }

        const newX = npcData.x * 16;
        const newY = npcData.y * 16;

        // Check if NPC has moved
        const hasMovedX = Math.abs(newX - npc.sprite.x) > 1;
        const hasMovedY = Math.abs(newY - npc.sprite.y) > 1;
        const hasMoved = hasMovedX || hasMovedY;

        // Use direction provided by server to avoid flicker
        const newDirection = typeof npcData.direction === 'number' ? npcData.direction : npc.lastDirection;

        // Update positions smoothly
        if (hasMoved) {
            npc.movementController.setTargetPosition(newX, newY);
        }

        // Update movement flag directly from server state (prevents rapid idle toggling)
        npc.isMoving = !!npcData.isMoving;
        if (npc.isMoving) {
            npc.lastMoveTimestamp = Date.now();
        }

        // Update labels and action text
        npc.nameLabel.setPosition(newX, newY - 20);
        npc.actionLabel.setPosition(newX, newY + 20);

        const actionText = npcData.currentActivity || 'idle';
        npc.actionLabel.setText(actionText);

        // Update depths
        const newDepth = 10000 + newY;
        npc.sprite.setDepth(newDepth);
        npc.nameLabel.setDepth(newDepth + 5);
        npc.actionLabel.setDepth(newDepth + 5);

        // Update stored position and direction
        npc.x = npcData.x;
        npc.y = npcData.y;
        npc.lastDirection = newDirection;

        // Update animation based on movement and direction
        this.updateNPCAnimation(npcId, newDirection, npc.isMoving);
    }

    private updateNPCAnimation(npcId: string, direction: number, isMoving: boolean): void {
        const npc = this.npcs.get(npcId);
        if (!npc) return;

        const textureKey = `npc_${npcId}`;
        if (!this.scene.textures.exists(textureKey)) {
            // Fallback to player animations if NPC texture doesn't exist
            return;
        }

        // Determine if NPC should be idle based on last movement timestamp
        const now = Date.now();
        const idleTimeout = 2000; // 2 seconds
        const shouldBeIdle = !isMoving || (now - npc.lastMoveTimestamp > idleTimeout);

        if (shouldBeIdle) {
            const idleKey = `${npcId}_idle`;
            if (npc.sprite.anims.currentAnim?.key !== idleKey) {
                npc.sprite.play(idleKey);
            }
            return;
        }

        // Always use horizontal walking animations to reduce flicker
        const horizontalDirection = (direction === 3) ? 3 : 2; // Prefer right if 3, else left
        const animationKey = horizontalDirection === 3 ? `${npcId}_walk_right` : `${npcId}_walk_left`;

        if (npc.sprite.anims.currentAnim?.key !== animationKey) {
            npc.sprite.play(animationKey);
        }
    }

    public removeNPC(npcId: string): void {
        const npc = this.npcs.get(npcId);
        if (npc) {
            npc.sprite.destroy();
            npc.nameLabel.destroy();
            npc.actionLabel.destroy();
            
            if (npc.dialogueBubble) {
                npc.dialogueBubble.destroy();
            }
            
            this.npcs.delete(npcId);
            console.log(`NPCController: Removed NPC ${npcId}`);
        }
    }

    public update(deltaTime: number): void {
        // Update all NPC movement controllers and sync sprite positions
        this.npcs.forEach((npc, npcId) => {
            if (npc.isMoving) {
                const newPosition = npc.movementController.update(deltaTime);
                
                // Update sprite position
                npc.sprite.setPosition(newPosition.x, newPosition.y);
                npc.sprite.setDepth(10000 + newPosition.y);
                
                // Update label positions
                npc.nameLabel.setPosition(newPosition.x, newPosition.y - 20);
                npc.nameLabel.setDepth(10000 + newPosition.y + 5);
                
                npc.actionLabel.setPosition(newPosition.x, newPosition.y + 20);
                npc.actionLabel.setDepth(10000 + newPosition.y + 5);
                
                // Check if movement is complete
                if (!npc.movementController.isCurrentlyMoving()) {
                    npc.isMoving = false;
                    this.updateNPCAnimation(npcId, npc.lastDirection, false);
                }
            }
        });
    }

    public getNPC(npcId: string): NPCData | undefined {
        return this.npcs.get(npcId);
    }

    public getAllNPCs(): Map<string, NPCData> {
        return new Map(this.npcs);
    }

    public getNearbyNPC(playerX: number, playerY: number, interactionDistance: number = 32): { id: string, name: string } | null {
        for (const [npcId, npcData] of this.npcs) {
            const distance = Math.sqrt(
                Math.pow(playerX - npcData.sprite.x, 2) + Math.pow(playerY - npcData.sprite.y, 2)
            );
            
            if (distance <= interactionDistance) {
                return { id: npcId, name: npcData.name };
            }
        }
        
        return null;
    }

    public destroy(): void {
        // Clean up all NPCs
        this.npcs.forEach((npc, npcId) => {
            this.removeNPC(npcId);
        });
        this.npcs.clear();
        console.log("NPCController: Destroyed");
    }
} 