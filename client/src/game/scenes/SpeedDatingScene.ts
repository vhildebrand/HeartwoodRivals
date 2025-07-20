import { Scene } from "phaser";
import { AudioManager } from "../utils/AudioManager";

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

// New interface for tracking vibe feedback per message
interface MessageVibeData {
    messageIndex: number;
    vibeScore: number;
    vibeReason: string;
    timestamp: number;
}

export class SpeedDatingScene extends Scene {
    // Scene state
    private currentEvent: SpeedDatingEvent | null = null;
    private currentMatch: SpeedDatingMatch | null = null;
    private vibeScore: number = 0;
    private matchTimer: number = 0;
    private conversationLog: string[] = [];
    
    // Round tracking
    private currentRound: number = 0;
    private totalRounds: number = 0;
    
    // New: Track vibe feedback per message
    private messageVibeData: Map<number, MessageVibeData> = new Map();
    private userMessageCount: number = 0;
    
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
    private roundText: Phaser.GameObjects.Text | null = null;
    private instructionsText: Phaser.GameObjects.Text | null = null;
    private vibeBarBackground: Phaser.GameObjects.Rectangle | null = null;
    private vibeBarFill: Phaser.GameObjects.Rectangle | null = null;
    
    // Minimize/restore functionality
    private minimizeButton: Phaser.GameObjects.Rectangle | null = null;
    private minimizeButtonText: Phaser.GameObjects.Text | null = null;
    private isMinimized: boolean = false;
    
    // New: Hover tooltip elements
    private hoverTooltip: Phaser.GameObjects.Container | null = null;
    private hoverTooltipBg: Phaser.GameObjects.Rectangle | null = null;
    private hoverTooltipText: Phaser.GameObjects.Text | null = null;
    private messageTextObjects: Phaser.GameObjects.Text[] = [];
    
    // Input state
    private currentMessage: string = '';
    private inputActive: boolean = false;
    private sendingMessage: boolean = false;
    
    // Countdown UI
    private countdownContainer: Phaser.GameObjects.Container | null = null;
    private countdownText: Phaser.GameObjects.Text | null = null;
    private countdownEndTime: number = 0;
    private countdownInterval: number | null = null;
    
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

        // Round information with icon
        const roundIcon = this.add.text(
            width * 0.4, 
            height * 0.22, 
            '🔄', 
            {
                fontSize: '20px',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        this.roundText = this.add.text(
            width * 0.5, 
            height * 0.22, 
            'Round: -/-', 
            {
                fontSize: '20px',
                color: '#ffffff',
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
            'Press ENTER to send • Arrow keys to scroll • ESC to close results • Hover over your messages to see NPC reactions • Click [-] to minimize', 
            {
                fontSize: '14px',
                color: '#ff69b4',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'italic',
                align: 'center'
            }
        ).setOrigin(0.5);

        // Minimize button
        this.minimizeButton = this.add.rectangle(
            width * 0.95,
            height * 0.12,
            40,
            30,
            0x666666,
            0.8
        );
        this.minimizeButton.setStrokeStyle(2, 0xffffff, 0.6);
        this.minimizeButton.setInteractive({ useHandCursor: true });
        this.minimizeButton.on('pointerdown', () => this.toggleMinimize());

        this.minimizeButtonText = this.add.text(
            width * 0.95,
            height * 0.12,
            '−',
            {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        // Create hover tooltip
        this.createHoverTooltip();

        // Add all elements to container
        this.dialogueContainer.add([
            this.backgroundPanel,
            headerBg,
            this.npcNameText,
            timerIcon,
            this.timerText,
            roundIcon,
            this.roundText,
            vibeIcon,
            this.vibeText,
            this.vibeBarBackground,
            this.vibeBarFill,
            this.chatContainer,
            this.inputBox,
            this.inputText,
            sendButton,
            sendText,
            this.minimizeButton,
            this.minimizeButtonText,
            this.instructionsText
        ]);

        // Create countdown UI
        this.createCountdownUI();
        
        // Create results UI
        this.createResultsUI();
        
        // Add the hover tooltip to the main scene (not to any container) so it appears on top
        if (this.hoverTooltip) {
            // Remove from any existing parent and add directly to the scene
            this.add.existing(this.hoverTooltip);
        }
        
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
            // Don't cleanup listeners when sleeping, just hide the scene
            this.scene.setVisible(false);
        });
        
        this.events.on('wake', () => {
            console.log('💕 [SPEED_DATING] Scene waking up');
            // Re-setup listeners if needed when waking
            if (!this.eventListenersSetup) {
                this.setupEventListeners();
            }
        });
        
        console.log('💕 [SPEED_DATING] Scene initialization complete');
        
        // Initially set scene visible - it's the containers that control visibility
        this.scene.setVisible(true);
    }

    private createCountdownUI() {
        const { width, height } = this.cameras.main;
        
        this.countdownContainer = this.add.container(0, 0);
        this.countdownContainer.setDepth(1100);
        this.countdownContainer.setVisible(false);

        // Make background more transparent to avoid white box appearance
        const countdownBg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        
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
            'Starting...', // Set initial text instead of empty
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
            'See how each NPC ranked their dates!\nUse arrow buttons to navigate • Click [-] to minimize • Press ESC to return to game',
            {
                fontSize: '16px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'italic',
                align: 'center'
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

        // Minimize button for results screen
        const resultsMinimizeButton = this.add.rectangle(
            width * 0.95,
            height * 0.08,
            40,
            30,
            0x666666,
            0.8
        );
        resultsMinimizeButton.setStrokeStyle(2, 0xffffff, 0.6);
        resultsMinimizeButton.setInteractive({ useHandCursor: true });
        resultsMinimizeButton.on('pointerdown', () => this.toggleMinimize());

        const resultsMinimizeButtonText = this.add.text(
            width * 0.95,
            height * 0.08,
            '−',
            {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
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
            resultsMinimizeButton,
            resultsMinimizeButtonText,
            backButton, 
            backButtonText
        ]);
    }

    private createHoverTooltip() {
        // Create hover tooltip container
        this.hoverTooltip = this.add.container(0, 0);
        this.hoverTooltip.setDepth(2000); // Ensure it's on top
        this.hoverTooltip.setVisible(false);
        
        // Tooltip background
        this.hoverTooltipBg = this.add.rectangle(0, 0, 300, 80, 0x2d1b2d, 0.95);
        this.hoverTooltipBg.setStrokeStyle(2, 0xff69b4, 0.8);
        
        // Tooltip text
        this.hoverTooltipText = this.add.text(0, 0, '', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: '"Segoe UI", Arial, sans-serif',
            wordWrap: { width: 280 },
            align: 'center',
            lineSpacing: 5
        }).setOrigin(0.5);
        
        this.hoverTooltip.add([this.hoverTooltipBg, this.hoverTooltipText]);
    }

    private setupInputHandlers() {
        // Keyboard input
        this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            // Handle Escape key to close results screen
            if (event.key === 'Escape') {
                console.log('💕 [SPEED_DATING] ESC key pressed!');
                console.log('💕 [SPEED_DATING] Results container visible:', this.resultsContainer?.visible);
                if (this.resultsContainer?.visible) {
                    console.log('💕 [SPEED_DATING] Closing results screen with ESC');
                    this.returnToGame();
                    return;
                } else {
                    console.log('💕 [SPEED_DATING] Results container not visible, ESC ignored');
                }
            }
            
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
            console.log(`💕 [SPEED_DATING] Current match ID: ${this.currentMatch?.id}, Response match ID: ${data.matchId}`);
            
            // Validate data
            if (!data || !data.message) {
                console.error('❌ [SPEED_DATING] Invalid NPC response data:', data);
                return;
            }
            
            // Ensure we're processing responses for the current match
            if (this.currentMatch && data.matchId !== this.currentMatch.id) {
                console.log(`⚠️ [SPEED_DATING] Ignoring response for different match. Current: ${this.currentMatch.id}, Received: ${data.matchId}`);
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
        
        // Store the countdown end time if provided
        if (data.countdownEndTime) {
            this.countdownEndTime = data.countdownEndTime;
        }
        
        // Handle both initial countdown and countdown updates
        if (data.countdownSeconds !== undefined || data.countdownEndTime !== undefined) {
            // Initial countdown start or late joiner
            const remainingTime = this.countdownEndTime ? 
                Math.max(0, Math.ceil((this.countdownEndTime - Date.now()) / 1000)) : 
                data.countdownSeconds;
            
            console.log(`💕 [SPEED_DATING] Starting countdown: ${remainingTime} seconds`);
            this.scene.setVisible(true);
            this.scene.bringToTop();
            this.showCountdown(remainingTime);
        } else if (data.remainingSeconds !== undefined) {
            // Countdown update
            console.log(`💕 [SPEED_DATING] Countdown update: ${data.remainingSeconds} seconds remaining`);
            this.updateCountdown(data.remainingSeconds);
        }
    }
    
    private updateCountdown(seconds: number) {
        console.log(`💕 [SPEED_DATING] updateCountdown called with ${seconds} seconds`);
        
        if (!this.countdownText) {
            console.error('❌ [SPEED_DATING] Countdown text not found!');
            return;
        }
        
        this.countdownText.setText(seconds.toString());
        
        // Color changes based on remaining time
        if (seconds <= 5) {
            this.countdownText.setColor('#ff0000');
            this.countdownText.setScale(1.2);
        } else if (seconds <= 10) {
            this.countdownText.setColor('#ff4444');
            this.countdownText.setScale(1.0);
        } else {
            this.countdownText.setColor('#ffffff');
            this.countdownText.setScale(1.0);
        }
        
        // Hide countdown when it reaches 0
        if (seconds <= 0) {
            this.hideCountdown();
        }
    }

    private handleGauntletStart(data: any) {
        console.log('💕 [SPEED_DATING] Gauntlet started:', data);
        
        // Store event data
        this.currentEvent = {
            id: data.eventId?.toString() || data.id?.toString() || Date.now().toString(),
            eventName: data.eventName || 'Speed Dating Gauntlet',
            status: 'active',
            participants: data.participants || []
        };
        
        // Start speed dating music
        const audioManager = AudioManager.getInstance();
        audioManager.playSceneMusic('background_music_1', true).then(() => {
            console.log('🎵 [SPEED_DATING] Romantic music fully started (Struggle Sandwich)');
        });
        console.log('🎵 [SPEED_DATING] Starting romantic music transition...');
        
        this.hideCountdown();
        console.log('💕 [SPEED_DATING] Event ID stored:', this.currentEvent.id);
    }

    private handleMatchStart(data: any) {
        console.log('💕 [SPEED_DATING] handleMatchStart called with data:', data);
        
        // Ensure scene is visible and on top
        this.scene.setVisible(true);
        this.scene.bringToTop();
        
        // Store the full match data
        this.currentMatch = {
            id: data.matchId,
            playerId: data.playerId,
            npcId: data.npcId,
            npcName: data.npcName || data.npcId,
            duration: data.duration,
            status: 'active'
        };
        
        // Update round information
        this.currentRound = data.round || 1;
        this.totalRounds = data.totalRounds || 1;
        
        this.matchTimer = data.duration;
        this.inputActive = true;
        
        console.log(`💕 [SPEED_DATING] Current match set:`, this.currentMatch);
        console.log(`💕 [SPEED_DATING] Match timer set to ${this.matchTimer} seconds (${Math.floor(this.matchTimer / 60)}:${(this.matchTimer % 60).toString().padStart(2, '0')})`);
        
        // Clear processed messages for new match
        this.processedMessages.clear();
        
        // Reset message tracking for hover functionality
        this.messageVibeData.clear();
        this.userMessageCount = 0;
        this.messageTextObjects.forEach(textObj => textObj.destroy());
        this.messageTextObjects = [];
        
        // Reset sending flag
        this.sendingMessage = false;
        
        // Update UI with proper NPC name
        if (this.npcNameText) {
            const npcName = this.getNPCDisplayName(data.npcId);
            this.npcNameText.setText(`💕 Dating: ${npcName}`);
        }
        
        // Update round display
        if (this.roundText) {
            this.roundText.setText(`Round: ${this.currentRound}/${this.totalRounds}`);
        }
        
        // Show the dialogue interface
        this.showDialogue();
        
        // Clear previous conversation
        this.conversationLog = [];
        
        // Reset chat display position
        if (this.chatHistory) {
            this.chatHistory.setText('');
            this.chatHistory.y = this.cameras.main.height * 0.05; // Reset to initial position
        }
        
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
        
        // Store vibe feedback for the latest user message (instead of adding to chat)
        if (data.vibeScore !== 0 && this.userMessageCount > 0) {
            const vibeData: MessageVibeData = {
                messageIndex: this.userMessageCount - 1,
                vibeScore: data.vibeScore,
                vibeReason: data.vibeReason || 'Vibe changed',
                timestamp: Date.now()
            };
            
            this.messageVibeData.set(this.userMessageCount - 1, vibeData);
            console.log(`💕 [SPEED_DATING] Stored vibe feedback for message ${this.userMessageCount - 1}: ${data.vibeScore} (${data.vibeReason})`);
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
        console.log('💕 [SPEED_DATING] Gauntlet complete received:', data);
        
        this.inputActive = false;
        this.hideDialogue();
        
        // Return to background music
        const audioManager = AudioManager.getInstance();
        audioManager.returnToBackgroundMusic();
        console.log('🎵 [SPEED_DATING] Returned to background music');
        
        // Store event ID if provided
        if (data.eventId && this.currentEvent) {
            this.currentEvent.id = data.eventId.toString();
        }
        
        // Results will be automatically broadcast by the server
        // No need to request them manually
        console.log('💕 [SPEED_DATING] Waiting for automatic results broadcast...');
    }

    private async requestGauntletResults() {
        // Show loading message while waiting for automatic results broadcast
        console.log('💕 [SPEED_DATING] Waiting for results to be broadcast...');
        this.showResults({ loading: true });
        
        // Results will be automatically broadcast by the server after processing
        // No need to manually request them
    }

    private showResults(data: any) {
        console.log('💕 [SPEED_DATING] Showing results:', data);
        
        if (!this.resultsContainer) {
            console.error('❌ [SPEED_DATING] Results container not found!');
            return;
        }
        
        this.resultsContainer.setVisible(true);
        
        if (data.loading) {
            this.displayLoadingResults();
            // Update loading message if provided
            if (data.message && this.resultsContainer.list.length > 0) {
                const loadingText = this.resultsContainer.list[0] as Phaser.GameObjects.Text;
                if (loadingText && loadingText.type === 'Text') {
                    loadingText.setText(data.message);
                }
            }
        } else if (data.error) {
            this.displayErrorResults();
        } else if (data.npcResults) {
            // Valid results data
            this.resultsData = data;
            this.resultsPageIndex = 0;
            this.displayResultsPage();
        } else {
            console.error('❌ [SPEED_DATING] Invalid results data:', data);
            this.displayErrorResults();
        }
    }

    private displayLoadingResults() {
        const { width, height } = this.cameras.main;
        
        // Clear any existing result content
        this.clearResultContent();
        
        const loadingText = this.add.text(
            width / 2,
            height / 2 - 40,
            'Loading results...\n\nNPCs are sharing their thoughts...\nThis may take up to a minute.',
            {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                align: 'center',
                lineSpacing: 10
            }
        ).setOrigin(0.5);
        
        const tipText = this.add.text(
            width / 2,
            height / 2 + 40,
            'You can close this screen and return to the game while waiting.',
            {
                fontSize: '16px',
                color: '#aaaaaa',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                align: 'center',
                fontStyle: 'italic'
            }
        ).setOrigin(0.5);

        // Add close button to loading screen too
        const closeButton = this.add.rectangle(width / 2, height / 2 + 100, 200, 50, 0x666666, 0.8);
        closeButton.setStrokeStyle(2, 0xffffff);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on('pointerdown', () => this.returnToGame());

        const closeButtonText = this.add.text(
            width / 2, 
            height / 2 + 100, 
            'CLOSE & RETURN TO GAME', 
            {
                fontSize: '16px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        this.resultsContainer?.add([loadingText, tipText, closeButton, closeButtonText]);
    }

    private displayErrorResults() {
        const { width, height } = this.cameras.main;
        
        // Clear any existing result content
        this.clearResultContent();
        
        const errorText = this.add.text(
            width / 2,
            height / 2 - 60,
            'Results are still being processed',
            {
                fontSize: '28px',
                color: '#ffaa00',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                align: 'center'
            }
        ).setOrigin(0.5);
        
        const subText = this.add.text(
            width / 2,
            height / 2 - 20,
            'The NPCs need more time to reflect on their dates.\nResults will appear automatically when ready.',
            {
                fontSize: '18px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                align: 'center',
                lineSpacing: 5
            }
        ).setOrigin(0.5);
        
        const tipText = this.add.text(
            width / 2,
            height / 2 + 20,
            'You can close this screen and return to the game.\nResults will be available when ready.',
            {
                fontSize: '16px',
                color: '#aaaaaa',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                align: 'center',
                lineSpacing: 5
            }
        ).setOrigin(0.5);

        // Add close button
        const closeButton = this.add.rectangle(width / 2, height / 2 + 80, 200, 50, 0xcc4444, 0.9);
        closeButton.setStrokeStyle(2, 0xffffff);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on('pointerdown', () => this.returnToGame());

        const closeButtonText = this.add.text(
            width / 2, 
            height / 2 + 80, 
            'CLOSE & RETURN TO GAME', 
            {
                fontSize: '16px',
                color: '#ffffff',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        this.resultsContainer?.add([errorText, subText, tipText, closeButton, closeButtonText]);
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
            
            // Player info - use playerIdOriginal for matching, playerId for display
            const isCurrentPlayer = ranking.playerIdOriginal === this.currentMatch?.playerId || ranking.playerId === this.currentMatch?.playerId;
            const displayName = isCurrentPlayer ? 'You' : ranking.playerId;
            
            const playerText = this.add.text(
                -width * 0.25,
                yOffset - 15,
                displayName,
                {
                    fontSize: '20px',
                    color: '#ffffff',
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                    fontStyle: 'bold'
                }
            ).setOrigin(0, 0.5);
            
            // Scores - make these hoverable
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
            
            // Add hover functionality to scores to show detailed thoughts
            scoresText.setInteractive({ useHandCursor: true });
            scoresText.setTint(0xccccff); // Subtle tint to indicate it's hoverable
            
            scoresText.on('pointerover', () => {
                this.showResultsTooltip(scoresText, ranking);
            });
            
            scoresText.on('pointerout', () => {
                this.hideVibeTooltip();
            });
            
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
        
        // Confessional quote - use playerIdOriginal for matching if available
        const playerRanking = currentNpc.rankings.find((r: any) => 
            r.playerIdOriginal === this.currentMatch?.playerId || r.playerId === this.currentMatch?.playerId
        );
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
        
        // Add instruction text for hover functionality
        const instructionText = this.add.text(
            width / 2,
            height * 0.85,
            'Hover over scores to see detailed thoughts',
            {
                fontSize: '14px',
                color: '#888888',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                fontStyle: 'italic'
            }
        ).setOrigin(0.5);
        
        this.resultsContainer?.add([
            npcNameBg, npcName, pageText, rankingsContainer, instructionText
        ]);
    }

    private showResultsTooltip(scoreText: Phaser.GameObjects.Text, ranking: any) {
        if (!this.hoverTooltip || !this.hoverTooltipText || !this.hoverTooltipBg) return;
        if (!this.resultsData || !this.resultsData.npcResults) return;
        
        const currentNpc = this.resultsData.npcResults[this.resultsPageIndex];
        if (!currentNpc) return;
        
        // Create detailed tooltip content
        let tooltipContent = `💭 ${this.getNPCDisplayName(currentNpc.npcId)}'s Thoughts:\n\n`;
        tooltipContent += `"${ranking.reasoning}"\n\n`;
        
        if (ranking.memorableMoments && ranking.memorableMoments.length > 0) {
            tooltipContent += `Memorable moment: "${ranking.memorableMoments[0]}"`;
        }
        
        this.hoverTooltipText.setText(tooltipContent);
        
        // Position tooltip near the score text
        const scoreWorldPos = scoreText.getWorldTransformMatrix();
        const tooltipX = scoreWorldPos.tx + 200; // Offset to the right
        const tooltipY = scoreWorldPos.ty;
        
        // Ensure tooltip stays within screen bounds
        const { width, height } = this.cameras.main;
        const clampedX = Phaser.Math.Clamp(tooltipX, 200, width - 200);
        const clampedY = Phaser.Math.Clamp(tooltipY, 100, height - 150);
        
        this.hoverTooltip.setPosition(clampedX, clampedY);
        this.hoverTooltip.setVisible(true);
        
        // Adjust background size based on text (make it larger for results)
        const textBounds = this.hoverTooltipText.getBounds();
        this.hoverTooltipBg.setSize(Math.max(300, textBounds.width + 30), Math.max(120, textBounds.height + 30));
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
        console.log(`💕 [SPEED_DATING] showCountdown called with ${seconds} seconds`);
        
        if (!this.countdownContainer) {
            console.error('❌ [SPEED_DATING] Countdown container not found!');
            return;
        }
        
        // Make sure scene and container are visible
        this.scene.setVisible(true);
        this.scene.bringToTop();
        this.countdownContainer.setVisible(true);
        this.countdownContainer.setDepth(2000); // Ensure it's on top
        
        // Also hide other UI elements
        this.hideDialogue();
        this.resultsContainer?.setVisible(false);
        
        // Set initial countdown value
        if (this.countdownText) {
            this.countdownText.setText(seconds.toString());
            
            // Color changes based on initial value
            if (seconds <= 5) {
                this.countdownText.setColor('#ff4444');
            } else if (seconds <= 10) {
                this.countdownText.setColor('#ffaa00');
            } else {
                this.countdownText.setColor('#ffffff');
            }
        } else {
            console.error('❌ [SPEED_DATING] Countdown text not found!');
        }
        
        // Clear any existing countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Start client-side countdown timer if we have an end time
        if (this.countdownEndTime > 0) {
            console.log(`💕 [SPEED_DATING] Starting client-side countdown with end time: ${this.countdownEndTime}`);
            this.countdownInterval = window.setInterval(() => {
                const remaining = Math.max(0, Math.ceil((this.countdownEndTime - Date.now()) / 1000));
                this.updateCountdown(remaining);
                
                if (remaining <= 0 && this.countdownInterval) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                }
            }, 100); // Update every 100ms for smooth countdown
        }
        
        console.log(`💕 [SPEED_DATING] Countdown UI setup complete`);
    }

    private hideCountdown() {
        this.countdownContainer?.setVisible(false);
        
        // Clear countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    private showDialogue() {
        console.log('💕 [SPEED_DATING] showDialogue called');
        this.dialogueContainer?.setVisible(true);
        console.log('💕 [SPEED_DATING] dialogueContainer visible:', this.dialogueContainer?.visible);
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
        
        // Track user messages for hover functionality
        if (message.startsWith('You: ')) {
            this.userMessageCount++;
        }
        
        // Keep last 50 messages for better scrolling
        if (this.conversationLog.length > 50) {
            const removed = this.conversationLog.shift();
            console.log(`💬 [SPEED_DATING] Removed old message: "${removed}"`);
        }
        
        if (this.chatHistory) {
            // Clear message text objects
            this.messageTextObjects.forEach(textObj => textObj.destroy());
            this.messageTextObjects = [];
            
            // Create interactive text objects for each message
            this.createInteractiveMessages();
            
            console.log(`💬 [SPEED_DATING] Conversation log now has ${this.conversationLog.length} messages`);
        }
    }

    private createInteractiveMessages() {
        if (!this.chatHistory || !this.chatContainer) return;
        
        const { width } = this.cameras.main;
        let yOffset = this.cameras.main.height * 0.05;
        let userMessageIndex = 0;
        
        this.conversationLog.forEach((message, index) => {
            const isUserMessage = message.startsWith('You: ');
            const textColor = isUserMessage ? '#ffff99' : '#ffffff';
            
            const messageText = this.add.text(
                0,
                yOffset,
                message,
                {
                    fontSize: '17px',
                    color: textColor,
                    fontFamily: '"Segoe UI", Arial, sans-serif',
                    fontStyle: 'normal',
                    wordWrap: { width: width * 0.8 },
                    align: 'left',
                    lineSpacing: 10,
                    padding: { x: 15, y: 5 }
                }
            ).setOrigin(0.5, 0);
            
            // Apply mask
            if (this.chatMask) {
                messageText.setMask(this.chatMask.createGeometryMask());
            }
            
            // Add hover functionality for user messages
            if (isUserMessage) {
                const vibeData = this.messageVibeData.get(userMessageIndex);
                if (vibeData) {
                    messageText.setInteractive({ useHandCursor: true });
                    
                    messageText.on('pointerover', () => {
                        this.showVibeTooltip(messageText, vibeData);
                    });
                    
                    messageText.on('pointerout', () => {
                        this.hideVibeTooltip();
                    });
                    
                    // Add subtle highlight for hoverable messages
                    messageText.setTint(0xffffcc);
                }
                userMessageIndex++;
            }
            
            if (this.chatContainer) {
                this.chatContainer.add(messageText);
            }
            this.messageTextObjects.push(messageText);
            
            // Calculate height and update yOffset
            const messageHeight = messageText.height + 20;
            yOffset += messageHeight;
        });
        
        // Auto-scroll to bottom if needed
        const totalHeight = yOffset;
        const viewHeight = this.cameras.main.height * 0.42;
        if (totalHeight > viewHeight) {
            const scrollOffset = totalHeight - viewHeight + 20;
            this.messageTextObjects.forEach(textObj => {
                textObj.y -= scrollOffset;
            });
        }
    }

    private showVibeTooltip(messageText: Phaser.GameObjects.Text, vibeData: MessageVibeData) {
        if (!this.hoverTooltip || !this.hoverTooltipText || !this.hoverTooltipBg) return;
        
        const vibeSign = vibeData.vibeScore > 0 ? '+' : '';
        const tooltipContent = `💝 ${vibeData.vibeReason}\nVibe Impact: ${vibeSign}${vibeData.vibeScore}`;
        
        this.hoverTooltipText.setText(tooltipContent);
        
        // Position tooltip above the message
        const messageWorldPos = messageText.getWorldTransformMatrix();
        const tooltipX = messageWorldPos.tx;
        const tooltipY = messageWorldPos.ty - 60;
        
        // Ensure tooltip stays within screen bounds
        const { width, height } = this.cameras.main;
        const clampedX = Phaser.Math.Clamp(tooltipX, 150, width - 150);
        const clampedY = Phaser.Math.Clamp(tooltipY, 50, height - 100);
        
        this.hoverTooltip.setPosition(clampedX, clampedY);
        this.hoverTooltip.setVisible(true);
        
        // Adjust background size based on text
        const textBounds = this.hoverTooltipText.getBounds();
        this.hoverTooltipBg.setSize(textBounds.width + 20, textBounds.height + 20);
    }

    private hideVibeTooltip() {
        if (this.hoverTooltip) {
            this.hoverTooltip.setVisible(false);
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

    private toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        
        if (this.isMinimized) {
            // Minimize - sleep the scene to completely remove it from input processing
            this.scene.sleep();
            
            // Resume the GameScene so player can move around
            this.scene.resume('GameScene');
            
            // Clear any active input state to prevent interference with movement
            this.inputActive = false;
            this.currentMessage = '';
            this.updateInputDisplay();
            
            // Determine what's being minimized for appropriate indicator
            const isShowingResults = this.resultsContainer?.visible;
            const displayText = isShowingResults ? 'Speed Dating Results' : 'Speed Dating';
            
            // Show minimized indicator in UIScene
            this.game.events.emit('speed_dating_minimized', { 
                currentRound: this.currentRound, 
                totalRounds: this.totalRounds,
                matchActive: this.currentMatch !== null,
                showingResults: isShowingResults,
                displayText: displayText
            });
            
            console.log(`💕 [SPEED_DATING] Scene minimized (sleeping) and GameScene resumed for movement - ${displayText}`);
        } else {
            // Restore - wake the scene to bring it back into input processing
            this.scene.wake();
            this.scene.bringToTop();
            
            // Only pause GameScene if we're in active dating or showing results
            // (don't pause if speed dating has fully ended)
            const shouldPauseGame = this.currentMatch !== null || this.resultsContainer?.visible;
            if (shouldPauseGame) {
                this.scene.pause('GameScene');
            }
            
            // Hide minimized indicator
            this.game.events.emit('speed_dating_restored');
            
            console.log(`💕 [SPEED_DATING] Scene restored (woken up)${shouldPauseGame ? ' and GameScene paused' : ''}`);
        }
    }

    private returnToGame() {
        // Return to background music if speed dating music was playing
        const audioManager = AudioManager.getInstance();
        if (audioManager.isSceneMusicPlaying()) {
            audioManager.returnToBackgroundMusic();
            console.log('🎵 [SPEED_DATING] Returned to background music on scene exit');
        }
        
        // Hide and stop the speed dating scene
        this.scene.setVisible(false);
        this.scene.sendToBack();
        
        // Make sure GameScene is resumed for normal gameplay
        this.scene.resume('GameScene');
        this.scene.resume('UIScene');
        
        console.log('💕 [SPEED_DATING] Returned to game with GameScene resumed');
    }

    destroy() {
        console.log('💕 [SPEED_DATING] Cleaning up scene');
        
        // Clean up event listeners
        this.cleanupEventListeners();
        
        // Clear countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Note: Phaser scenes don't have a destroy method, cleanup is handled by the scene manager
    }
}

export default SpeedDatingScene; 