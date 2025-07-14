// client/src/scenes/GameScene.ts
import { Scene } from "phaser";

export class GameScene extends Scene {
    constructor() {
        super("GameScene");
    }

    create() {
        // For now, just set a background color to show it's working
        this.cameras.main.setBackgroundColor("#4caf50"); // A nice grassy green

        // Add a simple text to indicate this is the GameScene
        this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            "This is the Game Scene",
            { fontSize: "24px", color: "#000" }
        ).setOrigin(0.5);

        console.log("GameScene: Created.");
    }

    update() {
        // This is the game loop, where you'll handle player input and updates
    }
}