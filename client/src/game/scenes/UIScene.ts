// client/src/scenes/UIScene.ts
import { Scene } from "phaser";
import { DialogueManager } from "../ui/DialogueManager";

export class UIScene extends Scene {
    private dialogueManager: DialogueManager | null = null;

    constructor() {
        super("UIScene");
    }

    create() {
        // Add a semi-transparent rectangle at the top for a UI bar
        this.add.rectangle(0, 0, this.cameras.main.width, 50, 0x000000, 0.5)
            .setOrigin(0, 0);

        // Add some text to the UI bar
        this.add.text(10, 10, "Competitive Dating Simulator", {
            fontSize: "20px",
            color: "#fff",
        });

        // Initialize dialogue manager
        this.dialogueManager = new DialogueManager(this);

        // Listen for dialogue events from GameScene
        this.game.events.on('openDialogue', (npcId: string, npcName: string) => {
            this.dialogueManager?.openDialogue(npcId, npcName);
        });

        this.game.events.on('closeDialogue', () => {
            this.dialogueManager?.closeDialogue();
        });

        console.log("UIScene: Created and running in parallel.");
    }

    getDialogueManager(): DialogueManager | null {
        return this.dialogueManager;
    }
}