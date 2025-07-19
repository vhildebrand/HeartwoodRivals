import { Scene } from "phaser";

interface SpeedDatingMatch {
    id: number;
    playerId: string;
    npcId: string;
    npcName: string;
    duration: number;
    startTime?: number;
    status: 'pending' | 'active' | 'completed';
}

interface SpeedDatingEvent {
    id: string;
    eventName: string;
    status: 'countdown' | 'active' | 'completed';
    participants: string[];
    currentMatch?: SpeedDatingMatch;
}

interface VibeUpdate {
    eventId: number;
    matchId: number;
    playerId: string;
    vibeScore: number;
    vibeReason: string;
    cumulativeScore: number;
}

export class SpeedDatingScene extends Scene {
    // Scene state
    private currentEvent: SpeedDatingEvent | null = null;
    private currentMatch: SpeedDatingMatch | null = null;
    private vibeScore: number = 0;
    private matchTimer: number = 0;
    private conversationLog: string[] = [];
    
    // UI Elements (simplified dialogue-style)
    private dialogueContainer: Phaser.GameObjects.Container | null = null;
    private backgroundPanel: Phaser.GameObjects.Rectangle | null = null;
    private npcNameText: Phaser.GameObjects.Text | null = null;
    private chatHistory: Phaser.GameObjects.Text | null = null;
    private chatBackground: Phaser.GameObjects.Rectangle | null = null;
    private inputBox: Phaser.GameObjects.Rectangle | null = null;
    private inputText: Phaser.GameObjects.Text | null = null;
    private timerText: Phaser.GameObjects.Text | null = null;
    private vibeText: Phaser.GameObjects.Text | null = null;
    private instructionsText: Phaser.GameObjects.Text | null = null;
    
    // Input state
    private currentMessage: string = '';
    private inputActive: boolean = false;
    private sendingMessage: boolean = false;
    
    // Countdown UI
    private countdownContainer: Phaser.GameObjects.Container | null = null;
    private countdownText: Phaser.GameObjects.Text | null = null;
    
    // Results UI
    private resultsContainer: Phaser.GameObjects.Container | null = null;
    
    // Track if event listeners are already set up
    private eventListenersSetup: boolean = false;
    
    // Track processed messages to prevent duplicates
    private processedMessages: Set<string> = new Set();

    constructor() {
        super({ key: 'SpeedDatingScene' });
    }

    preload() {
        console.log('💕 [SPEED_DATING] Preloading assets...');
        // Assets will be loaded here if needed
    }

    create() {
        console.log('💕 [SPEED_DATING] Speed Dating Scene created');
        
        const { width, height } = this.cameras.main;
        
        // Create dialogue-style UI container
        this.dialogueContainer = this.add.container(0, 0);
        this.dialogueContainer.setDepth(1000);
        this.dialogueContainer.setVisible(false);

        // Background panel
        this.backgroundPanel = this.add.rectangle(
            width / 2, 
            height / 2, 
            width * 0.9, 
            height * 0.7, 
            0x000000, 
            0.9
        );
        this.backgroundPanel.setStrokeStyle(2, 0x444444);

        // NPC name and match info
        this.npcNameText = this.add.text(
            width / 2, 
            height * 0.2, 
            'Speed Dating', 
            {
                fontSize: '24px',
                color: '#e24a90',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        // Timer and vibe score
        this.timerText = this.add.text(
            width * 0.2, 
            height * 0.25, 
            'Time: 5:00', 
            {
                fontSize: '18px',
                color: '#ffffff',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        this.vibeText = this.add.text(
            width * 0.8, 
            height * 0.25, 
            'Vibe: 0', 
            {
                fontSize: '18px',
                color: '#4a90e2',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        // Chat history
        this.chatHistory = this.add.text(
            width / 2, 
            height * 0.3, // Move up for more room
            'Welcome to the Speed Dating Gauntlet!\nYour date will begin shortly...', 
            {
                fontSize: '16px', // Increased from 14px
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif', // Better font stack
                fontStyle: 'normal',
                wordWrap: { width: width * 0.85 }, // Increase wrap width
                align: 'left',
                lineSpacing: 8, // Increased line spacing
                padding: { x: 10, y: 10 }
            }
        ).setOrigin(0.5, 0);

        // Chat background for better readability
        this.chatBackground = this.add.rectangle(
            width / 2, 
            height * 0.55, // Center of chat area
            width * 0.87, 
            height * 0.45, 
            0x1a1a1a, 
            0.8
        );
        this.chatBackground.setStrokeStyle(2, 0x444444);
        this.chatBackground.setDepth(1002);

        // Input box
        this.inputBox = this.add.rectangle(
            width / 2, 
            height * 0.78, // Move down slightly to give more room for chat
            width * 0.8, 
            50, 
            0x333333
        );
        this.inputBox.setStrokeStyle(2, 0x666666);

        // Input text
        this.inputText = this.add.text(
            width * 0.15, 
            height * 0.78, // Match input box position
            'Type your message...', 
            {
                fontSize: '16px',
                color: '#888888',
                fontFamily: 'Arial'
            }
        ).setOrigin(0, 0.5);

        // Instructions
        this.instructionsText = this.add.text(
            width / 2, 
            height * 0.88, // Move down accordingly
            'Press ENTER to send your message', 
            {
                fontSize: '12px',
                color: '#888888',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        // Add all elements to container
        this.dialogueContainer.add([
            this.backgroundPanel,
            this.chatBackground, // Add chat background first
            this.npcNameText,
            this.timerText,
            this.vibeText,
            this.chatHistory,
            this.inputBox,
            this.inputText,
            this.instructionsText
        ]);

        // Create countdown UI
        this.createCountdownUI();
        
        // Create results UI
        this.createResultsUI();
        
        // Set up input handling
        this.setupInputHandlers();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Handle scene lifecycle events
        this.events.on('shutdown', () => {
            console.log('💕 [SPEED_DATING] Scene shutting down');
            this.cleanupEventListeners();
        });
        
        this.events.on('sleep', () => {
            console.log('💕 [SPEED_DATING] Scene going to sleep');
            this.cleanupEventListeners();
        });
        
        console.log('💕 [SPEED_DATING] Scene initialization complete');
    }

    private createCountdownUI() {
        const { width, height } = this.cameras.main;
        
        this.countdownContainer = this.add.container(0, 0);
        this.countdownContainer.setDepth(1100);
        this.countdownContainer.setVisible(false);

        const countdownBg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        
        const eventTitle = this.add.text(
            width / 2, 
            height / 2 - 100, 
            '💕 SPEED DATING GAUNTLET 💕', 
            {
                fontSize: '36px',
                color: '#e24a90',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.countdownText = this.add.text(
            width / 2, 
            height / 2, 
            '', // Start with empty text, will be set by server data
            {
                fontSize: '72px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        const instructions = this.add.text(
            width / 2, 
            height / 2 + 100, 
            'Get ready to charm the NPCs!\nYour romantic skills will be tested.', 
            {
                fontSize: '18px',
                color: '#ffffff',
                fontFamily: 'Arial',
                align: 'center'
            }
        ).setOrigin(0.5);

        this.countdownContainer.add([countdownBg, eventTitle, this.countdownText, instructions]);
    }

    private createResultsUI() {
        const { width, height } = this.cameras.main;
        
        this.resultsContainer = this.add.container(0, 0);
        this.resultsContainer.setDepth(1100);
        this.resultsContainer.setVisible(false);

        const resultsBg = this.add.rectangle(width / 2, height / 2, width * 0.9, height * 0.8, 0x000000, 0.9);
        resultsBg.setStrokeStyle(2, 0x444444);

        const resultsTitle = this.add.text(
            width / 2, 
            height * 0.2, 
            'GAUNTLET RESULTS', 
            {
                fontSize: '36px',
                color: '#e24a90',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        const backButton = this.add.rectangle(width / 2, height * 0.9, 200, 50, 0x4a90e2);
        backButton.setStrokeStyle(2, 0x6666ff);
        backButton.setInteractive({ useHandCursor: true });
        backButton.on('pointerdown', () => this.returnToGame());

        const backButtonText = this.add.text(
            width / 2, 
            height * 0.9, 
            'BACK TO GAME', 
            {
                fontSize: '18px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.resultsContainer.add([resultsBg, resultsTitle, backButton, backButtonText]);
    }

    private setupInputHandlers() {
        // Keyboard input
        this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            if (!this.inputActive) return;
            
            if (event.key === 'Enter') {
                this.sendMessage();
            } else if (event.key === 'Backspace') {
                this.currentMessage = this.currentMessage.slice(0, -1);
                this.updateInputDisplay();
            } else if (event.key.length === 1) {
                this.currentMessage += event.key;
                this.updateInputDisplay();
            }
        });

        // Make input box interactive
        this.inputBox?.setInteractive({ useHandCursor: true });
        this.inputBox?.on('pointerdown', () => {
            this.inputActive = true;
            this.updateInputDisplay();
        });
    }

    private updateInputDisplay() {
        if (this.inputText) {
            if (this.currentMessage.length > 0) {
                this.inputText.setText(this.currentMessage + '|');
                this.inputText.setColor('#ffffff');
            } else if (this.inputActive) {
                this.inputText.setText('|');
                this.inputText.setColor('#ffffff');
            } else {
                this.inputText.setText('Type your message...');
                this.inputText.setColor('#888888');
            }
        }
    }

    private setupEventListeners() {
        // Prevent duplicate event listeners
        if (this.eventListenersSetup) {
            console.log('💕 [SPEED_DATING] Event listeners already set up, cleaning up first');
            this.cleanupEventListeners();
        }
        
        console.log('💕 [SPEED_DATING] Setting up event listeners');
        
        // Log current listener count before adding new ones
        const eventNames = ['speed_dating_countdown', 'speed_dating_start', 'speed_dating_match_start', 
                           'speed_dating_vibe_update', 'speed_dating_match_end', 'speed_dating_complete', 
                           'speed_dating_npc_response'];
        
        eventNames.forEach(eventName => {
            const count = this.game.events.listenerCount(eventName);
            if (count > 0) {
                console.warn(`⚠️ [SPEED_DATING] Event '${eventName}' already has ${count} listeners`);
            }
        });
        
        // Game event listeners
        this.game.events.on('speed_dating_countdown', (data: any) => {
            console.log('💕 [SPEED_DATING] Countdown update:', data);
            this.handleCountdownUpdate(data);
        });
        
        this.game.events.on('speed_dating_start', (data: any) => {
            console.log('💕 [SPEED_DATING] Gauntlet started:', data);
            this.handleGauntletStart(data);
        });
        
        this.game.events.on('speed_dating_match_start', (data: any) => {
            console.log('💕 [SPEED_DATING] Match started:', data);
            this.handleMatchStart(data);
        });
        
        this.game.events.on('speed_dating_vibe_update', (data: VibeUpdate) => {
            console.log('💕 [SPEED_DATING] Vibe update:', data);
            this.handleVibeUpdate(data);
        });
        
        this.game.events.on('speed_dating_match_end', (data: any) => {
            console.log('💕 [SPEED_DATING] Match ended:', data);
            this.handleMatchEnd(data);
        });
        
        this.game.events.on('speed_dating_complete', (data: any) => {
            console.log('💕 [SPEED_DATING] Gauntlet complete:', data);
            this.handleGauntletComplete(data);
        });
        
        this.game.events.on('speed_dating_npc_response', (data: any) => {
            const listenerId = Math.random().toString(36).substring(7);
            console.log(`💕 [SPEED_DATING] NPC response received by listener ${listenerId}:`, data);
            
            // Validate data
            if (!data || !data.message) {
                console.error('❌ [SPEED_DATING] Invalid NPC response data:', data);
                return;
            }
            
            // Create a unique key for this message
            const messageKey = `${data.matchId}-${data.timestamp || Date.now()}-${data.message}`;
            
            // Check if we've already processed this message
            if (this.processedMessages.has(messageKey)) {
                console.log('⚠️ [SPEED_DATING] Duplicate NPC response detected, ignoring');
                return;
            }
            
            // Mark this message as processed
            this.processedMessages.add(messageKey);
            
            const npcDisplayName = this.getNPCDisplayName(data.npcId || data.npcName);
            this.addToConversationLog(`${npcDisplayName}: ${data.message}`);
        });
        
        this.eventListenersSetup = true;
    }
    
    private cleanupEventListeners() {
        console.log('💕 [SPEED_DATING] Cleaning up event listeners');
        
        // Remove only speed dating event listeners
        this.game.events.off('speed_dating_countdown');
        this.game.events.off('speed_dating_start');
        this.game.events.off('speed_dating_match_start');
        this.game.events.off('speed_dating_vibe_update');
        this.game.events.off('speed_dating_match_end');
        this.game.events.off('speed_dating_complete');
        this.game.events.off('speed_dating_npc_response');
        
        this.eventListenersSetup = false;
    }

    // Event handlers
    private handleCountdownUpdate(data: any) {
        console.log('💕 [SPEED_DATING] Countdown update received:', JSON.stringify(data));
        
        // Handle both initial countdown and countdown updates
        if (data.countdownSeconds !== undefined) {
            // Initial countdown start
            console.log(`💕 [SPEED_DATING] Initial countdown: ${data.countdownSeconds} seconds`);
            this.scene.setVisible(true);
            this.scene.bringToTop();
            this.showCountdown(data.countdownSeconds);
        } else if (data.remainingSeconds !== undefined) {
            // Countdown update
            console.log(`💕 [SPEED_DATING] Countdown update: ${data.remainingSeconds} seconds remaining`);
            this.updateCountdown(data.remainingSeconds);
        }
    }
    
    private updateCountdown(seconds: number) {
        if (this.countdownText) {
            this.countdownText.setText(seconds.toString());
            
            // Color changes based on remaining time
            if (seconds <= 10) {
                this.countdownText.setColor('#ff4444');
            } else if (seconds <= 30) {
                this.countdownText.setColor('#ffaa00');
            } else {
                this.countdownText.setColor('#ffffff');
            }
            
            // Hide countdown when it reaches 0
            if (seconds <= 0) {
                this.hideCountdown();
            }
        }
        
        console.log(`💕 [SPEED_DATING] Countdown update: ${seconds} seconds`);
    }

    private handleGauntletStart(data: any) {
        this.currentEvent = data;
        this.hideCountdown();
        this.showDialogue();
    }

    private handleMatchStart(data: any) {
        this.currentMatch = data;
        this.matchTimer = data.duration;
        this.inputActive = true;
        
        console.log(`💕 [SPEED_DATING] Match timer set to ${this.matchTimer} seconds (${Math.floor(this.matchTimer / 60)}:${(this.matchTimer % 60).toString().padStart(2, '0')})`);
        
        // Clear processed messages for new match
        this.processedMessages.clear();
        
        // Reset sending flag
        this.sendingMessage = false;
        
        // Update UI with proper NPC name
        if (this.npcNameText) {
            const npcName = this.getNPCDisplayName(data.npcId);
            this.npcNameText.setText(`💕 Dating: ${npcName}`);
        }
        
        // Show the dialogue interface
        this.showDialogue();
        
        // Clear previous conversation
        this.conversationLog = [];
        this.addToConversationLog(`💕 Starting your date with ${this.getNPCDisplayName(data.npcId)}!`);
        this.addToConversationLog(`⏱️ You have ${Math.floor(data.duration / 60)} minutes to impress them.`);
        this.addToConversationLog(`💬 Type your messages and press ENTER to send.`);
        
        // Reset vibe score
        this.vibeScore = 0;
        if (this.vibeText) {
            this.vibeText.setText('Vibe: 0');
            this.vibeText.setColor('#ffffff');
        }
        
        // Start timer countdown with real-time updates
        this.startMatchTimer();
        
        console.log(`💕 [SPEED_DATING] Match started with ${data.npcId} for ${data.duration} seconds`);
    }

    private getNPCDisplayName(npcId: string): string {
        const npcNames: { [key: string]: string } = {
            'amelia_librarian': 'Amelia (Librarian)',
            'captain_finn': 'Captain Finn',
            'captain_rodriguez': 'Captain Rodriguez',
            'coach_jason': 'Coach Jason',
            'dj_nova': 'DJ Nova',
            'dr_helena': 'Dr. Helena',
            'elara_blacksmith': 'Elara (Blacksmith)',
            'father_michael': 'Father Michael',
            'isabella_baker': 'Isabella (Baker)',
            'judge_patricia_wells': 'Judge Patricia Wells',
            'luna_tailor': 'Luna (Tailor)',
            'marcus_merchant': 'Marcus (Merchant)',
            'maya_teacher': 'Maya (Teacher)',
            'mayor_henderson': 'Mayor Henderson',
            'melody_sinclair': 'Melody Sinclair',
            'officer_blake': 'Officer Blake',
            'oliver_lighthouse_keeper': 'Oliver (Lighthouse Keeper)',
            'professor_cornelius': 'Professor Cornelius',
            'sarah_farmer': 'Sarah (Farmer)',
            'sophia_apothecary': 'Sophia (Apothecary)',
            'sterling_blackwood': 'Sterling Blackwood',
            'thomas_tavern_keeper': 'Thomas (Tavern Keeper)',
            'victor_woodworker': 'Victor (Woodworker)',
            'william_shipwright': 'William (Shipwright)'
        };
        return npcNames[npcId] || npcId;
    }

    private handleVibeUpdate(data: VibeUpdate) {
        console.log('💕 [SPEED_DATING] Vibe update received:', JSON.stringify(data));
        
        // Validate data
        if (data.vibeScore === undefined || data.cumulativeScore === undefined) {
            console.error('❌ [SPEED_DATING] Invalid vibe update data:', data);
            return;
        }
        
        // Update cumulative score
        this.vibeScore = data.cumulativeScore;
        
        // Update UI with cumulative score
        if (this.vibeText) {
            const color = data.cumulativeScore > 0 ? '#4a90e2' : data.cumulativeScore < 0 ? '#ff4444' : '#ffffff';
            this.vibeText.setText(`Vibe: ${data.cumulativeScore}`);
            this.vibeText.setColor(color);
        }
        
        // Only show vibe feedback when there's an actual score change (non-zero)
        if (data.vibeScore !== 0) {
            const vibeSign = data.vibeScore > 0 ? '+' : '';
            const feedbackMessage = `💝 ${data.vibeReason || 'Vibe changed'} (${vibeSign}${data.vibeScore})`;
            this.addToConversationLog(feedbackMessage);
        }
    }

    private handleMatchEnd(data: any) {
        this.inputActive = false;
        
        // Clear the input
        this.currentMessage = '';
        this.updateInputDisplay();
        
        // Show transition message
        this.addToConversationLog(`⏰ Time's up with ${this.getNPCDisplayName(data.npcId)}!`);
        this.addToConversationLog(`💭 They're thinking about your conversation...`);
        this.addToConversationLog(`⏳ Preparing for your next date...`);
        
        // Reset for next match
        this.currentMatch = null;
        
        console.log(`💕 [SPEED_DATING] Match ended with ${data.npcId}`);
    }

    private handleGauntletComplete(data: any) {
        this.inputActive = false;
        this.hideDialogue();
        this.showResults(data);
    }

    // UI Display methods
    private showCountdown(seconds: number) {
        this.countdownContainer?.setVisible(true);
        
        // Set initial countdown value and let server updates handle the countdown
        if (this.countdownText) {
            this.countdownText.setText(seconds.toString());
            
            // Color changes based on initial value
            if (seconds <= 10) {
                this.countdownText.setColor('#ff4444');
            } else if (seconds <= 30) {
                this.countdownText.setColor('#ffaa00');
            } else {
                this.countdownText.setColor('#ffffff');
            }
        }
        
        // Don't create local timer - let server handle countdown updates
        console.log(`💕 [SPEED_DATING] Showing countdown: ${seconds} seconds`);
    }

    private hideCountdown() {
        this.countdownContainer?.setVisible(false);
    }

    private showDialogue() {
        this.dialogueContainer?.setVisible(true);
        this.addToConversationLog('💕 Welcome to the Speed Dating Gauntlet!');
        this.addToConversationLog('You will meet several NPCs in quick succession.');
        this.addToConversationLog('Try to make a good impression with each one!');
    }

    private hideDialogue() {
        this.dialogueContainer?.setVisible(false);
    }

    private startMatchTimer() {
        console.log(`⏱️ [SPEED_DATING] Starting match timer with ${this.matchTimer} seconds`);
        
        // Update initial timer display
        if (this.timerText) {
            const minutes = Math.floor(this.matchTimer / 60);
            const seconds = this.matchTimer % 60;
            this.timerText.setText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`);
            
            // Reset color
            this.timerText.setColor('#ffffff');
        }
        
        // Create real-time countdown timer for UI feedback
        const timerEvent = this.time.addEvent({
            delay: 1000, // Update every second
            repeat: this.matchTimer - 1,
            callback: () => {
                this.matchTimer--;
                console.log(`⏱️ [SPEED_DATING] Timer tick: ${this.matchTimer} seconds remaining`);
                
                if (this.timerText && this.matchTimer >= 0) {
                    const minutes = Math.floor(this.matchTimer / 60);
                    const seconds = this.matchTimer % 60;
                    this.timerText.setText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`);
                    
                    // Color changes based on remaining time
                    if (this.matchTimer <= 30) {
                        this.timerText.setColor('#ff4444');
                    } else if (this.matchTimer <= 60) {
                        this.timerText.setColor('#ffaa00');
                    }
                }
            },
            callbackScope: this
        });
        
        console.log(`💕 [SPEED_DATING] Match timer set to ${this.matchTimer} seconds with real-time countdown`);
    }

    private showResults(data: any) {
        this.resultsContainer?.setVisible(true);
        // TODO: Display actual results
        this.addToConversationLog('🎉 Gauntlet complete! Results will be displayed here.');
    }

    private addToConversationLog(message: string) {
        console.log(`💬 [SPEED_DATING] Adding to conversation: "${message}"`);
        this.conversationLog.push(message);
        
        // Keep last 20 messages (increased from 10)
        if (this.conversationLog.length > 20) {
            const removed = this.conversationLog.shift();
            console.log(`💬 [SPEED_DATING] Removed old message: "${removed}"`);
        }
        
        if (this.chatHistory) {
            // Join messages with proper spacing
            const displayText = this.conversationLog.join('\n\n');
            this.chatHistory.setText(displayText);
            console.log(`💬 [SPEED_DATING] Conversation log now has ${this.conversationLog.length} messages`);
        }
    }



    private sendMessage() {
        if (!this.currentMessage.trim() || !this.currentMatch || this.sendingMessage) {
            if (this.sendingMessage) {
                console.log('⚠️ [SPEED_DATING] Already sending a message, please wait');
            }
            return;
        }
        
        // Set sending flag
        this.sendingMessage = true;
        
        // Add to conversation log
        this.addToConversationLog(`You: ${this.currentMessage.trim()}`);
        
        // Send to game server
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene && gameScene.room) {
            gameScene.room.send('speed_dating_message', {
                matchId: this.currentMatch.id,
                message: this.currentMessage.trim()
            });
        }
        
        // Clear input
        this.currentMessage = '';
        this.updateInputDisplay();
        
        // Reset sending flag after a short delay
        setTimeout(() => {
            this.sendingMessage = false;
        }, 500);
    }

    private returnToGame() {
        this.scene.setVisible(false);
        this.scene.sendToBack();
        this.scene.resume('GameScene');
        this.scene.resume('UIScene');
    }

    destroy() {
        console.log('💕 [SPEED_DATING] Cleaning up scene');
        
        // Clean up event listeners
        this.cleanupEventListeners();
        
        super.destroy();
    }
}

export default SpeedDatingScene;