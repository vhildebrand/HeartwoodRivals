// client/src/game/scenes/PreloaderScene.ts
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
        this.load.tilemapTiledJSON('beacon_bay', 'assets/beacon_bay_map_copy.json');
        
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
        
        // Load audio files
        console.log("Loading audio files...");
        this.load.audio('background_music_1', 'assets/struggle_sandwich.mp3');
        this.load.audio('background_music_2', 'assets/bad_year_blimp.mp3');
        this.load.audio('background_music_3', 'assets/ten_hours_ceiling.mp3');
        this.load.audio('speed_dating_music', 'assets/tranquility.mp3');
        
        // Load the beacon bay locations data
        this.load.json('beacon_bay_locations', 'assets/beacon_bay_locations.json');
        
        // Load character portraits for speed dating
        console.log("Loading character portraits...");
        this.load.image('portrait_amelia_librarian', 'assets/portraits/amelia_librarian.png');
        this.load.image('portrait_captain_finn', 'assets/portraits/captain_finn.png');
        this.load.image('portrait_captain_rodriguez', 'assets/portraits/captain_rodriguez.png');
        this.load.image('portrait_coach_jason', 'assets/portraits/coach_jason.png');
        this.load.image('portrait_dj_nova', 'assets/portraits/dj_nova.png');
        this.load.image('portrait_dr_helena', 'assets/portraits/dr_helena.png');
        this.load.image('portrait_elara_blacksmith', 'assets/portraits/elara_blacksmith.png');
        this.load.image('portrait_father_michael', 'assets/portraits/father_michael.png');
        this.load.image('portrait_isabella_baker', 'assets/portraits/isabella_baker.png');
        this.load.image('portrait_judge_patricia_wells', 'assets/portraits/judge_patricia_wells.png');
        this.load.image('portrait_luna_tailor', 'assets/portraits/luna_tailor.png');
        this.load.image('portrait_marcus_merchant', 'assets/portraits/marcus_merchant.png');
        this.load.image('portrait_maya_teacher', 'assets/portraits/maya_teacher.png');
        this.load.image('portrait_mayor_henderson', 'assets/portraits/mayor_henderson.png');
        this.load.image('portrait_melody_sinclair', 'assets/portraits/melody_sinclair.png');
        this.load.image('portrait_officer_blake', 'assets/portraits/officer_blake.png');
        this.load.image('portrait_oliver_lighthouse_keeper', 'assets/portraits/oliver_lighthouse_keeper.png');
        this.load.image('portrait_professor_cornelius', 'assets/portraits/professor_cornelius.png');
        this.load.image('portrait_sarah_farmer', 'assets/portraits/sarah_farmer.png');
        this.load.image('portrait_sophia_apothecary', 'assets/portraits/sophia_apothecary.png');
        this.load.image('portrait_sterling_blackwood', 'assets/portraits/sterling_blackwood.png');
        this.load.image('portrait_thomas_tavern_keeper', 'assets/portraits/thomas_tavern_keeper.png');
        this.load.image('portrait_victoria_woodworker', 'assets/portraits/victoria_woodworker.png');
        this.load.image('portrait_william_shipwright', 'assets/portraits/william_shipwright.png');
        console.log("Character portraits loaded!");
        
        // Load NPC sprite sheets for movement animations
        console.log("Loading NPC sprite sheets for movement animations...");
        
        // Universal LPC Spritesheet format: 13 columns x 21 rows, 64x64 pixel frames
        // Walking animations are typically on rows 8-11 (down, left, up, right)
        this.load.spritesheet('npc_amelia_librarian', 'assets/heartwood_spritesheets/amelia_librarian.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_captain_finn', 'assets/heartwood_spritesheets/captain_finn.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_captain_rodriguez', 'assets/heartwood_spritesheets/captain_rodriguez.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_coach_jason', 'assets/heartwood_spritesheets/coach_jason.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_dj_nova', 'assets/heartwood_spritesheets/dj_nova.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_dr_helena', 'assets/heartwood_spritesheets/dr_helena.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_elara_blacksmith', 'assets/heartwood_spritesheets/elara_blacksmith.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_father_michael', 'assets/heartwood_spritesheets/father_michael.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_isabella_baker', 'assets/heartwood_spritesheets/isabella_baker.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_judge_patricia_wells', 'assets/heartwood_spritesheets/judge_patricia_wells.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_luna_tailor', 'assets/heartwood_spritesheets/luna_tailor.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_marcus_merchant', 'assets/heartwood_spritesheets/marcus_merchant.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_maya_teacher', 'assets/heartwood_spritesheets/maya_teacher.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_mayor_henderson', 'assets/heartwood_spritesheets/mayor_henderson.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_melody_sinclair', 'assets/heartwood_spritesheets/melody_sinclair.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_officer_blake', 'assets/heartwood_spritesheets/officer_blake.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_oliver_lighthouse_keeper', 'assets/heartwood_spritesheets/oliver_lighthouse_keeper.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_professor_cornelius', 'assets/heartwood_spritesheets/professor_cornelius.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_sarah_farmer', 'assets/heartwood_spritesheets/sarah_farmer.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_sophia_apothecary', 'assets/heartwood_spritesheets/sophia_apothecary.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_sterling_blackwood', 'assets/heartwood_spritesheets/sterling_blackwood.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_thomas_tavern_keeper', 'assets/heartwood_spritesheets/thomas_tavern_keeper.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_victoria_woodworker', 'assets/heartwood_spritesheets/victoria_woodworker.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        this.load.spritesheet('npc_william_shipwright', 'assets/heartwood_spritesheets/william_shipwright.png', {
            frameWidth: 64, frameHeight: 64, margin: 0, spacing: 0
        });
        
        console.log("NPC sprite sheets loaded!");
        
        // Auto-generated tile loading code
        console.log("Loading 183 individual tile images...");
        
        // Load 21_Beach_16x16_Bamboo_Bar_Counter_2_Sand
        this.load.image('tile_21_Beach_16x16_Bamboo_Bar_Counter_2_Sand', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Bamboo_Bar_Counter_2_Sand.png');
        // Load 21_Beach_16x16_Beach_Volley_Net_Left
        this.load.image('tile_21_Beach_16x16_Beach_Volley_Net_Left', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Beach_Volley_Net_Left.png');
        // Load 21_Beach_16x16_Beach_Volley_Net_Middle_Modular
        this.load.image('tile_21_Beach_16x16_Beach_Volley_Net_Middle_Modular', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Beach_Volley_Net_Middle_Modular.png');
        // Load 21_Beach_16x16_Beach_Volley_Net_Right
        this.load.image('tile_21_Beach_16x16_Beach_Volley_Net_Right', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Beach_Volley_Net_Right.png');
        // Load 21_Beach_16x16_Big_Sea_Rock_Vers_1
        this.load.image('tile_21_Beach_16x16_Big_Sea_Rock_Vers_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Big_Sea_Rock_Vers_1.png');
        // Load 21_Beach_16x16_Big_Sprout_Vers_1
        this.load.image('tile_21_Beach_16x16_Big_Sprout_Vers_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Big_Sprout_Vers_1.png');
        // Load 21_Beach_16x16_Blue_Beach_Umbrella_Opened
        this.load.image('tile_21_Beach_16x16_Blue_Beach_Umbrella_Opened', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Blue_Beach_Umbrella_Opened.png');
        // Load 21_Beach_16x16_Direction_Pole_Big
        this.load.image('tile_21_Beach_16x16_Direction_Pole_Big', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Direction_Pole_Big.png');
        // Load 21_Beach_16x16_DJ_Set
        this.load.image('tile_21_Beach_16x16_DJ_Set', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_DJ_Set.png');
        // Load 21_Beach_16x16_Example_Big_Stage_1_Sand
        this.load.image('tile_21_Beach_16x16_Example_Big_Stage_1_Sand', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Example_Big_Stage_1_Sand.png');
        // Load 21_Beach_16x16_Example_Big_Stage_1
        this.load.image('tile_21_Beach_16x16_Example_Big_Stage_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Example_Big_Stage_1.png');
        // Load 21_Beach_16x16_Example_Big_Stage_2_Sand
        this.load.image('tile_21_Beach_16x16_Example_Big_Stage_2_Sand', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Example_Big_Stage_2_Sand.png');
        // Load 21_Beach_16x16_Example_Big_Stage_2
        this.load.image('tile_21_Beach_16x16_Example_Big_Stage_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Example_Big_Stage_2.png');
        // Load 21_Beach_16x16_Example_Big_Stage_Structure
        this.load.image('tile_21_Beach_16x16_Example_Big_Stage_Structure', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Example_Big_Stage_Structure.png');
        // Load 21_Beach_16x16_Example_Lighthouse
        this.load.image('tile_21_Beach_16x16_Example_Lighthouse', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Example_Lighthouse.png');
        // Load 21_Beach_16x16_Left_Side_Stage_1_Sand
        this.load.image('tile_21_Beach_16x16_Left_Side_Stage_1_Sand', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Left_Side_Stage_1_Sand.png');
        // Load 21_Beach_16x16_Left_Side_Stage_1
        this.load.image('tile_21_Beach_16x16_Left_Side_Stage_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Left_Side_Stage_1.png');
        // Load 21_Beach_16x16_Left_Side_Stage_2_Sand
        this.load.image('tile_21_Beach_16x16_Left_Side_Stage_2_Sand', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Left_Side_Stage_2_Sand.png');
        // Load 21_Beach_16x16_Left_Side_Stage_2
        this.load.image('tile_21_Beach_16x16_Left_Side_Stage_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Left_Side_Stage_2.png');
        // Load 21_Beach_16x16_Middle_Modular_Stage_1_Sand
        this.load.image('tile_21_Beach_16x16_Middle_Modular_Stage_1_Sand', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Middle_Modular_Stage_1_Sand.png');
        // Load 21_Beach_16x16_Middle_Modular_Stage_1
        this.load.image('tile_21_Beach_16x16_Middle_Modular_Stage_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Middle_Modular_Stage_1.png');
        // Load 21_Beach_16x16_Middle_Modular_Stage_2_Sand
        this.load.image('tile_21_Beach_16x16_Middle_Modular_Stage_2_Sand', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Middle_Modular_Stage_2_Sand.png');
        // Load 21_Beach_16x16_Middle_Modular_Stage_2
        this.load.image('tile_21_Beach_16x16_Middle_Modular_Stage_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Middle_Modular_Stage_2.png');
        // Load 21_Beach_16x16_Music_Box
        this.load.image('tile_21_Beach_16x16_Music_Box', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Music_Box.png');
        // Load 21_Beach_16x16_Palm_Tree
        this.load.image('tile_21_Beach_16x16_Palm_Tree', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Palm_Tree.png');
        // Load 21_Beach_16x16_Seagull_Left
        this.load.image('tile_21_Beach_16x16_Seagull_Left', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Seagull_Left.png');
        // Load 21_Beach_16x16_Ship_Bar
        this.load.image('tile_21_Beach_16x16_Ship_Bar', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/21_Beach_16x16_Ship_Bar.png');
        // Load ME_Singles_Camping_16x16_Mobile_House_Big_1
        this.load.image('tile_ME_Singles_Camping_16x16_Mobile_House_Big_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Mobile_House_Big_1.png');
        // Load ME_Singles_Camping_16x16_Mobile_House_Big_5
        this.load.image('tile_ME_Singles_Camping_16x16_Mobile_House_Big_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Mobile_House_Big_5.png');
        // Load ME_Singles_Camping_16x16_Pier_1
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_1.png');
        // Load ME_Singles_Camping_16x16_Pier_2
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_2.png');
        // Load ME_Singles_Camping_16x16_Pier_3
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_3.png');
        // Load ME_Singles_Camping_16x16_Pier_4
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_4.png');
        // Load ME_Singles_Camping_16x16_Pier_5
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_5.png');
        // Load ME_Singles_Camping_16x16_Pier_6
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_6', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_6.png');
        // Load ME_Singles_Camping_16x16_Pier_7
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_7', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_7.png');
        // Load ME_Singles_Camping_16x16_Pier_8
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_8', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_8.png');
        // Load ME_Singles_Camping_16x16_Pier_9
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_9', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_9.png');
        // Load ME_Singles_Camping_16x16_Pier_10
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_10', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_10.png');
        // Load ME_Singles_Camping_16x16_Pier_11
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_11', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_11.png');
        // Load ME_Singles_Camping_16x16_Pier_12
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_12', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_12.png');
        // Load ME_Singles_Camping_16x16_Pier_13
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_13', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_13.png');
        // Load ME_Singles_Camping_16x16_Pier_14
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_14', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_14.png');
        // Load ME_Singles_Camping_16x16_Pier_15
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_15', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_15.png');
        // Load ME_Singles_Camping_16x16_Pier_17
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_17', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_17.png');
        // Load ME_Singles_Camping_16x16_Pier_18
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_18', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_18.png');
        // Load ME_Singles_Camping_16x16_Pier_19
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_19', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_19.png');
        // Load ME_Singles_Camping_16x16_Pier_20
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_20', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_20.png');
        // Load ME_Singles_Camping_16x16_Pier_21
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_21', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_21.png');
        // Load ME_Singles_Camping_16x16_Pier_22
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_22', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_22.png');
        // Load ME_Singles_Camping_16x16_Pier_23
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_23', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_23.png');
        // Load ME_Singles_Camping_16x16_Pier_24
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_24', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_24.png');
        // Load ME_Singles_Camping_16x16_Pier_25
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_25', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_25.png');
        // Load ME_Singles_Camping_16x16_Pier_26
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_26', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_26.png');
        // Load ME_Singles_Camping_16x16_Pier_27
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_27', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_27.png');
        // Load ME_Singles_Camping_16x16_Pier_28
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_28', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_28.png');
        // Load ME_Singles_Camping_16x16_Pier_29
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_29', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_29.png');
        // Load ME_Singles_Camping_16x16_Pier_Barrel_3
        this.load.image('tile_ME_Singles_Camping_16x16_Pier_Barrel_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Pier_Barrel_3.png');
        // Load ME_Singles_Camping_16x16_Rock_2
        this.load.image('tile_ME_Singles_Camping_16x16_Rock_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Rock_2.png');
        // Load ME_Singles_Camping_16x16_Signboard_2
        this.load.image('tile_ME_Singles_Camping_16x16_Signboard_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Signboard_2.png');
        // Load ME_Singles_Camping_16x16_Tent_1
        this.load.image('tile_ME_Singles_Camping_16x16_Tent_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tent_1.png');
        // Load ME_Singles_Camping_16x16_Tent_2
        this.load.image('tile_ME_Singles_Camping_16x16_Tent_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tent_2.png');
        // Load ME_Singles_Camping_16x16_Tent_3
        this.load.image('tile_ME_Singles_Camping_16x16_Tent_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tent_3.png');
        // Load ME_Singles_Camping_16x16_Tree_1
        this.load.image('tile_ME_Singles_Camping_16x16_Tree_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tree_1.png');
        // Load ME_Singles_Camping_16x16_Tree_13
        this.load.image('tile_ME_Singles_Camping_16x16_Tree_13', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tree_13.png');
        // Load ME_Singles_Camping_16x16_Tree_52
        this.load.image('tile_ME_Singles_Camping_16x16_Tree_52', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tree_52.png');
        // Load ME_Singles_Camping_16x16_Tree_73
        this.load.image('tile_ME_Singles_Camping_16x16_Tree_73', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tree_73.png');
        // Load ME_Singles_Camping_16x16_Tree_257
        this.load.image('tile_ME_Singles_Camping_16x16_Tree_257', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tree_257.png');
        // Load ME_Singles_Camping_16x16_Tree_Dead_1
        this.load.image('tile_ME_Singles_Camping_16x16_Tree_Dead_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tree_Dead_1.png');
        // Load ME_Singles_Camping_16x16_Tree_Dead_14
        this.load.image('tile_ME_Singles_Camping_16x16_Tree_Dead_14', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Camping_16x16_Tree_Dead_14.png');
        // Load ME_Singles_City_Props_16x16_Antenna
        this.load.image('tile_ME_Singles_City_Props_16x16_Antenna', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Antenna.png');
        // Load ME_Singles_City_Props_16x16_Black_Open_Lateral_Full_Trash_Can
        this.load.image('tile_ME_Singles_City_Props_16x16_Black_Open_Lateral_Full_Trash_Can', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Black_Open_Lateral_Full_Trash_Can.png');
        // Load ME_Singles_City_Props_16x16_Blue_Open_Full_Trash_Can
        this.load.image('tile_ME_Singles_City_Props_16x16_Blue_Open_Full_Trash_Can', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Blue_Open_Full_Trash_Can.png');
        // Load ME_Singles_City_Props_16x16_Cone_3
        this.load.image('tile_ME_Singles_City_Props_16x16_Cone_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Cone_3.png');
        // Load ME_Singles_City_Props_16x16_Cone_4
        this.load.image('tile_ME_Singles_City_Props_16x16_Cone_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Cone_4.png');
        // Load ME_Singles_City_Props_16x16_Cone_5
        this.load.image('tile_ME_Singles_City_Props_16x16_Cone_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Cone_5.png');
        // Load ME_Singles_City_Props_16x16_Container_1
        this.load.image('tile_ME_Singles_City_Props_16x16_Container_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Container_1.png');
        // Load ME_Singles_City_Props_16x16_Container_2
        this.load.image('tile_ME_Singles_City_Props_16x16_Container_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Container_2.png');
        // Load ME_Singles_City_Props_16x16_Container_3
        this.load.image('tile_ME_Singles_City_Props_16x16_Container_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Container_3.png');
        // Load ME_Singles_City_Props_16x16_Container_4
        this.load.image('tile_ME_Singles_City_Props_16x16_Container_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Container_4.png');
        // Load ME_Singles_City_Props_16x16_Container_5
        this.load.image('tile_ME_Singles_City_Props_16x16_Container_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Container_5.png');
        // Load ME_Singles_City_Props_16x16_Container_6
        this.load.image('tile_ME_Singles_City_Props_16x16_Container_6', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Container_6.png');
        // Load ME_Singles_City_Props_16x16_Container_House_1
        this.load.image('tile_ME_Singles_City_Props_16x16_Container_House_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Container_House_1.png');
        // Load ME_Singles_City_Props_16x16_Fountain_1
        this.load.image('tile_ME_Singles_City_Props_16x16_Fountain_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Fountain_1.png');
        // Load ME_Singles_City_Props_16x16_Fountain_2
        this.load.image('tile_ME_Singles_City_Props_16x16_Fountain_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Fountain_2.png');
        // Load ME_Singles_City_Props_16x16_Kiosk_Coffee_Cup
        this.load.image('tile_ME_Singles_City_Props_16x16_Kiosk_Coffee_Cup', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Kiosk_Coffee_Cup.png');
        // Load ME_Singles_City_Props_16x16_Water_Tower_4
        this.load.image('tile_ME_Singles_City_Props_16x16_Water_Tower_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Water_Tower_4.png');
        // Load ME_Singles_Fire_Station_16x16_Building
        this.load.image('tile_ME_Singles_Fire_Station_16x16_Building', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Fire_Station_16x16_Building.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Bait_Shop_1
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Bait_Shop_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Bait_Shop_1.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Bakery_1
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Bakery_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Bakery_1.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Butchery_1
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Butchery_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Butchery_1.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Condo_2
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Condo_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Condo_2.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Gun_Store_1
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Gun_Store_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Gun_Store_1.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Gym_1
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Gym_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Gym_1.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Ice_Cream_Shop_1
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Ice_Cream_Shop_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Ice_Cream_Shop_1.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Ice_Cream_Shop_Props_3
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Ice_Cream_Shop_Props_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Ice_Cream_Shop_Props_3.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Music_Store_2
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Music_Store_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Music_Store_2.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_1
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_1.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_7
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_7', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_7.png');
        // Load ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_9
        this.load.image('tile_ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_9', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Floor_Modular_Building_16x16_Ground_Floor_Shop_9.png');
        // Load ME_Singles_Garden_16x16_Big_Sprout_Vase_1
        this.load.image('tile_ME_Singles_Garden_16x16_Big_Sprout_Vase_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Big_Sprout_Vase_1.png');
        // Load ME_Singles_Garden_16x16_Big_Sprout_Vase_2
        this.load.image('tile_ME_Singles_Garden_16x16_Big_Sprout_Vase_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Big_Sprout_Vase_2.png');
        // Load ME_Singles_Garden_16x16_Big_Sprout_Vase_3
        this.load.image('tile_ME_Singles_Garden_16x16_Big_Sprout_Vase_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Big_Sprout_Vase_3.png');
        // Load ME_Singles_Garden_16x16_Big_Wood_Cart_Full_3
        this.load.image('tile_ME_Singles_Garden_16x16_Big_Wood_Cart_Full_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Big_Wood_Cart_Full_3.png');
        // Load ME_Singles_Garden_16x16_Blue_Brown_Wood_Storage
        this.load.image('tile_ME_Singles_Garden_16x16_Blue_Brown_Wood_Storage', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Blue_Brown_Wood_Storage.png');
        // Load ME_Singles_Garden_16x16_Brown_Little_Bird_House
        this.load.image('tile_ME_Singles_Garden_16x16_Brown_Little_Bird_House', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Brown_Little_Bird_House.png');
        // Load ME_Singles_Garden_16x16_Brown_Wood_Storage
        this.load.image('tile_ME_Singles_Garden_16x16_Brown_Wood_Storage', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Brown_Wood_Storage.png');
        // Load ME_Singles_Garden_16x16_Fountain_2_3
        this.load.image('tile_ME_Singles_Garden_16x16_Fountain_2_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Fountain_2_3.png');
        // Load ME_Singles_Garden_16x16_Fountain_3_1
        this.load.image('tile_ME_Singles_Garden_16x16_Fountain_3_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Fountain_3_1.png');
        // Load ME_Singles_Garden_16x16_Fountain_3_3
        this.load.image('tile_ME_Singles_Garden_16x16_Fountain_3_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Fountain_3_3.png');
        // Load ME_Singles_Garden_16x16_Grass_Arch_1
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Arch_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Arch_1.png');
        // Load ME_Singles_Garden_16x16_Grass_Arch_2
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Arch_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Arch_2.png');
        // Load ME_Singles_Garden_16x16_Grass_Arch_3
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Arch_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Arch_3.png');
        // Load ME_Singles_Garden_16x16_Grass_Arch_4
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Arch_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Arch_4.png');
        // Load ME_Singles_Garden_16x16_Grass_Statue_4
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Statue_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Statue_4.png');
        // Load ME_Singles_Garden_16x16_Grass_Statue_5
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Statue_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Statue_5.png');
        // Load ME_Singles_Garden_16x16_Grass_Statue_6
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Statue_6', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Statue_6.png');
        // Load ME_Singles_Garden_16x16_Grass_Statue_7
        this.load.image('tile_ME_Singles_Garden_16x16_Grass_Statue_7', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Grass_Statue_7.png');
        // Load ME_Singles_Garden_16x16_Large_Greenhouse_Example
        this.load.image('tile_ME_Singles_Garden_16x16_Large_Greenhouse_Example', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Large_Greenhouse_Example.png');
        // Load ME_Singles_Garden_16x16_Medium_Sprout_Vase_2
        this.load.image('tile_ME_Singles_Garden_16x16_Medium_Sprout_Vase_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Medium_Sprout_Vase_2.png');
        // Load ME_Singles_Garden_16x16_Palace_Example_1
        this.load.image('tile_ME_Singles_Garden_16x16_Palace_Example_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Palace_Example_1.png');
        // Load ME_Singles_Garden_16x16_Red_Brown_Wood_Storage
        this.load.image('tile_ME_Singles_Garden_16x16_Red_Brown_Wood_Storage', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Red_Brown_Wood_Storage.png');
        // Load ME_Singles_Garden_16x16_Red_Little_Bird_House
        this.load.image('tile_ME_Singles_Garden_16x16_Red_Little_Bird_House', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Red_Little_Bird_House.png');
        // Load ME_Singles_Garden_16x16_Statue_Angel_2
        this.load.image('tile_ME_Singles_Garden_16x16_Statue_Angel_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Garden_16x16_Statue_Angel_2.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_4_30
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_4_30', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_4_30.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_4_33
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_4_33', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_4_33.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_4_38
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_4_38', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_4_38.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_4_39
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_4_39', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_4_39.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_4_40
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_4_40', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_4_40.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_6_Example
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_6_Example', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_6_Example.png');
        // Load ME_Singles_Hotel_and_Hospital_16x16_Hospital_1
        this.load.image('tile_ME_Singles_Hotel_and_Hospital_16x16_Hospital_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Hotel_and_Hospital_16x16_Hospital_1.png');
        // Load ME_Singles_Hotel_and_Hospital_16x16_Hospital_Sign_1
        this.load.image('tile_ME_Singles_Hotel_and_Hospital_16x16_Hospital_Sign_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Hotel_and_Hospital_16x16_Hospital_Sign_1.png');
        // Load ME_Singles_Police_Station_16x16_Parking_Booth_2
        this.load.image('tile_ME_Singles_Police_Station_16x16_Parking_Booth_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Police_Station_16x16_Parking_Booth_2.png');
        // Load ME_Singles_Police_Station_16x16_Police_Car_2
        this.load.image('tile_ME_Singles_Police_Station_16x16_Police_Car_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Police_Station_16x16_Police_Car_2.png');
        // Load ME_Singles_Police_Station_16x16_Police_Station_1
        this.load.image('tile_ME_Singles_Police_Station_16x16_Police_Station_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Police_Station_16x16_Police_Station_1.png');
        // Load ME_Singles_School_16x16_Clock_Tower_1
        this.load.image('tile_ME_Singles_School_16x16_Clock_Tower_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_School_16x16_Clock_Tower_1.png');
        // Load ME_Singles_School_16x16_School_1
        this.load.image('tile_ME_Singles_School_16x16_School_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_School_16x16_School_1.png');
        // Load ME_Singles_School_16x16_School_Yard_Toy_4
        this.load.image('tile_ME_Singles_School_16x16_School_Yard_Toy_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_School_16x16_School_Yard_Toy_4.png');
        // Load ME_Singles_School_16x16_School_Yard_Toy_12
        this.load.image('tile_ME_Singles_School_16x16_School_Yard_Toy_12', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_School_16x16_School_Yard_Toy_12.png');
        // Load ME_Singles_School_16x16_School_Yard_Toy_13
        this.load.image('tile_ME_Singles_School_16x16_School_Yard_Toy_13', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_School_16x16_School_Yard_Toy_13.png');
        // Load ME_Singles_School_16x16_Soccer_Court_1
        this.load.image('tile_ME_Singles_School_16x16_Soccer_Court_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_School_16x16_Soccer_Court_1.png');
        // Load ME_Singles_School_16x16_Soccer_Court_2
        this.load.image('tile_ME_Singles_School_16x16_Soccer_Court_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_School_16x16_Soccer_Court_2.png');
        // Load ME_Singles_Shopping_Center_and_Markets_16x16_Mall_Door_2
        this.load.image('tile_ME_Singles_Shopping_Center_and_Markets_16x16_Mall_Door_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Shopping_Center_and_Markets_16x16_Mall_Door_2.png');
        // Load ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_1
        this.load.image('tile_ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_1.png');
        // Load ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_5
        this.load.image('tile_ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_5.png');
        // Load ME_Singles_Shopping_Center_and_Markets_16x16_Market_Medium_1
        this.load.image('tile_ME_Singles_Shopping_Center_and_Markets_16x16_Market_Medium_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Shopping_Center_and_Markets_16x16_Market_Medium_1.png');
        // Load ME_Singles_Terrains_and_Fences_16x16_Others_1
        this.load.image('tile_ME_Singles_Terrains_and_Fences_16x16_Others_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Terrains_and_Fences_16x16_Others_1.png');
        // Load ME_Singles_Terrains_and_Fences_16x16_Others_2
        this.load.image('tile_ME_Singles_Terrains_and_Fences_16x16_Others_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Terrains_and_Fences_16x16_Others_2.png');
        // Load ME_Singles_Terrains_and_Fences_16x16_Others_3
        this.load.image('tile_ME_Singles_Terrains_and_Fences_16x16_Others_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Terrains_and_Fences_16x16_Others_3.png');
        // Load ME_Singles_Terrains_and_Fences_16x16_Others_9
        this.load.image('tile_ME_Singles_Terrains_and_Fences_16x16_Others_9', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Terrains_and_Fences_16x16_Others_9.png');
        // Load ME_Singles_Terrains_and_Fences_16x16_Others_10
        this.load.image('tile_ME_Singles_Terrains_and_Fences_16x16_Others_10', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Terrains_and_Fences_16x16_Others_10.png');
        // Load ME_Singles_Vehicles_16x16_Boat_2_Left_2
        this.load.image('tile_ME_Singles_Vehicles_16x16_Boat_2_Left_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Boat_2_Left_2.png');
        // Load ME_Singles_Vehicles_16x16_Boat_3_Left_1
        this.load.image('tile_ME_Singles_Vehicles_16x16_Boat_3_Left_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Boat_3_Left_1.png');
        // Load ME_Singles_Vehicles_16x16_Camper_Right_3
        this.load.image('tile_ME_Singles_Vehicles_16x16_Camper_Right_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Camper_Right_3.png');
        // Load ME_Singles_Vehicles_16x16_Car_Right_23
        this.load.image('tile_ME_Singles_Vehicles_16x16_Car_Right_23', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Right_23.png');
        // Load ME_Singles_Vehicles_16x16_Car_Right_25
        this.load.image('tile_ME_Singles_Vehicles_16x16_Car_Right_25', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Right_25.png');
        // Load ME_Singles_Vehicles_16x16_Fruit_Flowers_Cart_2
        this.load.image('tile_ME_Singles_Vehicles_16x16_Fruit_Flowers_Cart_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Fruit_Flowers_Cart_2.png');
        // Load ME_Singles_Vehicles_16x16_Hot_Dog_Cart_2
        this.load.image('tile_ME_Singles_Vehicles_16x16_Hot_Dog_Cart_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Hot_Dog_Cart_2.png');
        // Load ME_Singles_Vehicles_16x16_Hot_Dog_Cart_3
        this.load.image('tile_ME_Singles_Vehicles_16x16_Hot_Dog_Cart_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Hot_Dog_Cart_3.png');
        // Load ME_Singles_Vehicles_16x16_Ice_Cream_Truck_1
        this.load.image('tile_ME_Singles_Vehicles_16x16_Ice_Cream_Truck_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Ice_Cream_Truck_1.png');
        // Load ME_Singles_Vehicles_16x16_Street_Food_Cart_2
        this.load.image('tile_ME_Singles_Vehicles_16x16_Street_Food_Cart_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Street_Food_Cart_2.png');
        // Load ME_Singles_Vehicles_16x16_Tacos_Truck_1
        this.load.image('tile_ME_Singles_Vehicles_16x16_Tacos_Truck_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Vehicles_16x16_Tacos_Truck_1.png');
        // Load ME_Singles_Villas_16x16_Toy_House_1
        this.load.image('tile_ME_Singles_Villas_16x16_Toy_House_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Toy_House_1.png');
        // Load ME_Singles_Villas_16x16_Toy_House_3
        this.load.image('tile_ME_Singles_Villas_16x16_Toy_House_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Toy_House_3.png');
        // Load ME_Singles_Villas_16x16_Toy_House_5
        this.load.image('tile_ME_Singles_Villas_16x16_Toy_House_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Toy_House_5.png');
        // Load ME_Singles_Villas_16x16_Tree_1
        this.load.image('tile_ME_Singles_Villas_16x16_Tree_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Tree_1.png');
        // Load ME_Singles_Villas_16x16_Tree_4
        this.load.image('tile_ME_Singles_Villas_16x16_Tree_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Tree_4.png');
        // Load ME_Singles_Villas_16x16_Tree_House_1
        this.load.image('tile_ME_Singles_Villas_16x16_Tree_House_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Tree_House_1.png');
        // Load ME_Singles_Villas_16x16_Villa_1
        this.load.image('tile_ME_Singles_Villas_16x16_Villa_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Villa_1.png');
        // Load ME_Singles_Villas_16x16_Villa_2
        this.load.image('tile_ME_Singles_Villas_16x16_Villa_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Villa_2.png');
        // Load ME_Singles_Villas_16x16_Villa_3
        this.load.image('tile_ME_Singles_Villas_16x16_Villa_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Villa_3.png');
        // Load ME_Singles_Villas_16x16_Villa_4
        this.load.image('tile_ME_Singles_Villas_16x16_Villa_4', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Villa_4.png');
        // Load ME_Singles_Villas_16x16_Villa_5
        this.load.image('tile_ME_Singles_Villas_16x16_Villa_5', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Villas_16x16_Villa_5.png');
        // Load ME_Singles_City_Props_16x16_Kiosk_Infopoint_2
        this.load.image('tile_ME_Singles_City_Props_16x16_Kiosk_Infopoint_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Kiosk_Infopoint_2.png');
        // Load ME_Singles_City_Props_16x16_Wind_Turbine_1
        this.load.image('tile_ME_Singles_City_Props_16x16_Wind_Turbine_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_City_Props_16x16_Wind_Turbine_1.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_3_45
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_3_45', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_3_45.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_3_46
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_3_46', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_3_46.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_3_44
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_3_44', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_3_44.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_5_1
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_5_1', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_5_1.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_5_2
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_5_2', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_5_2.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_5_3
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_5_3', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_5_3.png');
        // Load ME_Singles_Generic_Building_16x16_Condo_4_36
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Condo_4_36', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Condo_4_36.png');
        // Load ME_Singles_Generic_Building_16x16_Hardware_Store_Example
        this.load.image('tile_ME_Singles_Generic_Building_16x16_Hardware_Store_Example', 'assets/tiles/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_Generic_Building_16x16_Hardware_Store_Example.png');
        
        console.log("All tile images loaded!");
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