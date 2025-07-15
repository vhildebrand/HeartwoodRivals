// client/src/scenes/PreloaderScene.ts
import { Scene } from "phaser";

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

        // Sub-task 3.1: Preload Assets
        // Load the tilemap JSON file (heartwood_test_map.json)
        this.load.tilemapTiledJSON('town', 'assets/heartwood_test_map.json');
        
        // Load individual tile images
        this.load.image('grass_middle', 'assets/Grass_Middle.png');
        this.load.image('path_middle', 'assets/Path_Middle.png');
        this.load.image('water_middle', 'assets/Water_Middle.png');
        
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
        // Create a tileset from individual tiles
        this.createTilesetFromIndividualTiles();
        
        // Once all assets are loaded, start the main game scenes
        console.log("PreloaderScene: Assets loaded, starting game.");
        this.scene.start("GameScene");
        this.scene.launch("UIScene"); // Launch runs the scene in parallel
    }

    private createTilesetFromIndividualTiles() {
        const tileSize = 16;
        const tilesPerRow = 16;
        const canvasWidth = tilesPerRow * tileSize;
        const canvasHeight = tileSize;
        
        // Create an HTML5 Canvas to draw the tileset
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            console.error('Could not get 2D context from canvas');
            return;
        }
        
        // Get the texture objects from Phaser
        const grassTexture = this.textures.get('grass_middle');
        const pathTexture = this.textures.get('path_middle');
        const waterTexture = this.textures.get('water_middle');
        
        // Draw tiles at correct positions
        // Tile indices in the map: 10, 11, 12 (1-based)
        // Array indices: 9, 10, 11 (0-based)
        
        // Draw grass at position 9 (tile index 10)
        const grassSource = grassTexture.getSourceImage() as HTMLImageElement;
        ctx.drawImage(grassSource, 9 * tileSize, 0);
        
        // Draw path at position 10 (tile index 11)
        const pathSource = pathTexture.getSourceImage() as HTMLImageElement;
        ctx.drawImage(pathSource, 10 * tileSize, 0);
        
        // Draw water at position 11 (tile index 12)
        const waterSource = waterTexture.getSourceImage() as HTMLImageElement;
        ctx.drawImage(waterSource, 11 * tileSize, 0);
        
        // Create a Phaser texture from the canvas
        this.textures.addCanvas('cute_fantasy', canvas);
        
        console.log('Created tileset with tiles at positions 9, 10, 11');
    }
}