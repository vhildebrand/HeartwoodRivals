// client/src/scenes/UIScene.ts
import { Scene } from "phaser";
import { DialogueManager } from "../ui/DialogueManager";
import { ChatManager } from "../ui/ChatManager";
import AppConfig from "../../config";

export class UIScene extends Scene {
    private dialogueManager: DialogueManager | null = null;
    private chatManager: ChatManager | null = null;
    private playerUsername: string | null = null; // Add field to store username
    private clockText: Phaser.GameObjects.Text | null = null;
    private speedText: Phaser.GameObjects.Text | null = null;
    private currentGameTime: string = "06:00";
    private currentGameDay: number = 1;
    private currentSpeedMultiplier: number = 60;
    
    // Debug panel
    private debugPanel: Phaser.GameObjects.Container | null = null;
    private debugPanelVisible: boolean = false;
    private debugPanelBackground: Phaser.GameObjects.Rectangle | null = null;
    private debugPanelTitle: Phaser.GameObjects.Text | null = null;
    private debugPanelContent: Phaser.GameObjects.Container | null = null;
    private autoRefreshTimer: Phaser.Time.TimerEvent | null = null;
    
    // Real-time NPC data from game server
    private realtimeNPCData: Map<string, any> = new Map();
    private locationsData: any = null;
    
    // Speed dating countdown UI
    private speedDatingCountdown: Phaser.GameObjects.Container | null = null;
    private countdownText: Phaser.GameObjects.Text | null = null;
    private countdownBackground: Phaser.GameObjects.Rectangle | null = null;
    private countdownVisible: boolean = false;
    
    // Minimized speed dating indicator
    private minimizedSpeedDatingIndicator: Phaser.GameObjects.Container | null = null;
    private minimizedIndicatorBackground: Phaser.GameObjects.Rectangle | null = null;
    private minimizedIndicatorText: Phaser.GameObjects.Text | null = null;
    private minimizedRestoreButton: Phaser.GameObjects.Rectangle | null = null;
    
    // Player text interface
    private playerTextContainer: Phaser.GameObjects.Container | null = null;
    private speechInputActive: boolean = false;
    private activityInputActive: boolean = false;
    private speechInputBox: Phaser.GameObjects.Rectangle | null = null;
    private speechInputText: Phaser.GameObjects.Text | null = null;
    private activityInputBox: Phaser.GameObjects.Rectangle | null = null;
    private activityInputText: Phaser.GameObjects.Text | null = null;
    private currentSpeechMessage: string = '';
    private currentActivityMessage: string = '';
    private speechPrompt: Phaser.GameObjects.Text | null = null;
    private activityPrompt: Phaser.GameObjects.Text | null = null;
    private rangeIndicator: Phaser.GameObjects.Text | null = null;

    // Speed dating manual trigger UI
    private speedDatingContainer: Phaser.GameObjects.Container | null = null;
    private speedDatingButton: Phaser.GameObjects.Rectangle | null = null;
    private speedDatingButtonText: Phaser.GameObjects.Text | null = null;
    private playerCountText: Phaser.GameObjects.Text | null = null;
    private currentPlayerCount: number = 0;
    
    // Skills UI
    private skillsPanel: Phaser.GameObjects.Container | null = null;
    private skillsPanelBackground: Phaser.GameObjects.Rectangle | null = null;
    private totalLevelText: Phaser.GameObjects.Text | null = null;
    private skillBars: Map<string, {
        container: Phaser.GameObjects.Container,
        levelText: Phaser.GameObjects.Text,
        progressBackground: Phaser.GameObjects.Rectangle,
        progressFill: Phaser.GameObjects.Rectangle,
        nameText: Phaser.GameObjects.Text,
        progressInfoText: Phaser.GameObjects.Text,
        levelUpInfoText: Phaser.GameObjects.Text,
        skillIcon: Phaser.GameObjects.Rectangle
    }> = new Map();
    private skillsPanelVisible: boolean = false;

    constructor() {
        super("UIScene");
    }

    create() {
        console.log("🎮 [UI] UIScene created and initializing...");
        
        // Load locations data for mapping coordinates to building names
        this.loadLocationsData();
        
        // Add a semi-transparent rectangle at the top for a UI bar
        this.add.rectangle(0, 0, this.cameras.main.width, 50, 0x000000, 0.5)
            .setOrigin(0, 0);
        
        // Create game time and speed UI
        this.createGameTimeUI();
        
        // Create debug panel
        this.createDebugPanel();
        
        // Create player text interface
        this.createPlayerTextInterface();
        
        // Create speed dating countdown UI
        this.createSpeedDatingCountdownUI();
        
        // Create speed dating manual trigger UI
        this.createSpeedDatingTriggerUI();
        
        // Create skills panel
        this.createSkillsPanel();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start periodic updates
        this.startPeriodicUpdates();
        
        console.log("🎮 [UI] UIScene initialization complete");
    }

    private createSpeedDatingCountdownUI() {
        console.log("💕 [UI] Creating speed dating countdown UI");
        
        // Create container for speed dating countdown
        this.speedDatingCountdown = this.add.container(0, 0);
        
        // Background (full screen overlay)
        this.countdownBackground = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.8
        );
        
        // Event announcement
        const eventTitle = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 150,
            '💕 SPEED DATING GAUNTLET STARTING! 💕',
            {
                fontSize: '36px',
                color: '#e24a90',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // Countdown text
        this.countdownText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            '10',
            {
                fontSize: '72px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // Instructions
        const instructions = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 150,
            'Get ready to charm the NPCs of Beacon Bay!\nYour social skills are about to be put to the test.',
            {
                fontSize: '18px',
                color: '#ffffff',
                fontFamily: 'Arial',
                align: 'center'
            }
        ).setOrigin(0.5);
        
        // Add all elements to container
        this.speedDatingCountdown.add([
            this.countdownBackground,
            eventTitle,
            this.countdownText,
            instructions
        ]);
        
        // Initially hide the countdown
        this.speedDatingCountdown.setVisible(false);
        
        // Set depth to ensure it's on top
        this.speedDatingCountdown.setDepth(1000);
    }

    private createSpeedDatingTriggerUI() {
        console.log("💕 [UI] Creating speed dating manual trigger UI");
        
        // Create container for speed dating trigger UI (top right)
        this.speedDatingContainer = this.add.container(this.cameras.main.width - 250, 60);
        
        // Player count display (above button)
        this.playerCountText = this.add.text(0, 0, 'Players Online: 0', {
            fontSize: '14px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 },
            fontFamily: 'Arial'
        }).setOrigin(0.5, 0);
        
        // Speed dating start button
        this.speedDatingButton = this.add.rectangle(0, 35, 200, 40, 0xe24a90, 1)
            .setStrokeStyle(2, 0xffffff);
        
        this.speedDatingButtonText = this.add.text(0, 35, 'Start Speed Dating!', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        
        // Make button interactive
        this.speedDatingButton.setInteractive();
        
        this.speedDatingButton.on('pointerdown', () => {
            this.triggerSpeedDating();
        });
        
        // Hover effects
        this.speedDatingButton.on('pointerover', () => {
            this.speedDatingButton!.setFillStyle(0xff6bb3);
            this.speedDatingButtonText!.setScale(1.05);
        });
        
        this.speedDatingButton.on('pointerout', () => {
            this.speedDatingButton!.setFillStyle(0xe24a90);
            this.speedDatingButtonText!.setScale(1.0);
        });
        
        // Add elements to container
        this.speedDatingContainer.add([
            this.playerCountText,
            this.speedDatingButton,
            this.speedDatingButtonText
        ]);
        
        // Set depth to appear above other UI
        this.speedDatingContainer.setDepth(500);
        
        console.log("💕 [UI] Speed dating manual trigger UI created");
    }

    private createSkillsPanel() {
        console.log("🏆 [UI] Creating character panel");
        
        // Create skills panel container (right side of screen, larger)
        this.skillsPanel = this.add.container(this.cameras.main.width - 320, 120);
        
        // Background (larger to accommodate more info)
        this.skillsPanelBackground = this.add.rectangle(0, 0, 310, 400, 0x000000, 0.9);
        this.skillsPanelBackground.setStrokeStyle(3, 0xFFD700, 1);
        this.skillsPanelBackground.setOrigin(0, 0);
        
        // Title
        const titleText = this.add.text(15, 15, 'Character Skills', {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        
        // Subtitle
        const subtitleText = this.add.text(15, 40, 'Visit locations and press F to train!', {
            fontSize: '11px',
            color: '#CCCCCC'
        });

        // Total level display
        this.totalLevelText = this.add.text(15, 55, 'Total Level: 7', {
            fontSize: '12px',
            color: '#FFAA00',
            fontStyle: 'bold'
        });
        
        // Close button (X in top right)
        const closeButton = this.add.text(280, 10, '✕', {
            fontSize: '16px',
            color: '#FF4444',
            fontStyle: 'bold'
        }).setInteractive();
        
        closeButton.on('pointerdown', () => {
            this.toggleSkillsPanel();
        });
        
        closeButton.on('pointerover', () => {
            closeButton.setColor('#FF6666');
            closeButton.setScale(1.2);
        });
        
        closeButton.on('pointerout', () => {
            closeButton.setColor('#FF4444');
            closeButton.setScale(1.0);
        });
        
        // Add elements to container
        this.skillsPanel.add([this.skillsPanelBackground, titleText, subtitleText, this.totalLevelText, closeButton]);
        
        // Initially hide the panel
        this.skillsPanel.setVisible(false);
        this.skillsPanel.setDepth(600); // Above other UI but below speed dating
        
        console.log("🏆 [UI] Character panel created (hidden by default)");
    }

    private toggleSkillsPanel() {
        this.skillsPanelVisible = !this.skillsPanelVisible;
        
        if (this.skillsPanel) {
            this.skillsPanel.setVisible(this.skillsPanelVisible);
            
            // Request current skill data when opening panel
            if (this.skillsPanelVisible) {
                console.log(`🏆 [UI] Opening character panel, skill bars available: ${this.skillBars.size}`);
                this.requestSkillDataUpdate();
            }
        }
        
        console.log(`🏆 [UI] Character panel ${this.skillsPanelVisible ? 'shown' : 'hidden'}`);
    }

    private requestSkillDataUpdate() {
        console.log(`🏆 [UI] Requesting skill data update from server`);
        // Request current skill data from server via GameScene
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene && gameScene.room) {
            gameScene.room.send('request_skill_data', {});
        } else {
            console.warn(`🏆 [UI] Cannot request skill data - no server connection`);
        }
    }

    private initializeSkillBars(skillNames: string[]) {
        console.log(`🏆 [UI] ===== INITIALIZE SKILL BARS CALLED =====`);
        console.log(`🏆 [UI] Skills panel exists: ${this.skillsPanel ? 'YES' : 'NO'}`);
        console.log(`🏆 [UI] Skills panel visible: ${this.skillsPanel ? this.skillsPanel.visible : 'N/A'}`);
        
        if (!this.skillsPanel) {
            console.error(`🏆 [UI] Cannot initialize skill bars - skills panel not found`);
            console.error(`🏆 [UI] Creating skills panel now...`);
            this.createSkillsPanel(); // Create the panel if it doesn't exist
            
            if (!this.skillsPanel) {
                console.error(`🏆 [UI] Failed to create skills panel - aborting skill bar creation`);
                return;
            }
        }
        
        console.log(`🏆 [UI] Initializing skill bars for: [${skillNames.join(', ')}]`);
        console.log(`🏆 [UI] Number of skills to create bars for: ${skillNames.length}`);
        
        // Clear existing skill bars
        this.skillBars.forEach(skillBar => {
            skillBar.container.destroy();
        });
        this.skillBars.clear();
        console.log(`🏆 [UI] Cleared existing skill bars`);
        
        if (skillNames.length === 0) {
            console.warn(`🏆 [UI] No skills provided to create bars for!`);
            return;
        }
        
        // Create skill bars for each skill
        skillNames.forEach((skillName, index) => {
            const yOffset = 85 + (index * 45); // More space for additional info (accounting for total level display)
            
            // Container for this skill bar
            const skillContainer = this.add.container(15, yOffset);
            
            // Skill icon/color indicator
            const skillIcon = this.add.rectangle(-5, 5, 8, 20, this.getSkillColor(skillName));
            
            // Skill name
            const nameText = this.add.text(10, 0, skillName, {
                fontSize: '14px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            });
            
            // Level text
            const levelText = this.add.text(10, 18, 'Level 1', {
                fontSize: '11px',
                color: '#FFD700'
            });
            
            // Progress info text (XP needed)
            const progressInfoText = this.add.text(150, 18, '0/100 XP', {
                fontSize: '10px',
                color: '#CCCCCC'
            });
            
            // Level up info text
            const levelUpInfoText = this.add.text(220, 18, '(100 XP to next)', {
                fontSize: '9px',
                color: '#AAAAAA'
            });
            
            // Progress bar background
            const progressBackground = this.add.rectangle(10, 32, 270, 6, 0x333333);
            progressBackground.setOrigin(0, 0.5);
            
            // Progress bar fill
            const progressFill = this.add.rectangle(10, 32, 0, 6, this.getSkillColor(skillName));
            progressFill.setOrigin(0, 0.5);
            
            // Add to skill container
            skillContainer.add([
                skillIcon,
                nameText, 
                levelText, 
                progressInfoText,
                levelUpInfoText,
                progressBackground, 
                progressFill
            ]);
            
            // Add to main skills panel
            this.skillsPanel!.add(skillContainer);
            
            // Store references (extended)
            this.skillBars.set(skillName, {
                container: skillContainer,
                levelText: levelText,
                progressBackground: progressBackground,
                progressFill: progressFill,
                nameText: nameText,
                progressInfoText: progressInfoText,
                levelUpInfoText: levelUpInfoText,
                skillIcon: skillIcon
            });
            
            console.log(`🏆 [UI] Created and stored skill bar for: "${skillName}"`);
        });
        
        console.log(`🏆 [UI] Created ${skillNames.length} detailed skill bars`);
        console.log(`🏆 [UI] Skill bars stored:`, Array.from(this.skillBars.keys()));
    }

    private getSkillColor(skillName: string): number {
        // Return different colors for different skills
        const colors = {
            'Farming': 0x00FF00,
            'Fitness': 0xFF4444,
            'Crafting': 0xFFAA00,
            'Fishing': 0x00AAFF,
            'Cooking': 0xFF6600,
            'Learning': 0x9900FF,
            'Trading': 0xFFD700
        };
        return colors[skillName as keyof typeof colors] || 0xFFFFFF;
    }

    private updateSkillBar(skillName: string, level: number, progress: number, currentExperience?: number, experienceToNext?: number, experienceGained?: number) {
        const skillBar = this.skillBars.get(skillName);
        if (!skillBar) {
            console.warn(`🏆 [UI] Skill bar not found for ${skillName}`);
            return;
        }
        
        console.log(`🏆 [UI] Updating visual elements for ${skillName}: Level ${level}, Progress ${Math.floor(progress * 100)}%`);
        
        // Update level text
        skillBar.levelText.setText(`Level ${level}`);
        
        // Update progress bar (progress should be 0-1)
        const progressWidth = Math.max(0, Math.min(270, progress * 270));
        skillBar.progressFill.setDisplaySize(progressWidth, 6);
        
        // Update progress info text
        if (currentExperience !== undefined && experienceToNext !== undefined) {
            const currentXPText = `${Math.floor(currentExperience)}/${Math.floor(currentExperience + experienceToNext)} XP`;
            const nextLevelText = `(${Math.floor(experienceToNext)} XP to next)`;
            skillBar.progressInfoText.setText(currentXPText);
            skillBar.levelUpInfoText.setText(nextLevelText);
            console.log(`🏆 [UI] Updated ${skillName} XP text: ${currentXPText}, ${nextLevelText}`);
        } else {
            // Fallback if detailed XP info not available
            const progressPercent = Math.floor(progress * 100);
            skillBar.progressInfoText.setText(`${progressPercent}%`);
            skillBar.levelUpInfoText.setText(`(${100 - progressPercent}% to next)`);
            console.log(`🏆 [UI] Updated ${skillName} progress text (fallback): ${progressPercent}%`);
        }
        
        // Show experience gain feedback if provided
        if (experienceGained !== undefined && experienceGained > 0) {
            this.showExperienceGainFeedback(skillName, experienceGained);
        }
    }

    private showExperienceGainFeedback(skillName: string, experienceGained: number) {
        const skillBar = this.skillBars.get(skillName);
        if (!skillBar || !this.skillsPanel) return;
        
        // Get the skill bar's world position
        const skillBarWorldPos = skillBar.container.getWorldTransformMatrix();
        const containerWorldPos = this.skillsPanel.getWorldTransformMatrix();
        
        // Create temporary XP text positioned relative to the skill bar
        const xpText = this.add.text(
            280, 
            skillBar.container.y + 5,
            `+${experienceGained} XP`,
            {
                fontSize: '11px',
                color: '#00FF00',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 1
            }
        );
        
        // Add to skills panel temporarily
        this.skillsPanel.add(xpText);
        
        // Animate and remove
        this.tweens.add({
            targets: xpText,
            y: xpText.y - 25,
            alpha: 0,
            duration: 1800,
            ease: 'Power2',
            onComplete: () => {
                xpText.destroy();
            }
        });
    }

    private updateTotalLevel(totalLevel: number) {
        if (this.totalLevelText) {
            this.totalLevelText.setText(`Total Level: ${totalLevel}`);
        }
    }

    private handleSkillProgress(event: any) {
        const { skillName, newLevel, experienceGained, progress, currentExperience, experienceToNext } = event;
        
        console.log(`🏆 [UI] Received skill progress event for: "${skillName}"`);
        console.log(`🏆 [UI] Available skill bars: [${Array.from(this.skillBars.keys()).join(', ')}]`);
        console.log(`🏆 [UI] Skill bar exists for "${skillName}": ${this.skillBars.has(skillName)}`);
        console.log(`🏆 [UI] Updating skill bar for ${skillName}: Level ${newLevel}, Progress ${Math.floor(progress * 100)}%, XP: ${currentExperience}/${currentExperience + experienceToNext}`);
        
        this.updateSkillBar(skillName, newLevel, progress, currentExperience, experienceToNext, experienceGained);
        
        if (event.leveledUp) {
            console.log(`🎉 [UI] ${skillName} leveled up to ${newLevel}!`);
            this.showSkillLevelUpNotification(skillName, newLevel);
        }
    }

    private showSkillLevelUpNotification(skillName: string, newLevel: number) {
        // Create a temporary level up notification
        const notification = this.add.text(
            this.cameras.main.centerX,
            100,
            `🎉 ${skillName} Level ${newLevel}!`,
            {
                fontSize: '20px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5);
        
        notification.setDepth(2000);
        notification.setScrollFactor(0); // Fixed to camera
        
        // Animate the notification
        this.tweens.add({
            targets: notification,
            y: 60,
            alpha: 0,
            scale: 1.2,
            duration: 3000,
            ease: 'Power2',
            onComplete: () => {
                notification.destroy();
            }
        });
    }

    private triggerSpeedDating() {
        console.log("🎯 [UI] Player triggered speed dating manually");
        console.log(`📊 [UI] Current player count: ${this.currentPlayerCount}`);
        
        // Send message to game server to start speed dating
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene && gameScene.room) {
            gameScene.room.send('start_speed_dating', {
                triggeredBy: 'player_ui',
                timestamp: Date.now(),
                currentPlayerCount: this.currentPlayerCount // Pass current player count
            });
            
            console.log(`✅ [UI] Speed dating start request sent to server with ${this.currentPlayerCount} players`);
            
            // Disable button temporarily to prevent spam clicking
            if (this.speedDatingButton && this.speedDatingButtonText) {
                this.speedDatingButton!.setFillStyle(0x666666);
                this.speedDatingButtonText!.setText('Starting...');
                this.speedDatingButton!.disableInteractive();
                
                // Re-enable after 3 seconds
                this.time.delayedCall(3000, () => {
                    if (this.speedDatingButton && this.speedDatingButtonText) {
                        this.speedDatingButton!.setFillStyle(0xe24a90);
                        this.speedDatingButtonText!.setText('Start Speed Dating!');
                        this.speedDatingButton!.setInteractive();
                    }
                });
            }
        } else {
            console.error("❌ [UI] Cannot trigger speed dating - game room not available");
        }
    }

    private setupEventListeners() {
        // Listen for speed dating countdown events
        this.game.events.on('speed_dating_countdown', (data: any) => {
            console.log('💕 [UI] Speed dating countdown started:', data);
            this.startSpeedDatingCountdown(data.countdownSeconds || 10);
        });
        
        // Listen for speed dating start (hide countdown)
        this.game.events.on('speed_dating_start', (data: any) => {
            console.log('💕 [UI] Speed dating started, hiding countdown');
            this.hideSpeedDatingCountdown();
        });
        
        // Speed dating minimize/restore events
        this.game.events.on('speed_dating_minimized', (data: any) => {
            console.log('💕 [UI] Speed dating minimized:', data);
            this.showMinimizedSpeedDatingIndicator(data);
        });
        
        this.game.events.on('speed_dating_restored', () => {
            console.log('💕 [UI] Speed dating restored');
            this.hideMinimizedSpeedDatingIndicator();
        });
        
        // Existing event listeners...
        this.game.events.on('playerIdSet', (playerId: string, username: string) => {
            console.log("🎮 [UI] Player ID set:", playerId, "with username:", username);
            
            // Store the username for later use
            this.playerUsername = username;
            
            // Set the player character ID on dialogue manager with the actual username
            if (this.dialogueManager) {
                this.dialogueManager.setPlayerCharacterId(username);
                console.log("💬 [UI] DialogueManager configured with username:", username);
            } else {
                console.log("💬 [UI] DialogueManager not yet initialized, will set username when created");
            }
        });

        // Listen for game state updates to track player count
        this.game.events.on('gameStateUpdate', (gameState: any) => {
            // This might include player count, but we need to track it from GameScene
        });

        // Listen for player count updates from GameScene
        this.game.events.on('playerCountUpdate', (playerCount: number) => {
            this.updatePlayerCount(playerCount);
        });

        // Listen for skill progress events from GameScene
        this.game.events.on('skillProgress', (event: any) => {
            console.log(`🏆 [UI] Skill progress: ${event.skillName} +${event.experienceGained} XP`);
            this.handleSkillProgress(event);
        });

        // Listen for skill system initialization (to create skill bars)
        this.game.events.on('skillSystemInitialized', (skillNames: string[]) => {
            console.log(`🏆 [UI] ===== SKILL SYSTEM INITIALIZED EVENT RECEIVED =====`);
            console.log(`🏆 [UI] Received skill names: ${skillNames ? skillNames.join(', ') : 'NONE'}`);
            console.log(`🏆 [UI] Skill names count: ${skillNames ? skillNames.length : 0}`);
            
            if (skillNames && skillNames.length > 0) {
                console.log(`🏆 [UI] Creating skill bars for ${skillNames.length} skills`);
                this.initializeSkillBars(skillNames);
                
                // Request initial skill data right after creating the bars
                setTimeout(() => {
                    console.log(`🏆 [UI] Requesting initial skill data after skill bars created`);
                    this.requestSkillDataUpdate();
                }, 200);
            } else {
                console.warn(`🏆 [UI] No skill names provided - cannot create skill bars`);
            }
        });

        // Listen for total level updates
        this.game.events.on('totalLevelUpdate', (totalLevel: number) => {
            this.updateTotalLevel(totalLevel);
        });
    }

    private updatePlayerCount(playerCount: number) {
        this.currentPlayerCount = playerCount;
        
        if (this.playerCountText) {
            this.playerCountText.setText(`Players Online: ${playerCount}`);
        }
        
        console.log(`👥 [UI] Player count updated: ${playerCount}`);
    }

    private startSpeedDatingCountdown(seconds: number) {
        console.log(`💕 [UI] Starting speed dating countdown: ${seconds} seconds`);
        
        // Show countdown UI
        this.speedDatingCountdown?.setVisible(true);
        this.countdownVisible = true;
        
        let timeLeft = seconds;
        
        // Immediately update the countdown text to show the correct starting value
        if (this.countdownText) {
            this.countdownText.setText(timeLeft.toString());
        }
        
        // Create countdown timer
        const countdownTimer = this.time.addEvent({
            delay: 1000,
            repeat: seconds - 1,
            callback: () => {
                timeLeft--;
                
                if (this.countdownText) {
                    this.countdownText.setText(timeLeft.toString());
                    
                    // Add pulsing effect
                    this.tweens.add({
                        targets: this.countdownText,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        duration: 200,
                        yoyo: true,
                        ease: 'Power2'
                    });
                    
                    // Change color when getting close
                    if (timeLeft <= 10) {
                        this.countdownText.setColor('#ff4444');
                    } else if (timeLeft <= 30) {
                        this.countdownText.setColor('#ffaa00');
                    }
                }
                
                if (timeLeft === 0) {
                    this.hideSpeedDatingCountdown();
                }
            }
        });
    }

    private hideSpeedDatingCountdown() {
        if (this.speedDatingCountdown && this.countdownVisible) {
            console.log('💕 [UI] Hiding speed dating countdown');
            
            this.tweens.add({
                targets: this.speedDatingCountdown,
                alpha: 0,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    this.speedDatingCountdown?.setVisible(false);
                    this.speedDatingCountdown?.setAlpha(1);
                    this.countdownVisible = false;
                }
            });
        }
    }

    private showMinimizedSpeedDatingIndicator(data: any) {
        const { width, height } = this.cameras.main;
        
        // Create minimized indicator if it doesn't exist
        if (!this.minimizedSpeedDatingIndicator) {
            this.minimizedSpeedDatingIndicator = this.add.container(0, 0);
            this.minimizedSpeedDatingIndicator.setDepth(1000);
            
            // Background
            this.minimizedIndicatorBackground = this.add.rectangle(
                width * 0.85,
                height * 0.1,
                200,
                60,
                0x1a0d1a,
                0.9
            );
            this.minimizedIndicatorBackground.setStrokeStyle(2, 0xff69b4, 0.8);
            
            // Text
            this.minimizedIndicatorText = this.add.text(
                width * 0.85,
                height * 0.1,
                'Speed Dating',
                {
                    fontSize: '16px',
                    color: '#ff69b4',
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                    fontStyle: 'bold',
                    align: 'center'
                }
            ).setOrigin(0.5);
            
            // Restore button
            this.minimizedRestoreButton = this.add.rectangle(
                width * 0.93,
                height * 0.1,
                30,
                30,
                0xff69b4,
                0.8
            );
            this.minimizedRestoreButton.setStrokeStyle(2, 0xffffff);
            this.minimizedRestoreButton.setInteractive({ useHandCursor: true });
            this.minimizedRestoreButton.on('pointerdown', () => {
                // Send restore event to SpeedDatingScene
                const speedDatingScene = this.scene.get('SpeedDatingScene') as any;
                if (speedDatingScene && speedDatingScene.toggleMinimize) {
                    speedDatingScene.toggleMinimize();
                }
            });
            
            const restoreButtonText = this.add.text(
                width * 0.93,
                height * 0.1,
                '↗',
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    fontFamily: 'Arial',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);
            
            this.minimizedSpeedDatingIndicator.add([
                this.minimizedIndicatorBackground,
                this.minimizedIndicatorText,
                this.minimizedRestoreButton,
                restoreButtonText
            ]);
        }
        
        // Update indicator text with current state info
        if (this.minimizedIndicatorText) {
            let displayText = data.displayText || 'Speed Dating';
            
            if (data.showingResults) {
                displayText = 'Speed Dating Results\n(Click to view)';
            } else if (data.matchActive && data.currentRound && data.totalRounds) {
                displayText = `Speed Dating\nRound ${data.currentRound}/${data.totalRounds}`;
            }
            
            this.minimizedIndicatorText.setText(displayText);
        }
        
        // Show indicator
        this.minimizedSpeedDatingIndicator.setVisible(true);
        this.minimizedSpeedDatingIndicator.setAlpha(0);
        
        // Fade in animation
        this.tweens.add({
            targets: this.minimizedSpeedDatingIndicator,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
    }

    private hideMinimizedSpeedDatingIndicator() {
        if (this.minimizedSpeedDatingIndicator && this.minimizedSpeedDatingIndicator.visible) {
            // Fade out animation
            this.tweens.add({
                targets: this.minimizedSpeedDatingIndicator,
                alpha: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    if (this.minimizedSpeedDatingIndicator) {
                        this.minimizedSpeedDatingIndicator.setVisible(false);
                    }
                }
            });
        }
    }

    private startPeriodicUpdates() {
        console.log("🎮 [UI] Starting periodic updates");
        
        // Initialize dialogue manager
        this.dialogueManager = new DialogueManager(this);
        
        // Initialize chat manager with input blocking check
        this.chatManager = new ChatManager(this, () => this.isAnyInputActive());
        
        // Set the player character ID if we have the username stored
        if (this.playerUsername) {
            this.dialogueManager.setPlayerCharacterId(this.playerUsername);
            console.log("💬 [UI] DialogueManager initialized with stored username:", this.playerUsername);
        }
        
        // Listen for dialogue events from GameScene
        this.game.events.on('openDialogue', (npcId: string, npcName: string) => {
            console.log(`💬 [UI] Opening dialogue with NPC: ${npcName} (ID: ${npcId})`);
            this.dialogueManager?.openDialogue(npcId, npcName);
        });
        
        this.game.events.on('closeDialogue', () => {
            console.log(`💬 [UI] Closing dialogue`);
            this.dialogueManager?.closeDialogue();
        });
        
        // Listen for chat events from GameScene
        this.game.events.on('chatMessage', (messageData: any) => {
            console.log(`💬 [UI] Received chat message:`, messageData);
            this.chatManager?.addMessage(messageData);
        });
        
        this.game.events.on('chatHistory', (messages: any[]) => {
            console.log(`💬 [UI] Received chat history: ${messages.length} messages`);
            this.chatManager?.addMessages(messages);
        });
        
        // Listen for game state updates to update clock
        this.game.events.on('gameStateUpdate', (gameState: any) => {
            this.updateClockDisplay(gameState);
        });
        
        // Listen for real-time NPC data from GameScene
        this.game.events.on('npcDataUpdate', (npcData: Map<string, any>) => {
            this.realtimeNPCData = npcData;
            if (this.debugPanelVisible) {
                this.refreshNPCList();
            }
        });
        
        console.log("🎮 [UI] Periodic updates initialized");
    }

    private createGameTimeUI() {
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

        // Add debug panel toggle button
        const debugToggleButton = this.add.text(this.cameras.main.width - 250, 10, "Debug Panel", {
            fontSize: "12px",
            color: "#FFFFFF",
            backgroundColor: "rgba(0, 0, 255, 0.7)",
            padding: { x: 6, y: 2 }
        }).setInteractive();

        debugToggleButton.on('pointerdown', () => {
            this.toggleDebugPanel();
        });

        // Add character panel toggle button
        const characterToggleButton = this.add.text(this.cameras.main.width - 120, 10, "Character", {
            fontSize: "12px",
            color: "#FFD700",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: { x: 6, y: 2 }
        }).setInteractive();

        characterToggleButton.on('pointerdown', () => {
            this.toggleSkillsPanel();
        });

        // Hover effects for character button
        characterToggleButton.on('pointerover', () => {
            characterToggleButton.setBackgroundColor('rgba(255, 215, 0, 0.3)');
        });

        characterToggleButton.on('pointerout', () => {
            characterToggleButton.setBackgroundColor('rgba(0, 0, 0, 0.7)');
        });
    }

    private createPlayerTextInterface() {
        // Create container for player text interface
        this.playerTextContainer = this.add.container(0, 0);
        
        // Create speech input interface (bottom left)
        const speechY = this.cameras.main.height - 100;
        
        // Speech input box
        this.speechInputBox = this.add.rectangle(150, speechY, 280, 35, 0x000000, 0.8)
            .setOrigin(0, 0.5);
        
        // Speech input text
        this.speechInputText = this.add.text(160, speechY, '', {
            fontSize: "14px",
            color: "#FFFFFF",
            wordWrap: { width: 260 }
        }).setOrigin(0, 0.5);
        
        // Speech prompt
        this.speechPrompt = this.add.text(10, speechY, "Say Out Loud (T):", {
            fontSize: "12px",
            color: "#FFFF00",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: { x: 4, y: 2 }
        }).setOrigin(0, 0.5);
        
        // Activity input interface (bottom right)
        const activityY = this.cameras.main.height - 60;
        
        // Activity input box
        this.activityInputBox = this.add.rectangle(150, activityY, 280, 35, 0x000000, 0.8)
            .setOrigin(0, 0.5);
        
        // Activity input text
        this.activityInputText = this.add.text(160, activityY, '', {
            fontSize: "14px",
            color: "#FFFFFF",
            wordWrap: { width: 260 }
        }).setOrigin(0, 0.5);
        
        // Activity prompt
        this.activityPrompt = this.add.text(10, activityY, "Update Activity (Y):", {
            fontSize: "12px",
            color: "#00FF00",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: { x: 4, y: 2 }
        }).setOrigin(0, 0.5);
        
        // Range indicator
        this.rangeIndicator = this.add.text(450, speechY - 20, "NPCs within 10 tiles can hear you", {
            fontSize: "11px",
            color: "#FFFF99",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: { x: 4, y: 2 }
        }).setOrigin(0, 0.5);
        
        // Add all elements to container
        this.playerTextContainer.add([
            this.speechInputBox,
            this.speechInputText,
            this.speechPrompt,
            this.activityInputBox,
            this.activityInputText,
            this.activityPrompt,
            this.rangeIndicator
        ]);
        
        // Initially hide the input boxes
        this.speechInputBox.setVisible(false);
        this.speechInputText.setVisible(false);
        this.activityInputBox.setVisible(false);
        this.activityInputText.setVisible(false);
        
        // Setup keyboard handlers
        this.setupPlayerTextInputHandlers();
        
        console.log("🎮 [UI] Player text interface created - Press T to say something, Y to update activity");
    }

    private setupPlayerTextInputHandlers() {
        // T key to activate speech input
        this.input.keyboard?.addKey('T').on('down', () => {
            // Check if speed dating scene is active
            const speedDatingScene = this.scene.get('SpeedDatingScene');
            if (speedDatingScene && this.scene.isActive('SpeedDatingScene')) {
                console.log("🚫 [UI] Speech input blocked during speed dating");
                return;
            }
            
            if (!this.speechInputActive && !this.activityInputActive && !this.dialogueManager?.isDialogueActive() && !this.isTypingInHtmlInput()) {
                this.activateSpeechInput();
            }
        });
        
        // Y key to activate activity input
        this.input.keyboard?.addKey('Y').on('down', () => {
            // Check if speed dating scene is active
            const speedDatingScene = this.scene.get('SpeedDatingScene');
            if (speedDatingScene && this.scene.isActive('SpeedDatingScene')) {
                console.log("🚫 [UI] Activity input blocked during speed dating");
                return;
            }
            
            if (!this.speechInputActive && !this.activityInputActive && !this.dialogueManager?.isDialogueActive() && !this.isTypingInHtmlInput()) {
                this.activateActivityInput();
            }
        });
        
        // Handle typing for both inputs
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (this.speechInputActive || this.activityInputActive) {
                this.handleTextInput(event);
            }
        });
    }

    private activateSpeechInput() {
        this.speechInputActive = true;
        this.currentSpeechMessage = '';
        
        if (this.speechInputBox && this.speechInputText) {
            this.speechInputBox.setVisible(true);
            this.speechInputText.setVisible(true);
            this.speechInputText.setText('');
        }
        
        // Block player movement while typing
        this.game.events.emit('blockMovement', true);
        
        console.log("🗣️ [UI] Speech input activated - Type your message and press Enter");
    }

    private activateActivityInput() {
        this.activityInputActive = true;
        this.currentActivityMessage = '';
        
        if (this.activityInputBox && this.activityInputText) {
            this.activityInputBox.setVisible(true);
            this.activityInputText.setVisible(true);
            this.activityInputText.setText('');
        }
        
        // Block player movement while typing
        this.game.events.emit('blockMovement', true);
        
        console.log("🎯 [UI] Activity input activated - Type your activity and press Enter");
    }

    private handleTextInput(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            if (this.speechInputActive) {
                this.submitSpeechMessage();
            } else if (this.activityInputActive) {
                this.submitActivityMessage();
            }
            return;
        }
        
        if (event.key === 'Escape') {
            this.cancelTextInput();
            return;
        }
        
        // Handle backspace
        if (event.key === 'Backspace') {
            if (this.speechInputActive) {
                this.currentSpeechMessage = this.currentSpeechMessage.slice(0, -1);
                this.speechInputText?.setText(this.currentSpeechMessage);
            } else if (this.activityInputActive) {
                this.currentActivityMessage = this.currentActivityMessage.slice(0, -1);
                this.activityInputText?.setText(this.currentActivityMessage);
            }
            return;
        }
        
        // Add character to current message
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            if (this.speechInputActive) {
                this.currentSpeechMessage += event.key;
                this.speechInputText?.setText(this.currentSpeechMessage);
            } else if (this.activityInputActive) {
                this.currentActivityMessage += event.key;
                this.activityInputText?.setText(this.currentActivityMessage);
            }
        }
    }

    private submitSpeechMessage() {
        if (!this.currentSpeechMessage.trim()) {
            this.cancelTextInput();
            return;
        }
        
        console.log(`🗣️ [UI] Player says: "${this.currentSpeechMessage}"`);
        
        // Send to game server
        this.game.events.emit('playerSpeech', {
            message: this.currentSpeechMessage,
            type: 'public_speech'
        });
        
        // Unblock movement and clear input
        this.game.events.emit('blockMovement', false);
        this.cancelTextInput();
    }

    private submitActivityMessage() {
        if (!this.currentActivityMessage.trim()) {
            this.cancelTextInput();
            return;
        }
        
        console.log(`🎯 [UI] Player activity: "${this.currentActivityMessage}"`);
        
        // Send to game server
        this.game.events.emit('playerActivity', {
            message: this.currentActivityMessage,
            type: 'activity_update'
        });
        
        // Unblock movement and clear input
        this.game.events.emit('blockMovement', false);
        this.cancelTextInput();
    }

    private cancelTextInput() {
        this.speechInputActive = false;
        this.activityInputActive = false;
        this.currentSpeechMessage = '';
        this.currentActivityMessage = '';
        
        if (this.speechInputBox && this.speechInputText) {
            this.speechInputBox.setVisible(false);
            this.speechInputText.setVisible(false);
        }
        
        if (this.activityInputBox && this.activityInputText) {
            this.activityInputBox.setVisible(false);
            this.activityInputText.setVisible(false);
        }
        
        // Unblock player movement
        this.game.events.emit('blockMovement', false);
        
        console.log("🎮 [UI] Text input cancelled");
    }

    /**
     * Check if user is currently typing in an HTML input field
     * This prevents hotkeys from activating while typing in textboxes
     */
    private isTypingInHtmlInput(): boolean {
        const activeElement = document.activeElement;
        
        if (!activeElement) {
            return false;
        }
        
        // Check if typing in input fields
        if (activeElement.tagName === 'INPUT') {
            const inputType = (activeElement as HTMLInputElement).type;
            // Allow hotkeys for buttons, checkboxes, etc., but not text inputs
            return inputType === 'text' || inputType === 'password' || inputType === 'email' || 
                   inputType === 'search' || inputType === 'url' || inputType === 'tel' || 
                   inputType === 'number' || inputType === 'textarea';
        }
        
        // Check if typing in textarea
        if (activeElement.tagName === 'TEXTAREA') {
            return true;
        }
        
        // Check if typing in contenteditable element
        if (activeElement.getAttribute('contenteditable') === 'true') {
            return true;
        }
        
        // Check if element has role="textbox"
        if (activeElement.getAttribute('role') === 'textbox') {
            return true;
        }
        
        return false;
    }

    private updateClockDisplay(gameState: any) {
        if (this.clockText) {
            this.clockText.setText(`Day ${gameState.gameDay} - ${gameState.currentGameTime}`);
        }
        
        if (this.speedText) {
            this.speedText.setText(`Speed: ${gameState.speedMultiplier}x`);
        }
    }

    getDialogueManager(): DialogueManager | null {
        return this.dialogueManager;
    }

    /**
     * Check if any input field is currently active (blocks chat toggle)
     */
    private isAnyInputActive(): boolean {
        // Check if speech or activity input is active
        if (this.speechInputActive) {
            console.log('💬 [UI] Input blocked: speech input active');
            return true;
        }
        
        if (this.activityInputActive) {
            console.log('💬 [UI] Input blocked: activity input active');
            return true;
        }

        // Check if dialogue with NPC is active
        if (this.dialogueManager?.isDialogueActive()) {
            console.log('💬 [UI] Input blocked: dialogue active');
            return true;
        }

        // Check if speed dating scene has active input
        const speedDatingScene = this.scene.get('SpeedDatingScene') as any;
        if (speedDatingScene && this.scene.isActive('SpeedDatingScene')) {
            // Check if speed dating input is specifically active
            if (speedDatingScene.inputActive) {
                console.log('💬 [UI] Input blocked: speed dating input active');
                return true;
            }
        }

        // Check if typing in HTML input
        if (this.isTypingInHtmlInput()) {
            console.log('💬 [UI] Input blocked: HTML input active');
            return true;
        }

        return false;
    }

    private loadLocationsData() {
        // Load locations data from cache (should be loaded in PreloaderScene)
        this.locationsData = this.cache.json.get('beacon_bay_locations');
        if (!this.locationsData) {
            console.error('❌ [UI] Failed to load beacon_bay_locations.json');
        } else {
            console.log('✅ [UI] Loaded locations data for coordinate mapping');
        }
    }

    private mapCoordinatesToLocation(x: number, y: number): string {
        if (!this.locationsData) {
            return `(${x}, ${y})`;
        }

        // Find the location that contains these coordinates
        for (const [locationKey, locationData] of Object.entries(this.locationsData)) {
            if (locationKey === 'water_areas') continue;
            
            const location = locationData as any;
            if (location.x !== undefined && location.y !== undefined && 
                location.width !== undefined && location.height !== undefined) {
                
                // Check if coordinates are within this location's bounds
                if (x >= location.x && x <= location.x + location.width &&
                    y >= location.y && y <= location.y + location.height) {
                    return location.name || locationKey;
                }
            }
        }

        // If no exact location found, find the closest one
        let closestLocation = null;
        let closestDistance = Infinity;

        for (const [locationKey, locationData] of Object.entries(this.locationsData)) {
            if (locationKey === 'water_areas') continue;
            
            const location = locationData as any;
            if (location.x !== undefined && location.y !== undefined) {
                const centerX = location.x + (location.width || 0) / 2;
                const centerY = location.y + (location.height || 0) / 2;
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                
                if (distance < closestDistance && distance < 20) { // Within 20 tiles
                    closestDistance = distance;
                    closestLocation = location.name || locationKey;
                }
            }
        }

        return closestLocation || `(${x}, ${y})`;
    }

    private createDebugPanel() {
        // Create debug panel container (extends to bottom of screen)
        this.debugPanel = this.add.container(this.cameras.main.width - 450, 60);
        
        // Background (extends to bottom of screen)
        const debugPanelHeight = this.cameras.main.height - 60; // From top bar to bottom
        this.debugPanelBackground = this.add.rectangle(0, 0, 440, debugPanelHeight, 0x000000, 0.8);
        this.debugPanelBackground.setOrigin(0, 0);
        this.debugPanelBackground.setStrokeStyle(2, 0x444444);
        
        // Title
        this.debugPanelTitle = this.add.text(10, 10, "Debug Panel - Character Status (Full Height)", {
            fontSize: "16px",
            color: "#FFFFFF",
            fontStyle: "bold"
        });
        
        // Content container
        this.debugPanelContent = this.add.container(0, 40);
        
        // Add components to debug panel
        this.debugPanel.add([this.debugPanelBackground, this.debugPanelTitle, this.debugPanelContent]);
        
        // Initially hide the panel
        this.debugPanel.setVisible(false);
    }

    private toggleDebugPanel() {
        this.debugPanelVisible = !this.debugPanelVisible;
        if (this.debugPanel) {
            this.debugPanel.setVisible(this.debugPanelVisible);
        }
        
        if (this.debugPanelVisible) {
            this.refreshNPCList();
            // No need for auto-refresh timer since we get updates from GameScene
        } else {
            // Clean up any existing timer
            this.stopAutoRefresh();
        }
    }

    private startAutoRefresh() {
        // No longer needed - we get updates from GameScene when data changes
        // Keep method for backward compatibility but make it do nothing
    }

    private stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            this.autoRefreshTimer.destroy();
            this.autoRefreshTimer = null;
        }
    }

    private refreshNPCList() {
        if (!this.debugPanelContent) return;
        
        // Clear existing content
        this.debugPanelContent.removeAll(true);
        
        // Add header
        const headerText = this.add.text(10, 10, "Real-time Character Status:", {
            fontSize: "14px",
            color: "#CCCCCC",
            fontStyle: "bold"
        });
        this.debugPanelContent?.add(headerText);
        
        // Add data source indicator
        const dataSourceText = this.add.text(10, 30, "📡 Source: Game Server (Real-time)", {
            fontSize: "10px",
            color: "#00FF00"
        });
        this.debugPanelContent?.add(dataSourceText);
        
        // Add update method indicator
        const updateMethodText = this.add.text(10, 45, "🔄 Updates: Event-driven (when data changes)", {
            fontSize: "10px",
            color: "#888888"
        });
        this.debugPanelContent?.add(updateMethodText);
        
        // Add separator
        const separator = this.add.text(10, 60, "─".repeat(50), {
            fontSize: "10px",
            color: "#444444"
        });
        this.debugPanelContent?.add(separator);
        
        // Convert real-time NPC data to array for display
        const npcArray = Array.from(this.realtimeNPCData.values());
        
        // Add NPC status list
        npcArray.forEach((npc, index) => {
            const yPos = 80 + (index * 35); // More space for two lines
            
            // NPC name
            const npcNameText = this.add.text(10, yPos, `${npc.name}`, {
                fontSize: "12px",
                color: "#FFD700",
                fontStyle: "bold"
            });
            this.debugPanelContent?.add(npcNameText);
            
            // Location (map coordinates to building name)
            const locationName = this.mapCoordinatesToLocation(npc.x, npc.y);
            const locationText = this.add.text(10, yPos + 12, `📍 ${locationName}`, {
                fontSize: "10px",
                color: "#87CEEB"
            });
            this.debugPanelContent?.add(locationText);
            
            // Activity
            const activityText = this.add.text(10, yPos + 22, `⚡ ${npc.currentActivity || 'idle'}`, {
                fontSize: "10px",
                color: "#90EE90",
                wordWrap: { width: 400, useAdvancedWrap: true }
            });
            this.debugPanelContent?.add(activityText);
        });
        
        // Add footer with total count
        const footerY = 80 + (npcArray.length * 35) + 10;
        const footerText = this.add.text(10, footerY, `Total Characters: ${npcArray.length}`, {
            fontSize: "10px",
            color: "#CCCCCC"
        });
        this.debugPanelContent?.add(footerText);
    }

    private async generatePlanForNPC(npcId: string, npcName: string) {
        try {
            console.log(`📋 [UI] Generating plan for ${npcName}...`);
            
            const config = AppConfig.getInstance();
            const response = await fetch(config.getApiUrl('npc/generate-plan'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    npcId: npcId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ [UI] Plan generation triggered for ${npcName}:`, data.message);
                
                // Show success message in the debug panel
                this.showDebugMessage(`Plan generated for ${npcName}!`, 0x00FF00);
            } else {
                console.error(`❌ [UI] Failed to generate plan for ${npcName}`);
                this.showDebugMessage(`Failed to generate plan for ${npcName}`, 0xFF0000);
            }
        } catch (error) {
            console.error(`❌ [UI] Error generating plan for ${npcName}:`, error);
            this.showDebugMessage(`Error generating plan for ${npcName}`, 0xFF0000);
        }
    }

    private debugTimeSystem() {
        console.log(`🕐 [UI] Requesting time debug info from server...`);
        
        // Send debug_time message to the game server
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene && gameScene.room) {
            gameScene.room.send('debug_time', {
                timestamp: Date.now()
            });
            
            console.log(`✅ [UI] Debug time request sent to server`);
            this.showDebugMessage(`Time debug requested - check server logs`, 0x0000FF);
        } else {
            console.error(`❌ [UI] Game room not available for debug time request`);
            this.showDebugMessage(`Error: Game room not available`, 0xFF0000);
        }
    }

    private showDebugMessage(message: string, color: number) {
        if (!this.debugPanelContent) return;
        
        const messageText = this.add.text(10, 350, message, {
            fontSize: "11px",
            color: `#${color.toString(16).padStart(6, '0')}`,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: { x: 4, y: 2 }
        });
        
        this.debugPanelContent.add(messageText);
        
        // Remove message after 3 seconds
        this.time.delayedCall(3000, () => {
            if (messageText) {
                messageText.destroy();
            }
        });
    }
}