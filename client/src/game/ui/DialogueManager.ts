import { Scene } from 'phaser';

export class DialogueManager {
    private scene: Scene;
    private isActive: boolean = false;
    private currentNpcId: string | null = null;
    private currentNpcName: string | null = null;
    private playerCharacterId: string | null = null;
    
    // UI Elements
    private dialogueContainer: Phaser.GameObjects.Container | null = null;
    private backgroundPanel: Phaser.GameObjects.Rectangle | null = null;
    private npcNameText: Phaser.GameObjects.Text | null = null;
    private chatHistory: Phaser.GameObjects.Text | null = null;
    private inputBox: Phaser.GameObjects.Rectangle | null = null;
    private inputText: Phaser.GameObjects.Text | null = null;
    private typingIndicator: Phaser.GameObjects.Text | null = null;
    private endConversationButton: Phaser.GameObjects.Rectangle | null = null;
    private endConversationText: Phaser.GameObjects.Text | null = null;
    private currentMessage: string = '';
    private chatLog: string[] = [];
    private isWaitingForResponse: boolean = false;
    private currentJobId: string | null = null;
    private responseCheckTimer: Phaser.Time.TimerEvent | null = null;
    
    // Conversation tracking
    private conversationStartTime: number | null = null;
    private conversationHistory: Array<{message: string, sender: 'player' | 'npc', timestamp: number}> = [];

    constructor(scene: Scene) {
        this.scene = scene;
        this.setupUI();
        this.setupInputHandlers();
    }

    setPlayerCharacterId(characterId: string) {
        this.playerCharacterId = characterId;
    }

    private setupUI() {
        const { width, height } = this.scene.cameras.main;
        
        // Create container for all dialogue elements
        this.dialogueContainer = this.scene.add.container(0, 0);
        this.dialogueContainer.setDepth(1000);
        this.dialogueContainer.setVisible(false);

        // Background panel
        this.backgroundPanel = this.scene.add.rectangle(
            width / 2, 
            height - 200, 
            width - 40, 
            180, 
            0x000000, 
            0.8
        );
        this.backgroundPanel.setStrokeStyle(2, 0x444444);
        this.dialogueContainer.add(this.backgroundPanel);

        // NPC Name
        this.npcNameText = this.scene.add.text(
            30, 
            height - 290, 
            '', 
            {
                fontSize: '20px',
                color: '#FFD700',
                fontStyle: 'bold'
            }
        );
        this.dialogueContainer.add(this.npcNameText);

        // Chat history
        this.chatHistory = this.scene.add.text(
            30, 
            height - 260, 
            '', 
            {
                fontSize: '16px',
                color: '#FFFFFF',
                wordWrap: { width: width - 80, useAdvancedWrap: true }
            }
        );
        this.dialogueContainer.add(this.chatHistory);

        // Input box
        this.inputBox = this.scene.add.rectangle(
            width / 2,
            height - 50,
            width - 80,
            40,
            0x222222,
            1
        );
        this.inputBox.setStrokeStyle(2, 0x666666);
        this.dialogueContainer.add(this.inputBox);

        // Input text
        this.inputText = this.scene.add.text(
            50,
            height - 65,
            'Type your message...',
            {
                fontSize: '16px',
                color: '#CCCCCC'
            }
        );
        this.dialogueContainer.add(this.inputText);

        // End conversation button
        this.endConversationButton = this.scene.add.rectangle(
            width - 100,
            height - 290,
            140,
            35,
            0x8B0000,
            1
        );
        this.endConversationButton.setStrokeStyle(2, 0xFFFFFF);
        this.endConversationButton.setInteractive();
        this.endConversationButton.on('pointerdown', () => {
            this.endConversation();
        });
        this.dialogueContainer.add(this.endConversationButton);

        // End conversation button text
        this.endConversationText = this.scene.add.text(
            width - 100,
            height - 290,
            'End Conversation',
            {
                fontSize: '12px',
                color: '#FFFFFF',
                align: 'center'
            }
        );
        this.endConversationText.setOrigin(0.5, 0.5);
        this.dialogueContainer.add(this.endConversationText);

        // Typing indicator
        this.typingIndicator = this.scene.add.text(
            width - 150,
            height - 65,
            '',
            {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'italic'
            }
        );
        this.dialogueContainer.add(this.typingIndicator);
    }

    private setupInputHandlers() {
        this.scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (!this.isActive) return;

            if (event.key === 'Escape') {
                this.closeDialogue();
                return;
            }

            if (event.key === 'Enter') {
                this.sendMessage();
                return;
            }

            if (event.key === 'Backspace') {
                this.currentMessage = this.currentMessage.slice(0, -1);
            } else if (event.key.length === 1) {
                this.currentMessage += event.key;
            }

            this.updateInputText();
        });
    }

    openDialogue(npcId: string, npcName: string) {
        this.currentNpcId = npcId;
        this.currentNpcName = npcName;
        this.isActive = true;
        this.currentMessage = '';
        this.chatLog = [];
        this.isWaitingForResponse = false;
        
        // Start conversation tracking
        this.conversationStartTime = Date.now();
        this.conversationHistory = [];
        
        if (this.dialogueContainer) {
            this.dialogueContainer.setVisible(true);
        }
        
        if (this.npcNameText) {
            this.npcNameText.setText(`Talking to ${npcName}`);
        }
        
        this.updateChatHistory();
        this.updateInputText();
        this.updateTypingIndicator();
        
        // Send conversation begin event
        this.sendConversationBeginEvent();
    }

    closeDialogue() {
        this.isActive = false;
        this.currentNpcId = null;
        this.currentNpcName = null;
        this.currentMessage = '';
        this.isWaitingForResponse = false;
        this.currentJobId = null;
        
        // Clear conversation tracking
        this.conversationStartTime = null;
        this.conversationHistory = [];
        
        if (this.dialogueContainer) {
            this.dialogueContainer.setVisible(false);
        }
        
        if (this.responseCheckTimer) {
            this.responseCheckTimer.destroy();
            this.responseCheckTimer = null;
        }

        // Emit close dialogue event
        this.scene.game.events.emit('closeDialogue');
    }

    endConversation() {
        if (!this.isActive || !this.currentNpcId) {
            return;
        }

        // Send conversation end event with full conversation history
        this.sendConversationEndEvent();
        
        // Close the dialogue
        this.closeDialogue();
    }

    private async sendMessage() {
        if (!this.currentMessage.trim() || this.isWaitingForResponse || !this.currentNpcId) {
            return;
        }

        const message = this.currentMessage.trim();
        this.currentMessage = '';
        this.isWaitingForResponse = true;
        
        // Add player message to chat log
        this.chatLog.push(`You: ${message}`);
        
        // Add to conversation history
        this.conversationHistory.push({
            message: message,
            sender: 'player',
            timestamp: Date.now()
        });
        
        this.updateChatHistory();
        this.updateInputText();
        this.updateTypingIndicator();

        try {
            // Send message to API
            const response = await fetch('http://localhost:3000/npc/interact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    npcId: this.currentNpcId,
                    message: message,
                    characterId: this.playerCharacterId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.currentJobId = data.jobId;
            
            // Start polling for response
            this.startPollingForResponse();

        } catch (error) {
            console.error('Error sending message:', error);
            this.chatLog.push(`System: Error sending message. Please try again.`);
            this.isWaitingForResponse = false;
            this.updateChatHistory();
            this.updateTypingIndicator();
        }
    }

    private startPollingForResponse() {
        if (!this.currentJobId) return;

        this.responseCheckTimer = this.scene.time.addEvent({
            delay: 1000,
            repeat: 30, // Check for up to 30 seconds
            callback: () => {
                this.checkForResponse();
            }
        });
    }

    private async checkForResponse() {
        if (!this.currentJobId) return;

        try {
            const response = await fetch(`http://localhost:3000/npc/conversation/${this.currentJobId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'completed') {
                this.chatLog.push(`${this.currentNpcName}: ${data.response.response}`);
                
                // Add NPC response to conversation history
                this.conversationHistory.push({
                    message: data.response.response,
                    sender: 'npc',
                    timestamp: Date.now()
                });
                
                this.isWaitingForResponse = false;
                this.currentJobId = null;
                
                if (this.responseCheckTimer) {
                    this.responseCheckTimer.destroy();
                    this.responseCheckTimer = null;
                }
                
                this.updateChatHistory();
                this.updateTypingIndicator();
            } else if (data.status === 'failed') {
                this.chatLog.push(`System: Error getting response. Please try again.`);
                this.isWaitingForResponse = false;
                this.currentJobId = null;
                
                if (this.responseCheckTimer) {
                    this.responseCheckTimer.destroy();
                    this.responseCheckTimer = null;
                }
                
                this.updateChatHistory();
                this.updateTypingIndicator();
            }
        } catch (error) {
            console.error('Error checking for response:', error);
        }
    }

    private updateInputText() {
        if (!this.inputText) return;
        
        if (this.isWaitingForResponse) {
            this.inputText.setText('Waiting for response...');
            this.inputText.setColor('#888888');
        } else if (this.currentMessage.length === 0) {
            this.inputText.setText('Type your message...');
            this.inputText.setColor('#CCCCCC');
        } else {
            this.inputText.setText(this.currentMessage);
            this.inputText.setColor('#FFFFFF');
        }
    }

    private updateChatHistory() {
        if (!this.chatHistory) return;
        
        // Show last 5 messages
        const displayMessages = this.chatLog.slice(-5).join('\n');
        this.chatHistory.setText(displayMessages);
    }

    private updateTypingIndicator() {
        if (!this.typingIndicator) return;
        
        if (this.isWaitingForResponse) {
            this.typingIndicator.setText(`${this.currentNpcName} is typing...`);
        } else {
            this.typingIndicator.setText('');
        }
    }

    isDialogueActive(): boolean {
        return this.isActive;
    }

    private sendConversationBeginEvent() {
        if (!this.currentNpcId || !this.playerCharacterId) return;
        
        console.log(`💬 [DIALOGUE] Conversation started with ${this.currentNpcName}`);
        
        // In the future, this could send an HTTP request to the server
        // to notify about conversation start
        // For now, we'll just log it
    }

    private sendConversationEndEvent() {
        if (!this.currentNpcId || !this.playerCharacterId || !this.conversationStartTime) return;
        
        const conversationDuration = Date.now() - this.conversationStartTime;
        
        console.log(`💬 [DIALOGUE] Conversation ended with ${this.currentNpcName} (duration: ${conversationDuration}ms)`);
        console.log(`💬 [DIALOGUE] Conversation history:`, this.conversationHistory);
        
        // Send conversation end event to server for post-conversation reflection
        this.sendConversationEndToServer();
    }

    private async sendConversationEndToServer() {
        if (!this.currentNpcId || !this.playerCharacterId || !this.conversationStartTime) return;
        
        try {
            const conversationData = {
                npcId: this.currentNpcId,
                npcName: this.currentNpcName,
                characterId: this.playerCharacterId,
                conversationHistory: this.conversationHistory,
                startTime: this.conversationStartTime,
                endTime: Date.now(),
                duration: Date.now() - this.conversationStartTime
            };
            
            // Send to server for post-conversation reflection
            const response = await fetch('http://localhost:3000/npc/conversation-end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(conversationData)
            });
            
            if (response.ok) {
                console.log(`💬 [DIALOGUE] Conversation data sent to server for reflection`);
            }
        } catch (error) {
            console.error('Error sending conversation end data:', error);
        }
    }


} 