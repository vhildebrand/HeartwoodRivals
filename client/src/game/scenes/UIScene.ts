// client/src/scenes/UIScene.ts
import { Scene } from "phaser";
import { DialogueManager } from "../ui/DialogueManager";

export class UIScene extends Scene {
    private dialogueManager: DialogueManager | null = null;
    private clockText: Phaser.GameObjects.Text | null = null;
    private speedText: Phaser.GameObjects.Text | null = null;
    private currentGameTime: string = "06:00";
    private currentGameDay: number = 1;
    private currentSpeedMultiplier: number = 60;
    
    // Debug panel
    private debugPanel: Phaser.GameObjects.Container | null = null;
    private debugPanelVisible: boolean = false;
    private npcList: any[] = [];
    private debugPanelBackground: Phaser.GameObjects.Rectangle | null = null;
    private debugPanelTitle: Phaser.GameObjects.Text | null = null;
    private debugPanelContent: Phaser.GameObjects.Container | null = null;

    constructor() {
        super("UIScene");
    }

    create() {
        console.log("🎮 [UI] UIScene created and initializing...");
        
        // Add a semi-transparent rectangle at the top for a UI bar
        this.add.rectangle(0, 0, this.cameras.main.width, 50, 0x000000, 0.5)
            .setOrigin(0, 0);

        // Add game title
        const titleText = this.add.text(10, 10, "Competitive Dating Simulator", {
            fontSize: "20px",
            color: "#fff",
        });
        
        // Add clock display next to the title
        this.clockText = this.add.text(280, 10, `Day ${this.currentGameDay} - ${this.currentGameTime}`, {
            fontSize: "18px",
            color: "#FFD700",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: { x: 8, y: 4 }
        });
        
        // Add speed indicator
        this.speedText = this.add.text(480, 10, `Speed: ${this.currentSpeedMultiplier}x`, {
            fontSize: "14px",
            color: "#00FF00",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: { x: 6, y: 2 }
        });

        // Add debug panel toggle button
        const debugToggleButton = this.add.text(this.cameras.main.width - 120, 10, "Debug Panel", {
            fontSize: "12px",
            color: "#FFFFFF",
            backgroundColor: "rgba(0, 0, 255, 0.7)",
            padding: { x: 6, y: 2 }
        }).setInteractive();

        debugToggleButton.on('pointerdown', () => {
            this.toggleDebugPanel();
        });

        // Create debug panel (initially hidden)
        this.createDebugPanel();

        // Initialize dialogue manager
        this.dialogueManager = new DialogueManager(this);

        // Listen for player ID updates from GameScene
        this.game.events.on('playerIdSet', (playerId: string) => {
            console.log(`👤 [UI] Setting player character ID: ${playerId}`);
            this.dialogueManager?.setPlayerCharacterId(playerId);
        });

        // Listen for dialogue events from GameScene
        this.game.events.on('openDialogue', (npcId: string, npcName: string) => {
            console.log(`💬 [UI] Opening dialogue with NPC: ${npcName} (ID: ${npcId})`);
            this.dialogueManager?.openDialogue(npcId, npcName);
        });

        this.game.events.on('closeDialogue', () => {
            console.log(`💬 [UI] Closing dialogue`);
            this.dialogueManager?.closeDialogue();
        });

        // Listen for game state updates to update clock
        this.game.events.on('gameStateUpdate', (gameState: any) => {
            this.updateClockDisplay(gameState);
        });

        // Load NPC list for debug panel
        this.loadNPCList();

        console.log("🎮 [UI] UIScene created and running in parallel with clock display");
    }

    private updateClockDisplay(gameState: any) {
        if (this.clockText) {
            this.clockText.setText(`Day ${gameState.gameDay} - ${gameState.currentGameTime}`);
        }
        
        if (this.speedText) {
            this.speedText.setText(`Speed: ${gameState.speedMultiplier}x`);
        }
    }

    getDialogueManager(): DialogueManager | null {
        return this.dialogueManager;
    }

    private createDebugPanel() {
        // Create debug panel container
        this.debugPanel = this.add.container(this.cameras.main.width - 350, 60);
        
        // Background
        this.debugPanelBackground = this.add.rectangle(0, 0, 340, 400, 0x000000, 0.8);
        this.debugPanelBackground.setOrigin(0, 0);
        
        // Title
        this.debugPanelTitle = this.add.text(10, 10, "Debug Panel - NPC Planning", {
            fontSize: "16px",
            color: "#FFFFFF"
        });
        
        // Content container
        this.debugPanelContent = this.add.container(0, 40);
        
        // Add components to debug panel
        this.debugPanel.add([this.debugPanelBackground, this.debugPanelTitle, this.debugPanelContent]);
        
        // Initially hide the panel
        this.debugPanel.setVisible(false);
    }

    private toggleDebugPanel() {
        this.debugPanelVisible = !this.debugPanelVisible;
        if (this.debugPanel) {
            this.debugPanel.setVisible(this.debugPanelVisible);
        }
        
        if (this.debugPanelVisible) {
            this.refreshNPCList();
        }
    }

    private async loadNPCList() {
        try {
            const response = await fetch('http://localhost:3000/npc/list');
            if (response.ok) {
                const data = await response.json();
                this.npcList = data.agents || [];
                console.log(`📋 [UI] Loaded ${this.npcList.length} NPCs for debug panel`);
            }
        } catch (error) {
            console.error('Error loading NPC list:', error);
        }
    }

    private refreshNPCList() {
        if (!this.debugPanelContent) return;
        
        // Clear existing content
        this.debugPanelContent.removeAll(true);
        
        // Add instruction text
        const instructionText = this.add.text(10, 10, "Click to generate plan for NPC:", {
            fontSize: "12px",
            color: "#CCCCCC"
        });
        this.debugPanelContent.add(instructionText);
        
        // Add debug time button
        const debugTimeButton = this.add.text(10, 30, "🕐 Debug Time System", {
            fontSize: "12px",
            color: "#FFFFFF",
            backgroundColor: "rgba(0, 0, 100, 0.7)",
            padding: { x: 8, y: 4 }
        }).setInteractive();
        
        debugTimeButton.on('pointerdown', () => {
            this.debugTimeSystem();
        });
        
        this.debugPanelContent.add(debugTimeButton);
        
        // Add NPC buttons
        this.npcList.forEach((npc, index) => {
            const yPos = 70 + (index * 30); // Adjusted for the new button
            
            // NPC button
            const npcButton = this.add.text(10, yPos, `${npc.name} (${npc.current_location})`, {
                fontSize: "12px",
                color: "#FFFFFF",
                backgroundColor: "rgba(0, 100, 0, 0.7)",
                padding: { x: 8, y: 4 }
            }).setInteractive();
            
            npcButton.on('pointerdown', () => {
                this.generatePlanForNPC(npc.id, npc.name);
            });
            
            if (this.debugPanelContent) {
                this.debugPanelContent.add(npcButton);
            }
        });
    }

    private async generatePlanForNPC(npcId: string, npcName: string) {
        try {
            console.log(`📋 [UI] Generating plan for ${npcName}...`);
            
            const response = await fetch('http://localhost:3000/npc/generate-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    npcId: npcId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ [UI] Plan generation triggered for ${npcName}:`, data.message);
                
                // Show success message in the debug panel
                this.showDebugMessage(`Plan generated for ${npcName}!`, 0x00FF00);
            } else {
                console.error(`❌ [UI] Failed to generate plan for ${npcName}`);
                this.showDebugMessage(`Failed to generate plan for ${npcName}`, 0xFF0000);
            }
        } catch (error) {
            console.error(`❌ [UI] Error generating plan for ${npcName}:`, error);
            this.showDebugMessage(`Error generating plan for ${npcName}`, 0xFF0000);
        }
    }

    private debugTimeSystem() {
        console.log(`🕐 [UI] Requesting time debug info from server...`);
        
        // Send debug_time message to the game server
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene && gameScene.room) {
            gameScene.room.send('debug_time', {
                timestamp: Date.now()
            });
            
            console.log(`✅ [UI] Debug time request sent to server`);
            this.showDebugMessage(`Time debug requested - check server logs`, 0x0000FF);
        } else {
            console.error(`❌ [UI] Game room not available for debug time request`);
            this.showDebugMessage(`Error: Game room not available`, 0xFF0000);
        }
    }

    private showDebugMessage(message: string, color: number) {
        if (!this.debugPanelContent) return;
        
        const messageText = this.add.text(10, 350, message, {
            fontSize: "11px",
            color: `#${color.toString(16).padStart(6, '0')}`,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: { x: 4, y: 2 }
        });
        
        this.debugPanelContent.add(messageText);
        
        // Remove message after 3 seconds
        this.time.delayedCall(3000, () => {
            if (messageText) {
                messageText.destroy();
            }
        });
    }
}