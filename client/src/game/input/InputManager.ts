import { Scene } from "phaser";

export enum InputType {
    MOVE = "move",
    CLICK = "click",
    RIGHT_CLICK = "rightclick"
}

export interface InputCommand {
    type: InputType;
    data: any;
    timestamp: number;
    sequence: number;
}

export interface InputCallbacks {
    onMove?: (direction: string) => void;
    onMoveStart?: (direction: string) => void;
    onMoveStop?: (direction: string) => void;
    onMoveContinuous?: (directions: string[]) => void;
    onClick?: (clickData: any) => void;
    onRightClick?: (clickData: any) => void;
}

export class InputManager {
    private scene: Scene;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys: any;
    private lastInputState: any;
    private inputSequence: number = 0;
    private callbacks: InputCallbacks = {};

    constructor(scene: Scene) {
        this.scene = scene;
        this.setupKeyboard();
        this.setupMouse();
        this.initializeInputState();
    }

    public setCallbacks(callbacks: InputCallbacks) {
        this.callbacks = callbacks;
    }

    private setupKeyboard() {
        // Create cursor keys for arrow key input
        this.cursors = this.scene.input.keyboard!.createCursorKeys();
        
        // Create WASD keys for alternative input
        this.wasdKeys = this.scene.input.keyboard!.addKeys('W,S,A,D');
        
        console.log("InputManager: Keyboard handlers initialized");
    }

    private setupMouse() {
        // Add click handler for the entire game scene
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown()) {
                this.handleClick(pointer);
            } else if (pointer.rightButtonDown()) {
                this.handleRightClick(pointer);
            }
        });

        console.log("InputManager: Mouse handlers initialized");
    }

    private initializeInputState() {
        this.lastInputState = {
            up: false,
            down: false,
            left: false,
            right: false
        };
    }

    private handleClick(pointer: Phaser.Input.Pointer) {
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 16);
        const tileY = Math.floor(worldPoint.y / 16);

        const clickData = {
            screenX: pointer.x,
            screenY: pointer.y,
            worldX: worldPoint.x,
            worldY: worldPoint.y,
            tileX: tileX,
            tileY: tileY,
            button: 'left',
            timestamp: Date.now()
        };

        console.log(`[INPUT] Click: Screen(${pointer.x}, ${pointer.y}) -> World(${worldPoint.x}, ${worldPoint.y}) -> Tile(${tileX}, ${tileY})`);

        if (this.callbacks.onClick) {
            this.callbacks.onClick(clickData);
        }
    }

    private handleRightClick(pointer: Phaser.Input.Pointer) {
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 16);
        const tileY = Math.floor(worldPoint.y / 16);

        const clickData = {
            screenX: pointer.x,
            screenY: pointer.y,
            worldX: worldPoint.x,
            worldY: worldPoint.y,
            tileX: tileX,
            tileY: tileY,
            button: 'right',
            timestamp: Date.now()
        };

        console.log(`[INPUT] Right-Click: Screen(${pointer.x}, ${pointer.y}) -> World(${worldPoint.x}, ${worldPoint.y}) -> Tile(${tileX}, ${tileY})`);

        if (this.callbacks.onRightClick) {
            this.callbacks.onRightClick(clickData);
        }
    }

    private getInputState(): any {
        return {
            up: this.cursors.up.isDown || this.wasdKeys.W.isDown,
            down: this.cursors.down.isDown || this.wasdKeys.S.isDown,
            left: this.cursors.left.isDown || this.wasdKeys.A.isDown,
            right: this.cursors.right.isDown || this.wasdKeys.D.isDown
        };
    }

    public update() {
        const currentInput = this.getInputState();
        
        // Check for input changes
        ['up', 'down', 'left', 'right'].forEach(direction => {
            if (currentInput[direction] && !this.lastInputState[direction]) {
                // Key was just pressed
                console.log(`[INPUT] Key pressed: ${direction}`);
                
                if (this.callbacks.onMoveStart) {
                    this.callbacks.onMoveStart(direction);
                }
                
                // Backward compatibility
                if (this.callbacks.onMove) {
                    this.callbacks.onMove(direction);
                }
            } else if (!currentInput[direction] && this.lastInputState[direction]) {
                // Key was just released
                console.log(`[INPUT] Key released: ${direction}`);
                
                if (this.callbacks.onMoveStop) {
                    this.callbacks.onMoveStop(direction);
                }
            }
        });
        
        // Check for continuous movement (keys held down)
        const activeDirections = ['up', 'down', 'left', 'right'].filter(direction => 
            currentInput[direction]
        );
        
        if (activeDirections.length > 0) {
            if (this.callbacks.onMoveContinuous) {
                this.callbacks.onMoveContinuous(activeDirections);
            }
        }
        
        // Update last input state
        this.lastInputState = { ...currentInput };
    }

    public destroy() {
        // Clean up event listeners
        this.scene.input.off('pointerdown');
        console.log("InputManager: Destroyed");
    }
}