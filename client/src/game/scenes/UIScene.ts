// client/src/scenes/UIScene.ts
import { Scene } from "phaser";

export class UIScene extends Scene {
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

        console.log("UIScene: Created and running in parallel.");
    }
}