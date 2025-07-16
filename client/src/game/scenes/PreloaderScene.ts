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

        // Load the Beacon Bay map
        this.load.tilemapTiledJSON('beacon_bay', 'assets/beacon_bay_map.json');
        
        // Load the proper tileset image
        this.load.image('tileset', 'assets/tileset.png');
        
        // Load the user's spritesheet (Player.png)
        console.log("Loading player spritesheet: assets/Player.png");
        this.load.spritesheet('player', 'assets/Player.png', {
            frameWidth: 32,   // 16x16 per animation frame
            frameHeight: 32,  // 16x16 per animation frame
            startFrame: 0,    // Start from first frame
            endFrame: 23,     // Load all 24 frames (6 frames × 4 rows)
            margin: 0,        // No margin around sprite sheet
            spacing: 0        // No spacing between frames
        });
        
        // Load additional assets
        this.load.image('bg', 'assets/bg.png');
        this.load.image('logo', 'assets/logo.png');
        
        // Load the beacon bay locations data
        this.load.json('beacon_bay_locations', 'assets/beacon_bay_locations.json');
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
        const mapData = this.cache.tilemap.get('beacon_bay');
        if (!mapData) {
            console.error('Failed to load map data');
            return;
        }

        // Load the map into the shared MapManager
        const mapManager = MapManager.getInstance();
        mapManager.loadMap('beacon_bay', mapData.data);
        
        console.log('Loaded beacon_bay map into MapManager');
    }
}