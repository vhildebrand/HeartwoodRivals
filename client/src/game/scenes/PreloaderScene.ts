// client/src/scenes/PreloaderScene.ts
import { Scene } from "phaser";
import { MapManager } from "../maps/MapManager";

export class PreloaderScene extends Scene {
    constructor() {
        super("PreloaderScene");
    }

    preload() {
        // Show loading message
        this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            "Loading...",
            { fontSize: "32px", color: "#fff" }
        ).setOrigin(0.5);

        // Load the large test map
        this.load.tilemapTiledJSON('large_town', 'assets/large_test_map.json');
        
        // Load the proper tileset image
        this.load.image('tileset', 'assets/tileset.png');
        
        // Load the user's spritesheet (spritesheet_test_01.png)
        console.log("Loading player spritesheet: assets/spritesheet_test_01.png");
        this.load.spritesheet('player', 'assets/spritesheet_test_01.png', {
            frameWidth: 32,  // Adjusted to 32x32 based on typical sprite sizes
            frameHeight: 32
        });
        
        // Load additional assets
        this.load.image('bg', 'assets/bg.png');
        this.load.image('logo', 'assets/logo.png');
    }

    create() {
        // Load the map into the MapManager
        this.loadMapIntoManager();
        
        // Once all assets are loaded, start the main game scenes
        console.log("PreloaderScene: Assets loaded, starting game.");
        this.scene.start("GameScene");
        this.scene.launch("UIScene"); // Launch runs the scene in parallel
    }

    private loadMapIntoManager() {
        // Get the loaded map data
        const mapData = this.cache.tilemap.get('large_town');
        if (!mapData) {
            console.error('Failed to load map data');
            return;
        }

        // Load the map into the shared MapManager
        const mapManager = MapManager.getInstance();
        mapManager.loadMap('large_town', mapData.data);
        
        console.log('Loaded large_town map into MapManager');
    }
}