import { Scene } from "phaser";

interface SpeedDatingMatch {
    id: string;
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
    matchId: string;
    score: number;
    reason: string;
    keywords: string[];
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
    private inputBox: Phaser.GameObjects.Rectangle | null = null;
    private inputText: Phaser.GameObjects.Text | null = null;
    private timerText: Phaser.GameObjects.Text | null = null;
    private vibeText: Phaser.GameObjects.Text | null = null;
    private instructionsText: Phaser.GameObjects.Text | null = null;
    
    // Input state
    private currentMessage: string = '';
    private inputActive: boolean = false;
    
    // Countdown UI
    private countdownContainer: Phaser.GameObjects.Container | null = null;
    private countdownText: Phaser.GameObjects.Text | null = null;
    
    // Results UI
    private resultsContainer: Phaser.GameObjects.Container | null = null;

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
            height * 0.4, 
            'Welcome to the Speed Dating Gauntlet!\nYour date will begin shortly...', 
            {
                fontSize: '14px',
                color: '#ffffff',
                fontFamily: 'Arial',
                wordWrap: { width: width * 0.8 },
                align: 'left'
            }
        ).setOrigin(0.5, 0);

        // Input box
        this.inputBox = this.add.rectangle(
            width / 2, 
            height * 0.75, 
            width * 0.8, 
            50, 
            0x333333
        );
        this.inputBox.setStrokeStyle(2, 0x666666);

        // Input text
        this.inputText = this.add.text(
            width * 0.15, 
            height * 0.75, 
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
            height * 0.85, 
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
            '60', 
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
            console.log('💕 [SPEED_DATING] NPC response:', data);
            this.addToConversationLog(`${data.npcName}: ${data.message}`);
        });
    }

    // Event handlers
    private handleCountdownUpdate(data: any) {
        // Handle both initial countdown and countdown updates
        if (data.countdownSeconds !== undefined) {
            // Initial countdown start
            this.scene.setVisible(true);
            this.scene.bringToTop();
            this.showCountdown(data.countdownSeconds);
        } else if (data.remainingSeconds !== undefined) {
            // Countdown update
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
        this.vibeScore = data.score;
        if (this.vibeText) {
            const color = data.score > 0 ? '#4a90e2' : data.score < 0 ? '#ff4444' : '#ffffff';
            this.vibeText.setText(`Vibe: ${data.score}`);
            this.vibeText.setColor(color);
        }
        
        // Show vibe feedback
        this.addToConversationLog(`💝 ${data.reason} (${data.score > 0 ? '+' : ''}${data.score})`);
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
            }or
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
                if (this.timerText) {
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
            }
        });
        
        console.log(`💕 [SPEED_DATING] Match timer set to ${this.matchTimer} seconds with real-time countdown`);
    }

    private showResults(data: any) {
        this.resultsContainer?.setVisible(true);
        // TODO: Display actual results
        this.addToConversationLog('🎉 Gauntlet complete! Results will be displayed here.');
    }

    private addToConversationLog(message: string) {
        this.conversationLog.push(message);
        
        // Keep only last 10 messages
        if (this.conversationLog.length > 10) {
            this.conversationLog.shift();
        }
        
        if (this.chatHistory) {
            this.chatHistory.setText(this.conversationLog.join('\n'));
        }
    }

    private sendMessage() {
        if (!this.currentMessage.trim() || !this.currentMatch) return;
        
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
    }

    private returnToGame() {
        this.scene.setVisible(false);
        this.scene.sendToBack();
        this.scene.resume('GameScene');
        this.scene.resume('UIScene');
    }

    destroy() {
        console.log('💕 [SPEED_DATING] Cleaning up scene');
        
        // Remove event listeners
        this.game.events.removeAllListeners();
        
        super.destroy();
    }
}

export default SpeedDatingScene; 