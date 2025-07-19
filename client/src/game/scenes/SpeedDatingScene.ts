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
    private chatMask: Phaser.GameObjects.Graphics | null = null;
    private chatContainer: Phaser.GameObjects.Container | null = null;
    private inputBox: Phaser.GameObjects.Rectangle | null = null;
    private inputText: Phaser.GameObjects.Text | null = null;
    private timerText: Phaser.GameObjects.Text | null = null;
    private vibeText: Phaser.GameObjects.Text | null = null;
    private instructionsText: Phaser.GameObjects.Text | null = null;
    private vibeBarBackground: Phaser.GameObjects.Rectangle | null = null;
    private vibeBarFill: Phaser.GameObjects.Rectangle | null = null;
    
    // Input state
    private currentMessage: string = '';
    private inputActive: boolean = false;
    private sendingMessage: boolean = false;
    
    // Countdown UI
    private countdownContainer: Phaser.GameObjects.Container | null = null;
    private countdownText: Phaser.GameObjects.Text | null = null;
    
    // Results UI
    private resultsContainer: Phaser.GameObjects.Container | null = null;
    private resultsData: any = null;
    private resultsPageIndex: number = 0;
    
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

        // Background panel with gradient effect
        this.backgroundPanel = this.add.rectangle(
            width / 2, 
            height / 2, 
            width * 0.9, 
            height * 0.8, 
            0x1a0d1a, 
            0.95
        );
        this.backgroundPanel.setStrokeStyle(3, 0xff69b4, 0.8);

        // Add a decorative header background
        const headerBg = this.add.rectangle(
            width / 2,
            height * 0.15,
            width * 0.9,
            80,
            0x2d1b2d,
            0.9
        );
        headerBg.setStrokeStyle(2, 0xff69b4, 0.5);

        // NPC name and match info with better styling
        this.npcNameText = this.add.text(
            width / 2, 
            height * 0.15, 
            '💕 Speed Dating Gauntlet 💕', 
            {
                fontSize: '28px',
                color: '#ff69b4',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold',
                stroke: '#2d1b2d',
                strokeThickness: 2,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);

        // Timer with icon
        const timerIcon = this.add.text(
            width * 0.15 - 20, 
            height * 0.22, 
            '⏰', 
            {
                fontSize: '20px',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        this.timerText = this.add.text(
            width * 0.22, 
            height * 0.22, 
            'Time: 5:00', 
            {
                fontSize: '20px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        // Vibe score with visual bar
        const vibeIcon = this.add.text(
            width * 0.7, 
            height * 0.22, 
            '💗', 
            {
                fontSize: '20px',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        this.vibeText = this.add.text(
            width * 0.78, 
            height * 0.22, 
            'Vibe: 0', 
            {
                fontSize: '20px',
                color: '#ff69b4',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        // Vibe bar background
        this.vibeBarBackground = this.add.rectangle(
            width / 2, 
            height * 0.27,
            width * 0.7,
            10,
            0x333333,
            0.8
        );
        this.vibeBarBackground.setStrokeStyle(1, 0x666666);

        // Vibe bar fill (starts in the middle)
        this.vibeBarFill = this.add.rectangle(
            width / 2,
            height * 0.27,
            0,
            8,
            0xff69b4,
            1
        );

        // Create chat container for scrolling
        this.chatContainer = this.add.container(width / 2, height * 0.3);
        
        // Chat background with better styling
        this.chatBackground = this.add.rectangle(
            0, 
            height * 0.25, // Relative to container
            width * 0.85, 
            height * 0.42,
            0x0d0d0d, 
            0.9
        );
        this.chatBackground.setStrokeStyle(2, 0x444444);
        
        // Create mask for chat area to enable scrolling effect
        this.chatMask = this.add.graphics();
        this.chatMask.fillStyle(0xffffff);
        this.chatMask.fillRect(
            width * 0.075,
            height * 0.31,
            width * 0.85,
            height * 0.42
        );

        // Chat history with better formatting
        this.chatHistory = this.add.text(
            0, 
            height * 0.05, // Start at top of chat container
            'Welcome to the Speed Dating Gauntlet!\nYour romantic journey begins soon...', 
            {
                fontSize: '17px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'normal',
                wordWrap: { width: width * 0.8 },
                align: 'left',
                lineSpacing: 10,
                padding: { x: 15, y: 15 }
            }
        ).setOrigin(0.5, 0);

        // Apply mask to chat history for scrolling
        this.chatHistory.setMask(this.chatMask.createGeometryMask());
        
        // Add chat elements to container
        this.chatContainer.add([this.chatBackground, this.chatHistory]);

        // Input box with better styling
        this.inputBox = this.add.rectangle(
            width / 2, 
            height * 0.8,
            width * 0.8, 
            55, 
            0x2d1b2d,
            0.9
        );
        this.inputBox.setStrokeStyle(2, 0xff69b4, 0.6);

        // Input text with placeholder
        this.inputText = this.add.text(
            width * 0.12, 
            height * 0.8,
            'Type your message...', 
            {
                fontSize: '18px',
                color: '#888888',
                fontFamily: '"Segoe UI", Arial, sans-serif'
            }
        ).setOrigin(0, 0.5);

        // Send button (visual only, Enter key sends)
        const sendButton = this.add.rectangle(
            width * 0.85,
            height * 0.8,
            80,
            40,
            0xff69b4,
            0.8
        );
        sendButton.setStrokeStyle(2, 0xffffff, 0.6);
        
        const sendText = this.add.text(
            width * 0.85,
            height * 0.8,
            'SEND',
            {
                fontSize: '16px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        // Instructions with better styling
        this.instructionsText = this.add.text(
            width / 2, 
            height * 0.9,
            'Press ENTER to send • Use arrow keys to scroll chat', 
            {
                fontSize: '14px',
                color: '#ff69b4',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'italic'
            }
        ).setOrigin(0.5);

        // Add all elements to container
        this.dialogueContainer.add([
            this.backgroundPanel,
            headerBg,
            this.npcNameText,
            timerIcon,
            this.timerText,
            vibeIcon,
            this.vibeText,
            this.vibeBarBackground,
            this.vibeBarFill,
            this.chatContainer,
            this.inputBox,
            this.inputText,
            sendButton,
            sendText,
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

        // Background with gradient
        const resultsBg = this.add.rectangle(width / 2, height / 2, width * 0.95, height * 0.9, 0x1a0d1a, 0.95);
        resultsBg.setStrokeStyle(3, 0xff69b4);

        // Title
        const resultsTitle = this.add.text(
            width / 2, 
            height * 0.08, 
            '💕 GAUNTLET RESULTS 💕', 
            {
                fontSize: '36px',
                color: '#ff69b4',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold',
                stroke: '#2d1b2d',
                strokeThickness: 2,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);

        // Subtitle
        const subtitle = this.add.text(
            width / 2,
            height * 0.13,
            'See how each NPC ranked their dates!',
            {
                fontSize: '18px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'italic'
            }
        ).setOrigin(0.5);

        // Navigation buttons
        const prevButton = this.add.rectangle(width * 0.1, height / 2, 60, 100, 0xff69b4, 0.8);
        prevButton.setStrokeStyle(2, 0xffffff);
        prevButton.setInteractive({ useHandCursor: true });
        prevButton.on('pointerdown', () => this.showPreviousResult());

        const prevArrow = this.add.text(
            width * 0.1,
            height / 2,
            '◀',
            {
                fontSize: '32px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        const nextButton = this.add.rectangle(width * 0.9, height / 2, 60, 100, 0xff69b4, 0.8);
        nextButton.setStrokeStyle(2, 0xffffff);
        nextButton.setInteractive({ useHandCursor: true });
        nextButton.on('pointerdown', () => this.showNextResult());

        const nextArrow = this.add.text(
            width * 0.9,
            height / 2,
            '▶',
            {
                fontSize: '32px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        // Back to game button
        const backButton = this.add.rectangle(width / 2, height * 0.92, 200, 50, 0x4a90e2, 0.9);
        backButton.setStrokeStyle(2, 0xffffff);
        backButton.setInteractive({ useHandCursor: true });
        backButton.on('pointerdown', () => this.returnToGame());

        const backButtonText = this.add.text(
            width / 2, 
            height * 0.92, 
            'RETURN TO GAME', 
            {
                fontSize: '18px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.resultsContainer.add([
            resultsBg, 
            resultsTitle, 
            subtitle,
            prevButton, 
            prevArrow,
            nextButton, 
            nextArrow,
            backButton, 
            backButtonText
        ]);
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
            } else if (event.key === 'ArrowUp') {
                // Scroll chat up
                this.scrollChat(-50);
            } else if (event.key === 'ArrowDown') {
                // Scroll chat down
                this.scrollChat(50);
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

        // Mouse wheel scrolling for chat
        this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any[], deltaX: number, deltaY: number, deltaZ: number) => {
            this.scrollChat(deltaY * 0.5);
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
        
        this.game.events.on('speed_dating_results', (data: any) => {
            console.log('💕 [SPEED_DATING] Gauntlet results received:', data);
            this.showResults(data);
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
        this.game.events.off('speed_dating_results');
        
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
        console.log('💕 [SPEED_DATING] handleMatchStart called with data:', data);
        
        // Store the full match data
        this.currentMatch = {
            id: data.matchId,
            playerId: data.playerId,
            npcId: data.npcId,
            npcName: data.npcName || data.npcId,
            duration: data.duration,
            status: 'active'
        };
        
        this.matchTimer = data.duration;
        this.inputActive = true;
        
        console.log(`💕 [SPEED_DATING] Current match set:`, this.currentMatch);
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
        
        // Reset vibe bar
        if (this.vibeBarFill) {
            this.vibeBarFill.width = 0;
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
            const color = data.cumulativeScore > 0 ? '#66ff66' : data.cumulativeScore < 0 ? '#ff6666' : '#ffffff';
            this.vibeText.setText(`Vibe: ${data.cumulativeScore > 0 ? '+' : ''}${data.cumulativeScore}`);
            this.vibeText.setColor(color);
        }
        
        // Update vibe bar
        if (this.vibeBarFill && this.vibeBarBackground) {
            const barWidth = this.vibeBarBackground.width;
            const fillWidth = Math.abs(data.cumulativeScore) / 100 * (barWidth / 2);
            const centerX = this.cameras.main.width / 2;
            
            this.vibeBarFill.width = fillWidth;
            
            if (data.cumulativeScore > 0) {
                this.vibeBarFill.x = centerX + fillWidth / 2;
                this.vibeBarFill.setFillStyle(0x66ff66);
            } else if (data.cumulativeScore < 0) {
                this.vibeBarFill.x = centerX - fillWidth / 2;
                this.vibeBarFill.setFillStyle(0xff6666);
            } else {
                this.vibeBarFill.width = 0;
            }
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
        
        // Request full results from the server
        this.requestGauntletResults();
    }

    private async requestGauntletResults() {
        try {
            // First, show loading message
            this.showResults({ loading: true });
            
            // Request results from web API via game server
            const gameScene = this.scene.get('GameScene') as any;
            if (gameScene && gameScene.room) {
                gameScene.room.send('request_gauntlet_results', {
                    eventId: this.currentEvent?.id
                });
            }
        } catch (error) {
            console.error('❌ [SPEED_DATING] Error requesting gauntlet results:', error);
            this.showResults({ error: true });
        }
    }

    private showResults(data: any) {
        this.resultsContainer?.setVisible(true);
        
        if (data.loading) {
            this.displayLoadingResults();
        } else if (data.error) {
            this.displayErrorResults();
        } else {
            this.resultsData = data;
            this.resultsPageIndex = 0;
            this.displayResultsPage();
        }
    }

    private displayLoadingResults() {
        const { width, height } = this.cameras.main;
        
        // Clear any existing result content
        this.clearResultContent();
        
        const loadingText = this.add.text(
            width / 2,
            height / 2,
            'Loading results...\n\nNPCs are sharing their thoughts...',
            {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                align: 'center',
                lineSpacing: 10
            }
        ).setOrigin(0.5);
        
        this.resultsContainer?.add(loadingText);
    }

    private displayErrorResults() {
        const { width, height } = this.cameras.main;
        
        // Clear any existing result content
        this.clearResultContent();
        
        const errorText = this.add.text(
            width / 2,
            height / 2,
            'Unable to load results.\n\nPlease try again later.',
            {
                fontSize: '24px',
                color: '#ff6666',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                align: 'center',
                lineSpacing: 10
            }
        ).setOrigin(0.5);
        
        this.resultsContainer?.add(errorText);
    }

    private displayResultsPage() {
        if (!this.resultsData || !this.resultsData.npcResults) return;
        
        const { width, height } = this.cameras.main;
        
        // Clear any existing result content
        this.clearResultContent();
        
        const npcResults = this.resultsData.npcResults;
        const currentNpc = npcResults[this.resultsPageIndex];
        
        if (!currentNpc) return;
        
        // NPC name and portrait area
        const npcNameBg = this.add.rectangle(
            width / 2,
            height * 0.22,
            width * 0.8,
            60,
            0x2d1b2d,
            0.9
        );
        npcNameBg.setStrokeStyle(2, 0xff69b4);
        
        const npcName = this.add.text(
            width / 2,
            height * 0.22,
            `${this.getNPCDisplayName(currentNpc.npcId)}'s Rankings`,
            {
                fontSize: '28px',
                color: '#ff69b4',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // Page indicator
        const pageText = this.add.text(
            width / 2,
            height * 0.27,
            `${this.resultsPageIndex + 1} / ${npcResults.length}`,
            {
                fontSize: '16px',
                color: '#888888',
                fontFamily: '"Segoe UI", Arial, sans-serif'
            }
        ).setOrigin(0.5);
        
        // Rankings display
        const rankingsContainer = this.add.container(width / 2, height * 0.35);
        
        currentNpc.rankings.forEach((ranking: any, index: number) => {
            const yOffset = index * 120;
            
            // Rank badge
            const rankBadge = this.add.circle(
                -width * 0.35,
                yOffset,
                30,
                this.getRankColor(ranking.finalRank),
                1
            );
            rankBadge.setStrokeStyle(3, 0xffffff);
            
            const rankText = this.add.text(
                -width * 0.35,
                yOffset,
                `#${ranking.finalRank}`,
                {
                    fontSize: '24px',
                    color: '#ffffff',
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);
            
            // Player info
            const playerText = this.add.text(
                -width * 0.25,
                yOffset - 15,
                `${ranking.playerId === this.currentMatch?.playerId ? 'You' : `Player ${ranking.playerId.substring(0, 8)}`}`,
                {
                    fontSize: '20px',
                    color: '#ffffff',
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                    fontStyle: 'bold'
                }
            ).setOrigin(0, 0.5);
            
            // Scores
            const scoresText = this.add.text(
                -width * 0.25,
                yOffset + 15,
                `Attraction: ${ranking.attractionLevel}/10 • Compatibility: ${ranking.compatibilityRating}/10`,
                {
                    fontSize: '16px',
                    color: '#aaaaaa',
                    fontFamily: '"Segoe UI", Arial, sans-serif'
                }
            ).setOrigin(0, 0.5);
            
            // Relationship potential badge
            const potentialBadge = this.add.rectangle(
                width * 0.2,
                yOffset,
                150,
                30,
                this.getPotentialColor(ranking.relationshipPotential),
                0.8
            );
            potentialBadge.setStrokeStyle(2, 0xffffff);
            
            const potentialText = this.add.text(
                width * 0.2,
                yOffset,
                this.getPotentialLabel(ranking.relationshipPotential),
                {
                    fontSize: '14px',
                    color: '#ffffff',
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);
            
            rankingsContainer.add([
                rankBadge, rankText, playerText, scoresText, potentialBadge, potentialText
            ]);
        });
        
        // Confessional quote
        const playerRanking = currentNpc.rankings.find((r: any) => r.playerId === this.currentMatch?.playerId);
        if (playerRanking) {
            const quoteBg = this.add.rectangle(
                width / 2,
                height * 0.75,
                width * 0.85,
                120,
                0x2d1b2d,
                0.8
            );
            quoteBg.setStrokeStyle(2, 0xff69b4, 0.5);
            
            const quoteText = this.add.text(
                width / 2,
                height * 0.75,
                `"${playerRanking.confessionalStatement}"`,
                {
                    fontSize: '18px',
                    color: '#ffccdd',
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                    fontStyle: 'italic',
                    wordWrap: { width: width * 0.75 },
                    align: 'center',
                    lineSpacing: 5
                }
            ).setOrigin(0.5);
            
            this.resultsContainer?.add([quoteBg, quoteText]);
        }
        
        this.resultsContainer?.add([
            npcNameBg, npcName, pageText, rankingsContainer
        ]);
    }

    private clearResultContent() {
        if (!this.resultsContainer) return;
        
        // Remove all children except the base UI elements (first 9 elements)
        const baseElementCount = 9;
        while (this.resultsContainer.length > baseElementCount) {
            const child = this.resultsContainer.getAt(baseElementCount);
            this.resultsContainer.remove(child, true);
        }
    }

    private showPreviousResult() {
        if (!this.resultsData || !this.resultsData.npcResults) return;
        
        this.resultsPageIndex--;
        if (this.resultsPageIndex < 0) {
            this.resultsPageIndex = this.resultsData.npcResults.length - 1;
        }
        this.displayResultsPage();
    }

    private showNextResult() {
        if (!this.resultsData || !this.resultsData.npcResults) return;
        
        this.resultsPageIndex++;
        if (this.resultsPageIndex >= this.resultsData.npcResults.length) {
            this.resultsPageIndex = 0;
        }
        this.displayResultsPage();
    }

    private getRankColor(rank: number): number {
        switch (rank) {
            case 1: return 0xffd700; // Gold
            case 2: return 0xc0c0c0; // Silver
            case 3: return 0xcd7f32; // Bronze
            default: return 0x666666; // Gray
        }
    }

    private getPotentialColor(potential: string): number {
        switch (potential) {
            case 'soulmate': return 0xff1493; // Deep pink
            case 'romantic_interest': return 0xff69b4; // Hot pink
            case 'friends': return 0x87ceeb; // Sky blue
            case 'not_interested': return 0x808080; // Gray
            default: return 0x666666;
        }
    }

    private getPotentialLabel(potential: string): string {
        switch (potential) {
            case 'soulmate': return '💕 SOULMATE';
            case 'romantic_interest': return '💗 INTERESTED';
            case 'friends': return '👫 FRIENDS';
            case 'not_interested': return '❌ NOT INTERESTED';
            default: return '❓ UNKNOWN';
        }
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
            
            // Start with green color for better visibility
            this.timerText.setColor('#00ff00');
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
                    } else {
                        this.timerText.setColor('#00ff00');
                    }
                }
            },
            callbackScope: this
        });
        
        console.log(`💕 [SPEED_DATING] Match timer set to ${this.matchTimer} seconds with real-time countdown`);
    }

    private addToConversationLog(message: string) {
        console.log(`💬 [SPEED_DATING] Adding to conversation: "${message}"`);
        this.conversationLog.push(message);
        
        // Keep last 50 messages for better scrolling
        if (this.conversationLog.length > 50) {
            const removed = this.conversationLog.shift();
            console.log(`💬 [SPEED_DATING] Removed old message: "${removed}"`);
        }
        
        if (this.chatHistory) {
            // Join messages with proper spacing
            const displayText = this.conversationLog.join('\n\n');
            this.chatHistory.setText(displayText);
            
            // Auto-scroll to bottom if near bottom
            const textHeight = this.chatHistory.height;
            const viewHeight = this.cameras.main.height * 0.42;
            if (textHeight > viewHeight) {
                // Scroll to show latest message
                this.chatHistory.y = viewHeight - textHeight - 20;
            }
            
            console.log(`💬 [SPEED_DATING] Conversation log now has ${this.conversationLog.length} messages`);
        }
    }

    private scrollChat(delta: number) {
        if (!this.chatHistory) return;
        
        const newY = this.chatHistory.y - delta;
        const textHeight = this.chatHistory.height;
        const viewHeight = this.cameras.main.height * 0.42;
        
        // Limit scrolling to keep text within bounds
        const minY = viewHeight - textHeight - 20;
        const maxY = this.cameras.main.height * 0.05;
        
        if (textHeight > viewHeight) {
            this.chatHistory.y = Phaser.Math.Clamp(newY, minY, maxY);
        }
    }


    private sendMessage() {
        console.log('💕 [SPEED_DATING] sendMessage called');
        console.log('Current message:', this.currentMessage);
        console.log('Current match:', this.currentMatch);
        console.log('Sending message flag:', this.sendingMessage);
        
        if (!this.currentMessage.trim()) {
            console.log('⚠️ [SPEED_DATING] Message is empty');
            return;
        }
        
        if (!this.currentMatch) {
            console.log('⚠️ [SPEED_DATING] No current match');
            return;
        }
        
        if (this.sendingMessage) {
            console.log('⚠️ [SPEED_DATING] Already sending a message, please wait');
            return;
        }
        
        // Set sending flag
        this.sendingMessage = true;
        
        // Add to conversation log
        this.addToConversationLog(`You: ${this.currentMessage.trim()}`);
        
        // Send to game server
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene && gameScene.room) {
            console.log('💕 [SPEED_DATING] Sending message to server:', {
                matchId: this.currentMatch.id,
                message: this.currentMessage.trim()
            });
            
            gameScene.room.send('speed_dating_message', {
                matchId: this.currentMatch.id,
                message: this.currentMessage.trim()
            });
        } else {
            console.error('❌ [SPEED_DATING] GameScene or room not available');
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
        
        // Note: Phaser scenes don't have a destroy method, cleanup is handled by the scene manager
    }
}

export default SpeedDatingScene;