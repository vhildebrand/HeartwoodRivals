// client/src/game/main.ts
import { Game, Types } from "phaser";
import { GameScene } from "./scenes/GameScene";
import { PreloaderScene } from "./scenes/PreloaderScene";
import { UIScene } from "./scenes/UIScene";

// Define the game configuration
const config: Types.Core.GameConfig = {
    type: Phaser.AUTO, // Automatically choose WebGL or Canvas
    width: 1024,
    height: 768,
    parent: "game-container", // The ID of the div in index.html
    backgroundColor: "#1a1a1a",
    pixelArt: true, // Crucial for a crisp pixel-art look
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 }, // No gravity for a top-down game
            debug: true, // Set to false for production
        },
    },
    scene: [PreloaderScene, GameScene, UIScene], // The order scenes are loaded
};

// Export function that creates and returns the game instance
export default function StartGame(containerId: string): Game {
    // Update the parent config to use the passed container ID
    config.parent = containerId;
    
    // Create and return the game instance
    return new Game(config);
}
