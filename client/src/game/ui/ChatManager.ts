import { Scene } from 'phaser';

interface ChatMessage {
    id: string;
    playerId: string;
    playerName: string;
    message: string;
    location: string;
    timestamp: number;
    type: 'public_speech' | 'system';
}

export class ChatManager {
    private scene: Scene;
    private isVisible: boolean = false;
    private isInputBlocked: () => boolean;
    
    // UI Elements
    private chatContainer: Phaser.GameObjects.Container | null = null;
    private chatBackground: Phaser.GameObjects.Rectangle | null = null;
    private chatTitle: Phaser.GameObjects.Text | null = null;
    private chatHistory: Phaser.GameObjects.Text | null = null;
    private chatMask: Phaser.GameObjects.Graphics | null = null;
    private closeButton: Phaser.GameObjects.Rectangle | null = null;
    private closeButtonText: Phaser.GameObjects.Text | null = null;
    private toggleButton: Phaser.GameObjects.Rectangle | null = null;
    private toggleButtonText: Phaser.GameObjects.Text | null = null;
    
    // Chat data
    private messages: ChatMessage[] = [];
    private maxDisplayMessages = 50;
    private scrollOffset = 0;

    constructor(scene: Scene, isInputBlocked: () => boolean) {
        this.scene = scene;
        this.isInputBlocked = isInputBlocked;
        this.setupUI();
        this.setupInputHandlers();
    }

    private setupUI() {
        const { width, height } = this.scene.cameras.main;
        
        // Create container for the chat UI
        this.chatContainer = this.scene.add.container(0, 0);
        
        // Chat background panel - positioned in bottom right corner
        this.chatBackground = this.scene.add.rectangle(
            width - 320, // Position on right side
            height - 420, // Position near bottom
            300,
            400,
            0x000000,
            0.85
        );
        this.chatBackground.setStrokeStyle(2, 0x444444, 0.8);
        this.chatBackground.setOrigin(0, 0);
        
        // Title bar
        this.chatTitle = this.scene.add.text(
            width - 315,
            height - 410,
            'Chat Log (C to toggle)',
            {
                fontSize: '14px',
                color: '#ffffff'
            }
        ).setOrigin(0, 0);
        
        // Close button
        this.closeButton = this.scene.add.rectangle(
            width - 40,
            height - 405,
            20,
            20,
            0x666666,
            0.8
        );
        this.closeButton.setStrokeStyle(1, 0xaaaaaa);
        this.closeButton.setInteractive({ useHandCursor: true });
        this.closeButton.on('pointerdown', () => this.toggleChat());
        
        this.closeButtonText = this.scene.add.text(
            width - 40,
            height - 405,
            '×',
            {
                fontSize: '16px',
                color: '#ffffff'
            }
        ).setOrigin(0.5, 0.5);
        
        // Create mask for scrollable chat area (invisible mask for clipping)
        this.chatMask = this.scene.add.graphics();
        this.chatMask.fillStyle(0xffffff);
        this.chatMask.fillRect(
            width - 315,
            height - 390,
            290,
            340
        );
        // Make the mask graphics invisible (it's only used for clipping)
        this.chatMask.setVisible(false);
        
        // Chat history display
        this.chatHistory = this.scene.add.text(
            width - 310,
            height - 385,
            'Welcome to Heartwood Rivals!\nPress T to say something out loud...',
            {
                fontSize: '12px',
                color: '#ffffff',
                fontFamily: 'Arial, sans-serif',
                wordWrap: { width: 280 },
                align: 'left',
                lineSpacing: 3
            }
        ).setOrigin(0, 0);
        
        // Apply mask for scrolling
        this.chatHistory.setMask(this.chatMask.createGeometryMask());
        
        // Toggle button (always visible) - positioned to not conflict with other UI
        this.toggleButton = this.scene.add.rectangle(
            width - 60,
            height - 60,
            50,
            25,
            0x333333,
            0.8
        );
        this.toggleButton.setStrokeStyle(1, 0x666666);
        this.toggleButton.setInteractive({ useHandCursor: true });
        this.toggleButton.on('pointerdown', () => this.toggleChat());
        
        this.toggleButtonText = this.scene.add.text(
            width - 60,
            height - 60,
            'Chat',
            {
                fontSize: '11px',
                color: '#ffffff'
            }
        ).setOrigin(0.5, 0.5);
        
        // Add all elements to container (except toggle button which should always be visible)
        this.chatContainer.add([
            this.chatBackground,
            this.chatTitle,
            this.closeButton,
            this.closeButtonText,
            this.chatHistory
        ]);
        
        // Initially hide the chat panel
        this.chatContainer.setVisible(false);
    }

    private setupInputHandlers() {
        // C key to toggle chat (only when no other input is active, or to close if already open)
        this.scene.input.keyboard?.addKey('C').on('down', () => {
            // Always allow closing the chat, even if other input is active
            if (this.isVisible) {
                this.toggleChat();
                return;
            }
            
            // Block opening chat if other input is active
            if (this.isInputBlocked()) {
                console.log('💬 [CHAT] Chat toggle blocked - other input is active');
                return;
            }
            
            this.toggleChat();
        });
        
        // Mouse wheel scrolling for chat
        this.scene.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any[], deltaX: number, deltaY: number) => {
            if (this.isVisible && this.isPointerOverChat(pointer)) {
                this.scrollChat(deltaY * 0.5);
            }
        });
    }

    private isPointerOverChat(pointer: Phaser.Input.Pointer): boolean {
        const { width, height } = this.scene.cameras.main;
        return pointer.x > width - 320 && pointer.x < width - 20 && 
               pointer.y > height - 420 && pointer.y < height - 20;
    }

    private toggleChat() {
        this.isVisible = !this.isVisible;
        this.chatContainer?.setVisible(this.isVisible);
        
        if (this.isVisible) {
            // Request chat history when opening
            const gameScene = this.scene.scene.get('GameScene') as any;
            if (gameScene && gameScene.room) {
                gameScene.room.send('request_chat_history');
            }
        }
        
        console.log(`💬 [CHAT] Chat ${this.isVisible ? 'opened' : 'closed'}`);
    }

    addMessage(messageData: ChatMessage) {
        // Add to messages array
        this.messages.push(messageData);
        
        // Keep only recent messages
        if (this.messages.length > this.maxDisplayMessages) {
            this.messages.shift();
        }
        
        this.updateChatDisplay();
    }

    addMessages(messages: ChatMessage[]) {
        this.messages = messages.slice(-this.maxDisplayMessages);
        this.updateChatDisplay();
    }

    private updateChatDisplay() {
        if (!this.chatHistory) return;
        
        let displayText = '';
        
        for (const msg of this.messages.slice(this.scrollOffset)) {
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            let line = '';
            if (msg.type === 'system') {
                line = `[${timeStr}] System: ${msg.message}`;
            } else {
                line = `[${timeStr}] ${msg.playerName}: ${msg.message}`;
            }
            
            displayText += line + '\n';
        }
        
        if (displayText === '') {
            displayText = 'Welcome to Heartwood Rivals!\nPress T to say something out loud...';
        }
        
        this.chatHistory.setText(displayText);
        
        // Auto-scroll to bottom when new messages arrive (if not manually scrolled up)
        if (this.scrollOffset === 0) {
            this.scrollToBottom();
        }
    }

    private scrollChat(delta: number) {
        const maxScroll = Math.max(0, this.messages.length - 25); // Show ~25 messages at once
        this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + Math.sign(delta)));
        this.updateChatDisplay();
    }

    private scrollToBottom() {
        if (!this.chatHistory) return;
        
        const { height } = this.scene.cameras.main;
        const textBounds = this.chatHistory.getBounds();
        const maskHeight = 340; // Fixed mask height from setupUI
        const chatStartY = height - 385; // Starting Y position of chat text
        
        if (textBounds && textBounds.height > maskHeight) {
            // Scroll up if text is taller than mask
            this.chatHistory.y = chatStartY + maskHeight - textBounds.height;
        } else {
            // Reset to start position if text fits
            this.chatHistory.y = chatStartY;
        }
    }

    isOpen(): boolean {
        return this.isVisible;
    }

    destroy() {
        this.chatContainer?.destroy();
        this.toggleButton?.destroy();
        this.toggleButtonText?.destroy();
    }
} 