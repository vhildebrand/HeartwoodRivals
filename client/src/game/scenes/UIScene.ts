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

        // Create debug panel (initially hidden)
        this.createDebugPanel();

        // Initialize dialogue manager
        this.dialogueManager = new DialogueManager(this);

        // Listen for player ID updates from GameScene
        this.game.events.on('playerIdSet', (playerId: string) => {
            console.log(`👤 [UI] Setting player character ID: ${playerId}`);
            this.dialogueManager?.setPlayerCharacterId(playerId);
        });

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

        console.log("🎮 [UI] UIScene created and running in parallel with clock display");
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
        // Create debug panel container (made wider and taller)
        this.debugPanel = this.add.container(this.cameras.main.width - 450, 60);
        
        // Background (made wider and taller)
        this.debugPanelBackground = this.add.rectangle(0, 0, 440, 500, 0x000000, 0.8);
        this.debugPanelBackground.setOrigin(0, 0);
        this.debugPanelBackground.setStrokeStyle(2, 0x444444);
        
        // Title
        this.debugPanelTitle = this.add.text(10, 10, "Debug Panel - Character Status", {
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