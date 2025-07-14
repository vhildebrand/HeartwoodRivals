// client/src/scenes/PreloaderScene.ts
import { Scene } from "phaser";

export class PreloaderScene extends Scene {
    constructor() {
        super("PreloaderScene");
    }

    preload() {
        // This is where you will load all your assets
        // For now, we'll just show a loading message
        this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            "Loading...",
            { fontSize: "32px", color: "#fff" }
        ).setOrigin(0.5);

        // Example of loading an image:
        // this.load.image('player', 'assets/sprites/player.png');
    }



    create() {
        // Once all assets are loaded, start the main game scenes
        console.log("PreloaderScene: Assets loaded, starting game.");
        this.scene.start("GameScene");
        this.scene.launch("UIScene"); // Launch runs the scene in parallel
    }
}