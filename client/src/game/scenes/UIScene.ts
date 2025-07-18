// client/src/scenes/UIScene.ts
import { Scene } from "phaser";
import { DialogueManager } from "../ui/DialogueManager";

export class UIScene extends Scene {
    private dialogueManager: DialogueManager | null = null;
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
            '60',
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

    private setupEventListeners() {
        // Listen for speed dating countdown events
        this.game.events.on('speed_dating_countdown', (data: any) => {
            console.log('💕 [UI] Speed dating countdown started:', data);
            this.startSpeedDatingCountdown(data.countdownSeconds || 60);
        });
        
        // Listen for speed dating start (hide countdown)
        this.game.events.on('speed_dating_start', (data: any) => {
            console.log('💕 [UI] Speed dating started, hiding countdown');
            this.hideSpeedDatingCountdown();
        });
        
        // Existing event listeners...
        this.game.events.on('playerIdSet', (playerId: string) => {
            console.log("🎮 [UI] Player ID set:", playerId);
            // Any player-specific UI setup can go here
        });
    }

    private startSpeedDatingCountdown(seconds: number) {
        console.log(`💕 [UI] Starting speed dating countdown: ${seconds} seconds`);
        
        // Show countdown UI
        this.speedDatingCountdown?.setVisible(true);
        this.countdownVisible = true;
        
        let timeLeft = seconds;
        
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

    private startPeriodicUpdates() {
        console.log("🎮 [UI] Starting periodic updates");
        
        // Initialize dialogue manager
        this.dialogueManager = new DialogueManager(this);
        
        // Listen for dialogue events from GameScene
        this.game.events.on('openDialogue', (npcId: string, npcName: string) => {
            console.log(`💬 [UI] Opening dialogue with NPC: ${npcName} (ID: ${npcId})`);
            this.dialogueManager?.openDialogue(npcId, npcName);
        });
        
        this.game.events.on('closeDialogue', () => {
            console.log(`💬 [UI] Closing dialogue`);
            this.dialogueManager?.closeDialogue();
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
        const debugToggleButton = this.add.text(this.cameras.main.width - 120, 10, "Debug Panel", {
            fontSize: "12px",
            color: "#FFFFFF",
            backgroundColor: "rgba(0, 0, 255, 0.7)",
            padding: { x: 6, y: 2 }
        }).setInteractive();

        debugToggleButton.on('pointerdown', () => {
            this.toggleDebugPanel();
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
            if (!this.speechInputActive && !this.activityInputActive && !this.dialogueManager?.isDialogueActive() && !this.isTypingInHtmlInput()) {
                this.activateSpeechInput();
            }
        });
        
        // Y key to activate activity input
        this.input.keyboard?.addKey('Y').on('down', () => {
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
            
            const response = await fetch('http://localhost:3000/npc/generate-plan', {
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