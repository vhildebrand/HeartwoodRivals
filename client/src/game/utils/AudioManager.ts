// client/src/game/utils/AudioManager.ts
export class AudioManager {
    private static instance: AudioManager | null = null;
    private scene: Phaser.Scene | null = null;
    private currentBackgroundMusic: Phaser.Sound.BaseSound | null = null;
    private currentSceneMusic: Phaser.Sound.BaseSound | null = null;
    private backgroundVolume: number = 0.3;
    private sceneVolume: number = 0.4;
    private fadeTime: number = 1000; // 1 second fade time
    private userInteracted: boolean = false;
    private musicReadyToStart: boolean = false;
    
    // Background music cycling improvements
    private trackCompletionTimer: Phaser.Time.TimerEvent | null = null;
    private trackCheckInterval: number = 1000; // Check every second
    private lastTrackPosition: number = 0;
    private trackStuckCounter: number = 0;
    
    // Background music playlist (for walking around the city)
    private backgroundTracks = [
        'background_music_3', // Irisu Syndrome - About 10 Hours Looking At The Ceiling
        'speed_dating_music'  // Onys - Tranquility
    ];
    private currentTrackIndex = 0;

    private constructor() {}

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public initialize(scene: Phaser.Scene) {
        this.scene = scene;
        this.setupUserInteractionDetection();
        console.log("🎵 AudioManager initialized");
    }

    private setupUserInteractionDetection() {
        if (!this.scene) return;

        // Listen for any user input to enable audio
        const startMusicOnInteraction = () => {
            if (!this.userInteracted) {
                this.userInteracted = true;
                console.log("🎵 User interaction detected - audio enabled");
                
                if (this.musicReadyToStart) {
                    this.startBackgroundMusic();
                }
                
                // Remove listeners after first interaction
                this.scene?.input.off('pointerdown', startMusicOnInteraction);
                this.scene?.input.keyboard?.off('keydown', startMusicOnInteraction);
            }
        };

        // Listen for mouse clicks and keyboard input
        this.scene.input.on('pointerdown', startMusicOnInteraction);
        this.scene.input.keyboard?.on('keydown', startMusicOnInteraction);
    }

    public async startBackgroundMusic() {
        if (!this.scene) {
            console.warn("🎵 AudioManager not initialized with scene");
            return;
        }

        // Stop any existing background music
        this.stopBackgroundMusic();

        // If user hasn't interacted yet, mark music as ready to start and wait
        if (!this.userInteracted) {
            this.musicReadyToStart = true;
            console.log("🎵 Music ready - waiting for user interaction to comply with browser autoplay policy");
            console.log("🎵 Click anywhere or press any key to start music!");
            return;
        }

        try {
            // Start with first track
            this.playBackgroundTrack();
            this.musicReadyToStart = false;
        } catch (error) {
            console.warn("🎵 Could not start background music:", error);
            // Set flag to retry on next user interaction
            this.musicReadyToStart = true;
        }
    }

    private playBackgroundTrack() {
        if (!this.scene) return;

        const trackKey = this.backgroundTracks[this.currentTrackIndex];
        console.log(`🎵 Playing background track ${this.currentTrackIndex + 1}/${this.backgroundTracks.length}: ${trackKey}`);
        
        // Stop any existing timer
        this.stopCompletionTimer();
        
        this.currentBackgroundMusic = this.scene.sound.add(trackKey, {
            volume: this.backgroundVolume,
            loop: false // We'll handle looping manually to cycle through tracks
        });

        // Set up track completion handler (primary method)
        this.currentBackgroundMusic.once('complete', () => {
            console.log(`🎵 Track completed via 'complete' event: ${trackKey}`);
            this.playNextBackgroundTrack();
        });

        // Set up fallback completion detection system
        this.setupCompletionFallback();

        this.currentBackgroundMusic.play();
    }

    private setupCompletionFallback() {
        if (!this.scene || !this.currentBackgroundMusic) return;

        // Reset tracking variables
        this.lastTrackPosition = 0;
        this.trackStuckCounter = 0;

        // Set up periodic check for track completion
        this.trackCompletionTimer = this.scene.time.addEvent({
            delay: this.trackCheckInterval,
            callback: this.checkTrackCompletion,
            callbackScope: this,
            loop: true
        });
    }

    private checkTrackCompletion() {
        if (!this.currentBackgroundMusic || !this.scene) return;

        try {
            // Check if track is still playing
            if (!this.currentBackgroundMusic.isPlaying && !this.currentBackgroundMusic.isPaused) {
                console.log(`🎵 Track completion detected via fallback system`);
                this.stopCompletionTimer();
                this.playNextBackgroundTrack();
                return;
            }

            // Check if track position is progressing (detect if stuck)
            const currentPosition = (this.currentBackgroundMusic as any).seek || 0;
            if (currentPosition === this.lastTrackPosition) {
                this.trackStuckCounter++;
                // If stuck for more than 10 seconds, consider it completed
                if (this.trackStuckCounter >= 10) {
                    console.log(`🎵 Track appears stuck, forcing next track`);
                    this.stopCompletionTimer();
                    this.playNextBackgroundTrack();
                    return;
                }
            } else {
                this.trackStuckCounter = 0;
                this.lastTrackPosition = currentPosition;
            }

            // Additional check: if track has a duration and we're at/near the end
            const duration = (this.currentBackgroundMusic as any).duration || 0;
            if (duration > 0 && currentPosition >= duration - 1) {
                console.log(`🎵 Track completion detected via duration check`);
                this.stopCompletionTimer();
                this.playNextBackgroundTrack();
            }
        } catch (error) {
            console.warn(`🎵 Error checking track completion:`, error);
            // If we can't check the track state, try to continue anyway
            this.stopCompletionTimer();
            this.playNextBackgroundTrack();
        }
    }

    private stopCompletionTimer() {
        if (this.trackCompletionTimer) {
            this.trackCompletionTimer.remove();
            this.trackCompletionTimer = null;
        }
    }

    private playNextBackgroundTrack() {
        console.log(`🎵 Advancing from track ${this.currentTrackIndex + 1} to next track`);
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.backgroundTracks.length;
        console.log(`🎵 Next track index: ${this.currentTrackIndex + 1}/${this.backgroundTracks.length} (cycling: ${this.currentTrackIndex === 0 ? 'YES' : 'NO'})`);
        
        // Small delay before starting next track to avoid issues
        if (this.scene) {
            this.scene.time.delayedCall(500, () => {
                this.playBackgroundTrack();
            });
        }
    }

    public stopBackgroundMusic() {
        this.stopCompletionTimer();
        if (this.currentBackgroundMusic) {
            this.currentBackgroundMusic.stop();
            this.currentBackgroundMusic.destroy();
            this.currentBackgroundMusic = null;
            console.log(`🎵 Background music stopped`);
        }
    }

    public pauseBackgroundMusic() {
        if (this.currentBackgroundMusic && this.currentBackgroundMusic.isPlaying) {
            this.currentBackgroundMusic.pause();
        }
    }

    public resumeBackgroundMusic() {
        if (this.currentBackgroundMusic && this.currentBackgroundMusic.isPaused) {
            this.currentBackgroundMusic.resume();
        }
    }

    public fadeOutBackgroundMusic(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.currentBackgroundMusic) {
                resolve();
                return;
            }

            console.log("🎵 Fading out background music...");
            
            // Create a fade out effect using config parameter
            const fadeOut = { volume: this.backgroundVolume };
            this.scene?.tweens.add({
                targets: fadeOut,
                volume: 0,
                duration: this.fadeTime,
                onUpdate: () => {
                    (this.currentBackgroundMusic as any)?.setVolume?.(fadeOut.volume);
                },
                onComplete: () => {
                    // Completely stop background music instead of just pausing
                    this.stopBackgroundMusic();
                    console.log("🎵 Background music stopped");
                    resolve();
                }
            });
        });
    }

    public fadeInBackgroundMusic(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.currentBackgroundMusic) {
                console.log("🎵 No background music to fade in, starting fresh");
                this.playBackgroundTrack();
                resolve();
                return;
            }

            console.log("🎵 Fading in background music...");
            
            (this.currentBackgroundMusic as any)?.setVolume?.(0);
            this.resumeBackgroundMusic();
            
            const fadeIn = { volume: 0 };
            this.scene?.tweens.add({
                targets: fadeIn,
                volume: this.backgroundVolume,
                duration: this.fadeTime,
                onUpdate: () => {
                    (this.currentBackgroundMusic as any)?.setVolume?.(fadeIn.volume);
                },
                onComplete: () => {
                    console.log("🎵 Background music faded in");
                    resolve();
                }
            });
        });
    }

    public async playSceneMusic(trackKey: string, loop: boolean = true) {
        if (!this.scene) return;

        console.log(`🎵 Playing scene music: ${trackKey}`);
        
        // Stop any existing scene music
        this.stopSceneMusic();

        // Fade out background music and wait for it to complete
        await this.fadeOutBackgroundMusic();

        // Play scene-specific music after background music has faded out
        this.currentSceneMusic = this.scene.sound.add(trackKey, {
            volume: this.sceneVolume,
            loop: loop
        });

        this.currentSceneMusic.play();
        console.log(`🎵 Scene music started: ${trackKey}`);
    }

    public stopSceneMusic() {
        if (this.currentSceneMusic) {
            this.currentSceneMusic.stop();
            this.currentSceneMusic.destroy();
            this.currentSceneMusic = null;
        }
    }

    public async fadeOutSceneMusic(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.currentSceneMusic) {
                resolve();
                return;
            }

            console.log("🎵 Fading out scene music...");
            
            // Create fade out object to avoid tween target issues
            const fadeOut = { volume: this.sceneVolume };
            this.scene?.tweens.add({
                targets: fadeOut,
                volume: 0,
                duration: this.fadeTime,
                onUpdate: () => {
                    (this.currentSceneMusic as any)?.setVolume?.(fadeOut.volume);
                },
                onComplete: () => {
                    this.stopSceneMusic();
                    console.log("🎵 Scene music stopped");
                    resolve();
                }
            });
        });
    }

    public async returnToBackgroundMusic() {
        // Fade out scene music
        await this.fadeOutSceneMusic();
        
        // Restart background music since we stopped it completely
        if (!this.currentBackgroundMusic) {
            console.log("🎵 Restarting background music...");
            this.playBackgroundTrack();
        } else {
            // Fade in background music if it still exists
            await this.fadeInBackgroundMusic();
        }
        
        console.log("🎵 Returned to background music");
    }

    public setBackgroundVolume(volume: number) {
        this.backgroundVolume = Math.max(0, Math.min(1, volume));
        if (this.currentBackgroundMusic) {
            (this.currentBackgroundMusic as any)?.setVolume?.(this.backgroundVolume);
        }
    }

    public setSceneVolume(volume: number) {
        this.sceneVolume = Math.max(0, Math.min(1, volume));
        if (this.currentSceneMusic) {
            (this.currentSceneMusic as any)?.setVolume?.(this.sceneVolume);
        }
    }

    public getBackgroundVolume(): number {
        return this.backgroundVolume;
    }

    public getSceneVolume(): number {
        return this.sceneVolume;
    }

    public isBackgroundMusicPlaying(): boolean {
        return this.currentBackgroundMusic?.isPlaying || false;
    }

    public isSceneMusicPlaying(): boolean {
        return this.currentSceneMusic?.isPlaying || false;
    }

    public isMusicWaitingForInteraction(): boolean {
        return this.musicReadyToStart && !this.userInteracted;
    }

    public hasUserInteracted(): boolean {
        return this.userInteracted;
    }

    // Manual music start method for user-initiated start
    public manualStart() {
        if (!this.userInteracted) {
            this.userInteracted = true;
        }
        
        if (this.musicReadyToStart) {
            this.startBackgroundMusic();
        }
    }

    public cleanup() {
        this.stopBackgroundMusic();
        this.stopSceneMusic();
        console.log("🎵 AudioManager cleaned up");
    }
} 