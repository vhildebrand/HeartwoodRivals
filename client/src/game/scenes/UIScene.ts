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

        // Initialize dialogue manager
        this.dialogueManager = new DialogueManager(this);

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

        console.log("🎮 [UI] UIScene created and running in parallel with clock display");
    }

    private updateClockDisplay(gameState: any) {
        if (gameState.currentGameTime && gameState.currentGameTime !== this.currentGameTime) {
            this.currentGameTime = gameState.currentGameTime;
            console.log(`🕐 [UI] Time updated to: ${this.currentGameTime}`);
        }
        
        if (gameState.gameDay && gameState.gameDay !== this.currentGameDay) {
            this.currentGameDay = gameState.gameDay;
            console.log(`📅 [UI] Day updated to: ${this.currentGameDay}`);
        }
        
        if (gameState.speedMultiplier && gameState.speedMultiplier !== this.currentSpeedMultiplier) {
            this.currentSpeedMultiplier = gameState.speedMultiplier;
            console.log(`🚀 [UI] Speed updated to: ${this.currentSpeedMultiplier}x`);
        }
        
        // Update the display
        if (this.clockText) {
            this.clockText.setText(`Day ${this.currentGameDay} - ${this.currentGameTime}`);
        }
        if (this.speedText) {
            this.speedText.setText(`Speed: ${this.currentSpeedMultiplier}x`);
        }
    }

    getDialogueManager(): DialogueManager | null {
        return this.dialogueManager;
    }
}