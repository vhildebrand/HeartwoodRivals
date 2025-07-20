import { SpawnedAgent } from './AgentSpawner';
import { WorldLocationRegistry } from './WorldLocationRegistry';

interface SpeedDatingEvent {
  id: number;
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  location: string;
  seasonTheme?: string;
  participants: EventParticipant[];
  matches: SpeedDatingMatch[];
}

interface EventParticipant {
  id: number;
  eventId: number;
  participantType: 'player' | 'npc';
  participantId: string;
  attendanceStatus: 'registered' | 'present' | 'absent';
}

interface SpeedDatingMatch {
  id: number;
  eventId: number;
  playerId: string;
  npcId: string;
  matchOrder: number;
  startTime?: Date;
  endTime?: Date;
  durationSeconds: number;
  status: 'scheduled' | 'active' | 'completed' | 'skipped';
  round: number; // Add round number for rotation
}

interface VibeScoreEntry {
  matchId: number;
  playerMessage: string;
  npcResponse?: string;
  vibeScore: number;
  vibeReason: string;
  keywordMatches: string[];
  timestamp: Date;
}

export class SpeedDatingManager {
  private agents: Map<string, SpawnedAgent>;
  private broadcastCallback: (eventType: string, data: any, targetPlayer?: string) => void;
  private currentEvent: SpeedDatingEvent | null = null;
  private currentMatch: SpeedDatingMatch | null = null;
  private activeMatches: Map<string, SpeedDatingMatch> = new Map(); // Track active matches per player
  private vibeScores: Map<number, VibeScoreEntry[]> = new Map();
  private eventTimer: NodeJS.Timeout | null = null;
  private matchTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private isCountingDown: boolean = false;
  private eventStartCountdown: number = 0;
  private countdownEndTime: number = 0; // Store the end time for countdown synchronization
  private pausedActivities: Map<string, any> = new Map();
  private currentRound: number = 0; // Track current round
  private maxRounds: number = 0; // Maximum number of rounds
  private matchIdCounter: number = 1; // Counter for generating unique match IDs

  // Dating-specific configuration (using real-world time, not game time)
  private readonly DEFAULT_DATE_DURATION = 90 * 1000; // 90 seconds in real-world milliseconds
  private readonly COUNTDOWN_DURATION = 10 * 1000; // 10 seconds in real-world milliseconds
  private readonly VIBE_KEYWORDS = {
    positive: ['love', 'like', 'enjoy', 'fun', 'great', 'amazing', 'wonderful', 'beautiful', 'interesting', 'exciting'],
    negative: ['hate', 'dislike', 'boring', 'terrible', 'awful', 'disgusting', 'annoying', 'stupid', 'waste', 'pointless'],
    romantic: ['romantic', 'love', 'heart', 'soul', 'beautiful', 'gorgeous', 'handsome', 'attraction', 'chemistry', 'spark'],
    intellectual: ['think', 'philosophy', 'ideas', 'knowledge', 'learning', 'books', 'wisdom', 'understand', 'analyze'],
    adventure: ['adventure', 'explore', 'travel', 'excitement', 'risk', 'new', 'discover', 'journey', 'challenge'],
    family: ['family', 'children', 'home', 'future', 'together', 'commitment', 'marriage', 'settle', 'build']
  };

  constructor(agents: Map<string, SpawnedAgent>, broadcastCallback: (eventType: string, data: any, targetPlayer?: string) => void, private getPlayerName?: (playerId: string) => string) {
    this.agents = agents;
    this.broadcastCallback = broadcastCallback;
  }

  /**
   * Initialize a speed dating event
   */
  async initializeEvent(eventData: Partial<SpeedDatingEvent>, currentPlayerCount?: number): Promise<void> {
    console.log(`🌹 [SPEED_DATING] Initializing event: ${eventData.eventName}`);
    
    try {
      // Set maxRounds based on current player count when event is created
      if (currentPlayerCount && currentPlayerCount > 0) {
        this.maxRounds = currentPlayerCount;
        console.log(`📊 [SPEED_DATING] Setting maxRounds to ${this.maxRounds} based on current player count`);
      } else {
        this.maxRounds = 1; // Fallback
        console.log(`⚠️ [SPEED_DATING] Using fallback maxRounds of ${this.maxRounds}`);
      }
      
      // Store event data
      this.currentEvent = {
        id: eventData.id || Date.now(),
        eventName: eventData.eventName || 'Speed Dating Gauntlet',
        eventDate: eventData.eventDate || new Date().toISOString().split('T')[0],
        startTime: eventData.startTime || '19:00',
        endTime: eventData.endTime || '21:00',
        maxParticipants: eventData.maxParticipants || 10,
        status: 'scheduled',
        location: eventData.location || 'town_square',
        seasonTheme: eventData.seasonTheme,
        participants: [],
        matches: []
      };

      console.log(`✅ [SPEED_DATING] Event initialized: ${this.currentEvent.eventName}, maxRounds: ${this.maxRounds}`);
      
      // Notify web API about event creation
      // await this.notifyWebAPI('event_created', {
      //   eventId: this.currentEvent.id,
      //   eventData: this.currentEvent
      // });
      
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error initializing event:', error);
      throw error;
    }
  }

  /**
   * Register a player for the current event
   */
  async registerPlayer(playerId: string): Promise<boolean> {
    if (!this.currentEvent) {
      console.warn('⚠️ [SPEED_DATING] No active event to register player for');
      return false;
    }

    if (this.currentEvent.participants.length >= this.currentEvent.maxParticipants) {
      console.warn('⚠️ [SPEED_DATING] Event is full, cannot register player');
      return false;
    }

    // Check if player is already registered
    const isAlreadyRegistered = this.currentEvent.participants.some(
      p => p.participantId === playerId && p.participantType === 'player'
    );

    if (isAlreadyRegistered) {
      console.warn('⚠️ [SPEED_DATING] Player already registered for event');
      return false;
    }

    // Register player
    const participant: EventParticipant = {
      id: Date.now(),
      eventId: this.currentEvent.id,
      participantType: 'player',
      participantId: playerId,
      attendanceStatus: 'registered'
    };

    this.currentEvent.participants.push(participant);
    
    console.log(`✅ [SPEED_DATING] Player ${playerId} registered for event`);
    
    // Notify web API
    await this.notifyWebAPI('player_registered', {
      eventId: this.currentEvent.id,
      playerId,
      participantCount: this.currentEvent.participants.length
    });

    return true;
  }

  /**
   * Register NPCs for the current event
   */
  async registerNPCs(npcIds: string[]): Promise<void> {
    if (!this.currentEvent) {
      console.warn('⚠️ [SPEED_DATING] No active event to register NPCs for');
      return;
    }

    for (const npcId of npcIds) {
      // Check if NPC is already registered
      const isAlreadyRegistered = this.currentEvent.participants.some(
        p => p.participantId === npcId && p.participantType === 'npc'
      );

      if (isAlreadyRegistered) {
        console.warn(`⚠️ [SPEED_DATING] NPC ${npcId} already registered for event`);
        continue;
      }

      // Register NPC
      const participant: EventParticipant = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        eventId: this.currentEvent.id,
        participantType: 'npc',
        participantId: npcId,
        attendanceStatus: 'registered'
      };

      this.currentEvent.participants.push(participant);
      console.log(`✅ [SPEED_DATING] NPC ${npcId} registered for event`);
    }

    // Notify web API
    await this.notifyWebAPI('npcs_registered', {
      eventId: this.currentEvent.id,
      npcIds,
      participantCount: this.currentEvent.participants.length
    });
  }

  /**
   * Start the countdown before the event begins
   */
  async startCountdown(): Promise<void> {
    if (!this.currentEvent) {
      console.warn('⚠️ [SPEED_DATING] No active event to start countdown for');
      return;
    }

    // Prevent multiple countdowns
    if (this.isCountingDown || this.countdownTimer !== null) {
      console.warn('⚠️ [SPEED_DATING] Countdown already in progress, skipping new countdown');
      return;
    }

    console.log(`⏰ [SPEED_DATING] Starting countdown for event: ${this.currentEvent.eventName}`);
    
    this.isCountingDown = true;
    this.eventStartCountdown = this.COUNTDOWN_DURATION / 1000; // Convert to seconds
    this.countdownEndTime = Date.now() + this.COUNTDOWN_DURATION; // Store the end time

    // Broadcast countdown start to all players
    await this.broadcastEvent('speed_dating_countdown', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName,
      countdownSeconds: this.eventStartCountdown,
      countdownEndTime: this.countdownEndTime,
      location: this.currentEvent.location
    });

    // Start countdown timer with proper cleanup
    this.countdownTimer = setInterval(async () => {
      this.eventStartCountdown--;
      
      console.log(`⏰ [SPEED_DATING] Countdown: ${this.eventStartCountdown} seconds remaining`);
      
      // Broadcast countdown update to all players
      await this.broadcastEvent('speed_dating_countdown', {
        eventId: this.currentEvent?.id || 0,
        remainingSeconds: this.eventStartCountdown,
        countdownEndTime: this.countdownEndTime
      });

      if (this.eventStartCountdown <= 0) {
        this.clearCountdownTimer();
        this.isCountingDown = false;
        await this.startEvent();
      }
    }, 1000); // Use real-world seconds, not affected by game time multiplier
  }

  /**
   * Clear the countdown timer
   */
  private clearCountdownTimer(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      console.log('🔄 [SPEED_DATING] Cleared countdown timer');
    }
  }

  /**
   * Start the speed dating event
   */
  async startEvent(): Promise<void> {
    if (!this.currentEvent) {
      console.warn('⚠️ [SPEED_DATING] No active event to start');
      return;
    }

    console.log(`🎯 [SPEED_DATING] Starting event: ${this.currentEvent.eventName}`);
    
    this.currentEvent.status = 'active';
    
    // Pause regular NPC activities
    await this.pauseNPCActivities();
    
    // Move all participants to the event location
    await this.moveParticipantsToLocation();
    
    // Create speed dating matches
    await this.createMatches();
    
    // Broadcast event start
    await this.broadcastEvent('speed_dating_start', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName,
      location: this.currentEvent.location,
      participantCount: this.currentEvent.participants.length,
      matchCount: this.currentEvent.matches.length
    });

    // Start the first match after a 3-second delay for UI setup
    if (this.currentEvent.matches.length > 0) {
      console.log(`⏱️ [SPEED_DATING] Starting first match in 3 seconds...`);
      this.eventTimer = setTimeout(async () => {
        await this.startNextMatch();
      }, 3000);
    }
  }

  /**
   * Create speed dating matches for the event
   */
  private async createMatches(): Promise<void> {
    if (!this.currentEvent) return;

    const players = this.currentEvent.participants.filter(p => p.participantType === 'player');
    const npcs = this.currentEvent.participants.filter(p => p.participantType === 'npc');

    if (players.length === 0) {
      console.warn('⚠️ [SPEED_DATING] No players registered for speed dating event');
      return;
    }

    if (npcs.length === 0) {
      console.warn('⚠️ [SPEED_DATING] No NPCs registered for speed dating event');
      return;
    }

    // Calculate total rounds - each player should meet each NPC exactly once
    // Since we now select exactly as many NPCs as players, both should be equal
    this.maxRounds = npcs.length;
    
    if (players.length !== npcs.length) {
      console.warn(`⚠️ [SPEED_DATING] Player count (${players.length}) doesn't match NPC count (${npcs.length}). Using NPC count for rounds.`);
    }

    // Create rotation schedule
    for (let round = 0; round < this.maxRounds; round++) {
      for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const player = players[playerIndex];
        
        // Rotate NPCs so each player gets a different NPC each round
        const npcIndex = (playerIndex + round) % npcs.length;
        const npc = npcs[npcIndex];
        
        const match: SpeedDatingMatch = {
          id: this.currentEvent.id * 10000 + this.matchIdCounter++,
          eventId: this.currentEvent.id,
          playerId: player.participantId,
          npcId: npc.participantId,
          matchOrder: round + 1,
          round: round + 1,
          durationSeconds: this.DEFAULT_DATE_DURATION / 1000,
          status: 'scheduled'
        };

        this.currentEvent.matches.push(match);
        
        // Initialize vibe scores for this match
        this.vibeScores.set(match.id, []);
      }
    }

    console.log(`📋 [SPEED_DATING] Created ${this.currentEvent.matches.length} matches: ${players.length} players × ${npcs.length} NPCs = ${this.maxRounds} rounds`);
    
    // Store matches in database via web API
    await this.storeMatchesInDatabase();
  }

  /**
   * Store matches in database via web API
   */
  private async storeMatchesInDatabase(): Promise<void> {
    if (!this.currentEvent) return;

    try {
      // Send the entire event object with matches included for atomic processing
      await this.notifyWebAPI('speed_dating_initialized', {
        event: this.currentEvent
      });
      console.log(`✅ [SPEED_DATING] Sent initialization data for event ${this.currentEvent.id} to web API`);
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error storing matches in database:', error);
    }
  }

  /**
   * Start the next speed dating match
   */
  private async startNextMatch(): Promise<void> {
    if (!this.currentEvent) {
      console.warn('⚠️ [SPEED_DATING] No active event to start match for');
      return;
    }

    // Clear any active matches that are completed
    for (const [playerId, match] of this.activeMatches) {
      if (match.status === 'completed') {
        this.activeMatches.delete(playerId);
      }
    }

    // Check if we need to move to the next round
    const scheduledMatches = this.currentEvent.matches.filter(m => m.status === 'scheduled');
    if (scheduledMatches.length === 0) {
      // No more matches, event is complete
      console.log('🎉 [SPEED_DATING] All matches completed, ending event');
      await this.completeEvent();
      return;
    }

    // Get the next round number
    const nextRound = Math.min(...scheduledMatches.map(m => m.round));
    
    // Start all matches for the current round
    const roundMatches = scheduledMatches.filter(m => m.round === nextRound);
    
    console.log(`🔄 [SPEED_DATING] Starting round ${nextRound} with ${roundMatches.length} matches`);
    this.currentRound = nextRound;

    for (const match of roundMatches) {
      match.status = 'active';
      match.startTime = new Date();
      
      // Track active match for each player
      this.activeMatches.set(match.playerId, match);
      
      // Send match start to specific player only
      await this.broadcastEvent('speed_dating_match_start', {
        eventId: this.currentEvent.id,
        matchId: match.id,
        playerId: match.playerId,
        npcId: match.npcId,
        matchOrder: match.matchOrder,
        round: match.round,
        duration: match.durationSeconds,
        npcName: match.npcId,
        totalRounds: this.maxRounds
      }, match.playerId);
      
      console.log(`💕 [SPEED_DATING] Started match for player ${match.playerId} with NPC ${match.npcId} (Round ${match.round})`);
    }

    // Set a single timer for all matches in this round
    console.log(`⏱️ [SPEED_DATING] Setting round timer for ${roundMatches[0].durationSeconds} seconds`);
    this.matchTimer = setTimeout(async () => {
      console.log(`⏰ [SPEED_DATING] Round ${nextRound} timer expired`);
      await this.endCurrentRound();
    }, roundMatches[0].durationSeconds * 1000);
  }

  /**
   * End all matches in the current round
   */
  private async endCurrentRound(): Promise<void> {
    console.log(`⏰ [SPEED_DATING] Ending round ${this.currentRound}`);
    
    // End all active matches
    for (const [playerId, match] of this.activeMatches) {
      match.status = 'completed';
      match.endTime = new Date();
      
      // Send match end to specific player only
      await this.broadcastEvent('speed_dating_match_end', {
        eventId: this.currentEvent?.id || 0,
        matchId: match.id,
        playerId: match.playerId,
        npcId: match.npcId,
        matchOrder: match.matchOrder,
        round: match.round
      }, match.playerId);
      
      // Trigger post-date assessment
      await this.triggerPostDateAssessment(match);
    }
    
    // Clear active matches
    this.activeMatches.clear();
    
    // Clear match timer
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
    }
    
    console.log(`⏸️ [SPEED_DATING] Round ${this.currentRound} ended, waiting 5 seconds before next round...`);
    
    // Start next round after a brief pause
    setTimeout(async () => {
      console.log(`🔄 [SPEED_DATING] Starting next round after pause...`);
      await this.startNextMatch();
    }, 5000); // 5 second pause between rounds
  }

  /**
   * Process a conversation message during a speed date
   */
  async processDateConversation(playerId: string, message: string, npcResponse?: string): Promise<void> {
    // Get the player's active match
    const currentMatch = this.activeMatches.get(playerId);
    
    if (!currentMatch) {
      console.warn(`⚠️ [SPEED_DATING] No active match for player ${playerId}`);
      return;
    }

    console.log(`💬 [SPEED_DATING] Processing message from ${playerId} to ${currentMatch.npcId}: "${message}"`);

    // Build chat history for this match
    const chatHistory = this.buildChatHistory(currentMatch.id);
    const cumulativeVibeScore = this.calculateCumulativeVibeScore(currentMatch.id);

    // If no NPC response provided, request one from the web API (now includes vibe evaluation)
    let responseData: any = {};
    if (!npcResponse) {
      try {
        responseData = await this.requestNPCResponse(playerId, message, currentMatch.npcId, chatHistory, cumulativeVibeScore);
        npcResponse = responseData.response;
      } catch (error) {
        console.error('❌ [SPEED_DATING] Failed to get NPC response:', error);
        npcResponse = "I'm having trouble responding right now.";
        responseData = {
          response: npcResponse,
          vibeData: { vibeScore: 0, vibeReason: 'System error', attractionFactors: [], turnOffFactors: [], emotionalReaction: 'Confused' }
        };
      }
    }

    // Send NPC response to specific player only
    console.log(`📢 [SPEED_DATING] Sending NPC response to player ${playerId} for match ${currentMatch.id}: "${npcResponse}"`);
    await this.broadcastEvent('speed_dating_npc_response', {
      eventId: this.currentEvent?.id || 0,
      matchId: currentMatch.id,
      playerId: playerId,
      npcId: currentMatch.npcId,
      npcName: currentMatch.npcId,
      message: npcResponse,
      timestamp: Date.now()
    }, playerId);

    // Extract vibe data from the response (now included in single LLM call)
    const vibeData = responseData.vibeData || { vibeScore: 0, vibeReason: 'No evaluation', attractionFactors: [], turnOffFactors: [], emotionalReaction: 'Neutral' };
    
    console.log(`💝 [SPEED_DATING] LLM evaluation: ${vibeData.vibeScore}/10 - ${vibeData.vibeReason}`);
    
    // Create vibe score entry
    const vibeEntry: VibeScoreEntry = {
      matchId: currentMatch.id,
      playerMessage: message,
      npcResponse,
      vibeScore: vibeData.vibeScore,
      vibeReason: vibeData.vibeReason,
      keywordMatches: vibeData.attractionFactors || [],
      timestamp: new Date()
    };

    // Store vibe score
    const matchVibes = this.vibeScores.get(currentMatch.id) || [];
    matchVibes.push(vibeEntry);
    this.vibeScores.set(currentMatch.id, matchVibes);

    // Send vibe update to specific player
    await this.broadcastEvent('speed_dating_vibe_update', {
      eventId: this.currentEvent?.id || 0,
      matchId: currentMatch.id,
      playerId,
      vibeScore: vibeData.vibeScore,
      vibeReason: vibeData.vibeReason,
      cumulativeScore: this.calculateCumulativeVibeScore(currentMatch.id),
      attractionFactors: vibeData.attractionFactors,
      turnOffFactors: vibeData.turnOffFactors,
      emotionalReaction: vibeData.emotionalReaction
    }, playerId);

    // Notify web API for storage
    await this.notifyWebAPI('vibe_score_recorded', {
      matchId: currentMatch.id,
      vibeEntry
    });
    
    // Also store conversation memories (similar to normal conversations)
    await this.storeSpeedDatingConversationMemory(currentMatch, playerId, message, npcResponse || "Error: No response generated");
  }

  /**
   * Calculate cumulative vibe score for a match
   */
  private calculateCumulativeVibeScore(matchId: number): number {
    const vibes = this.vibeScores.get(matchId) || [];
    const totalScore = vibes.reduce((sum, vibe) => sum + vibe.vibeScore, 0);
    return Math.max(-100, Math.min(100, totalScore));
  }
  
  /**
   * Store conversation memory during speed dating
   */
  private async storeSpeedDatingConversationMemory(
    match: SpeedDatingMatch, 
    playerId: string, 
    playerMessage: string, 
    npcResponse: string
  ): Promise<void> {
    try {
      // Notify web API to store the conversation as memories
      await this.notifyWebAPI('speed_dating_conversation_memory', {
        matchId: match.id,
        npcId: match.npcId,
        playerId: playerId,
        playerMessage: playerMessage,
        npcResponse: npcResponse,
        eventContext: {
          eventId: this.currentEvent?.id,
          eventName: this.currentEvent?.eventName,
          matchOrder: match.matchOrder,
          round: match.round
        }
      });
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error storing conversation memory:', error);
      // Don't throw - memory storage failure shouldn't break speed dating
    }
  }

  /**
   * Trigger post-date assessment via web API
   */
  private async triggerPostDateAssessment(match: SpeedDatingMatch): Promise<void> {
    const conversation = this.buildConversationTranscript(match.id);
    
    await this.notifyWebAPI('post_date_assessment', {
      matchId: match.id,
      playerId: match.playerId,
      npcId: match.npcId,
      conversationTranscript: conversation,
      vibeScores: this.vibeScores.get(match.id) || []
    });
  }

  /**
   * Build conversation transcript for a match
   */
  private buildConversationTranscript(matchId: number): string {
    const vibes = this.vibeScores.get(matchId) || [];
    return vibes.map(vibe => 
      `Player: ${vibe.playerMessage}\n${vibe.npcResponse ? `NPC: ${vibe.npcResponse}` : ''}`
    ).join('\n\n');
  }

  /**
   * Build chat history for LLM context
   */
  private buildChatHistory(matchId: number): any[] {
    const vibes = this.vibeScores.get(matchId) || [];
    return vibes.map(vibe => ({
      playerMessage: vibe.playerMessage,
      npcMessage: vibe.npcResponse,
      vibeScore: vibe.vibeScore,
      vibeReason: vibe.vibeReason
    }));
  }

  /**
   * Complete the speed dating event
   */
  private async completeEvent(): Promise<void> {
    if (!this.currentEvent) return;

    console.log(`🎉 [SPEED_DATING] Completing event: ${this.currentEvent.eventName}`);
    
    this.currentEvent.status = 'completed';
    
    // Clear any remaining timers
    this.clearAllTimers();

    // Broadcast event completion to all players
    await this.broadcastEvent('speed_dating_complete', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName,
      totalMatches: this.currentEvent.matches.length
    });

    // Send a loading message to all players
    await this.broadcastEvent('speed_dating_results', {
      loading: true,
      message: 'NPCs are reflecting on their dates. Results will appear shortly...'
    });

    // Trigger post-gauntlet NPC reflections
    await this.triggerPostGauntletReflections();

    // Resume normal NPC activities - do this after a delay to ensure stability
    setTimeout(async () => {
      try {
        await this.resumeNPCActivities();
        console.log(`✅ [SPEED_DATING] Resumed NPC activities`);
      } catch (error) {
        console.error('❌ [SPEED_DATING] Error resuming NPC activities:', error);
      }
    }, 2000); // Give 2 seconds for everything to settle

    // Store event ID for cleanup
    const eventId = this.currentEvent.id;
    
    // Wait a bit for reflections to complete before clearing data
    setTimeout(() => {
      // Clean up - but check if we're not processing a new event
      if (this.currentEvent && this.currentEvent.id === eventId) {
        this.currentEvent = null;
        this.vibeScores.clear();
        this.activeMatches.clear(); // Also clear active matches
        this.pausedActivities.clear(); // Clear paused activities
        console.log(`🧹 [SPEED_DATING] Cleaned up event data for event ${eventId}`);
      }
    }, 30000); // Give 30 seconds for all processing to complete
    
    console.log(`✅ [SPEED_DATING] Event completed successfully`);
  }

  /**
   * Trigger post-gauntlet NPC reflections
   */
  private async triggerPostGauntletReflections(): Promise<void> {
    if (!this.currentEvent) return;

    // Get only NPCs who actually had matches (not all registered NPCs)
    const npcIds = [...new Set(this.currentEvent.matches.map(m => m.npcId))];
    console.log(`💭 [SPEED_DATING] Processing reflections for ${npcIds.length} NPCs who had matches: ${npcIds.join(', ')}`);
    
    // Process reflections only for NPCs who had matches
    const reflectionPromises = npcIds.map(npcId => {
      const npcMatches = this.currentEvent!.matches.filter(m => m.npcId === npcId);
      
      // Add player names to matches for better processing
      const matchesWithPlayerNames = npcMatches.map(match => ({
        ...match,
        playerName: this.getPlayerName ? this.getPlayerName(match.playerId) : match.playerId
      }));
      
      console.log(`💭 [SPEED_DATING] NPC ${npcId} had ${npcMatches.length} matches with players: ${matchesWithPlayerNames.map(m => m.playerName).join(', ')}`);
      
      return this.notifyWebAPI('post_gauntlet_reflection', {
        eventId: this.currentEvent!.id,
        npcId: npcId,
        matches: matchesWithPlayerNames,
        vibeScores: npcMatches.map(m => ({
          matchId: m.id,
          scores: this.vibeScores.get(m.id) || []
        }))
      });
    });
    
    // Wait for all reflections to complete
    await Promise.allSettled(reflectionPromises);
    
    console.log(`✅ [SPEED_DATING] All NPC reflections completed`);
    
    // After reflections are done, fetch and broadcast results to all players
    // Give much more time for LLM processing and database writes
    setTimeout(async () => {
      // Only fetch results if the event is still valid
      if (this.currentEvent) {
        await this.fetchAndBroadcastResults();
      } else {
        console.warn('⚠️ [SPEED_DATING] Event was cleared before results could be fetched');
      }
    }, 20000); // Give the web API 20 seconds to process reflections (increased from 8)
  }

  /**
   * Pause NPC activities during the event
   */
  private async pauseNPCActivities(): Promise<void> {
    if (!this.currentEvent) return;

    const npcParticipants = this.currentEvent.participants.filter(p => p.participantType === 'npc');
    
    for (const participant of npcParticipants) {
      const agent = this.agents.get(participant.participantId);
      if (agent) {
                 // Store current activity state
         const currentActivity = agent.activityManager.getCurrentActivity();
         if (currentActivity) {
           this.pausedActivities.set(participant.participantId, currentActivity);
         }
         
         // Complete current activity to effectively pause
         agent.activityManager.completeCurrentActivity();
        console.log(`⏸️ [SPEED_DATING] Paused activities for ${participant.participantId}`);
      }
    }
  }

  /**
   * Resume NPC activities after the event
   */
  private async resumeNPCActivities(): Promise<void> {
    for (const [agentId, pausedActivity] of this.pausedActivities) {
      const agent = this.agents.get(agentId);
      if (agent) {
        // Optionally restore the paused activity
        if (pausedActivity && pausedActivity.name) {
          try {
            agent.activityManager.requestActivity({
              activityName: pausedActivity.name,
              priority: pausedActivity.priority || 1
            });
          } catch (error) {
            console.error(`❌ [SPEED_DATING] Error resuming activity for ${agentId}:`, error);
            // Continue with other NPCs even if one fails
          }
        } else {
          console.log(`⚠️ [SPEED_DATING] No valid activity to resume for ${agentId}`);
        }
        
        console.log(`▶️ [SPEED_DATING] Processed activity resume for ${agentId}`);
      }
    }
    
    this.pausedActivities.clear();
  }

  /**
   * Move all participants to the event location
   */
  private async moveParticipantsToLocation(): Promise<void> {
    if (!this.currentEvent) return;

    const locationRegistry = WorldLocationRegistry.getInstance();
    const location = locationRegistry.getLocation(this.currentEvent.location);
    if (!location) {
      console.warn(`⚠️ [SPEED_DATING] Unknown event location: ${this.currentEvent.location}`);
      return;
    }

    for (const participant of this.currentEvent.participants) {
      if (participant.participantType === 'npc') {
        const agent = this.agents.get(participant.participantId);
        if (agent) {
          agent.activityManager.requestActivity({
            activityName: 'goto_location',
            priority: 10,
            parameters: {
              target: this.currentEvent.location,
              reason: 'Speed dating event'
            }
          });
        }
      }
    }
  }

  /**
   * Broadcast event to all clients or a specific player
   */
  private async broadcastEvent(eventType: string, data: any, targetPlayer?: string): Promise<void> {
    if (targetPlayer) {
      console.log(`📢 [SPEED_DATING] Sending ${eventType} to player ${targetPlayer}:`, data);
    } else {
      console.log(`📢 [SPEED_DATING] Broadcasting ${eventType} to all players:`, data);
    }
    
    // Use the broadcast callback from HeartwoodRoom
    this.broadcastCallback(eventType, data, targetPlayer);
  }

  /**
   * Request NPC response from web API
   */
  private async requestNPCResponse(playerId: string, message: string, npcId: string, chatHistory: any[], cumulativeVibeScore: number): Promise<any> {
    try {
      console.log(`🤖 [SPEED_DATING] Requesting NPC response from ${npcId} for message: "${message}"`);
      
      // Get the current match for this player
      const currentMatch = this.activeMatches.get(playerId);
      if (!currentMatch) {
        throw new Error(`No active match found for player ${playerId}`);
      }
      
      const response = await fetch('http://web-api:3000/npc/interact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          npcId,
          message,
          characterId: playerId, // Use player ID as character ID for speed dating
          context: 'speed_dating', // Add speed dating context
          contextDetails: {
            matchOrder: currentMatch.matchOrder,
            timeRemaining: currentMatch.durationSeconds,
            eventName: this.currentEvent?.eventName || 'Speed Dating Event',
            chatHistory,
            cumulativeVibeScore
          }
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as any;
      
      if (result.status === 'processing') {
        // Poll for the result since it's async
        const jobId = result.jobId;
        return await this.pollForNPCResponse(jobId);
      } else {
        throw new Error(`Unexpected response status: ${result.status}`);
      }
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error requesting NPC response:', error);
      throw error;
    }
  }

  /**
   * Poll for NPC response completion
   */
  private async pollForNPCResponse(jobId: string): Promise<any> {
    const maxAttempts = 20; // 20 seconds max wait
    const pollInterval = 1000; // 1 second intervals

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://web-api:3000/npc/conversation/${jobId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json() as any;
        
        if (result.status === 'completed') {
          console.log(`✅ [SPEED_DATING] Got NPC response: "${result.response.response}"`);
          return result.response;
        } else if (result.status === 'failed') {
          throw new Error(`NPC response failed: ${result.error}`);
        }

        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`❌ [SPEED_DATING] Error polling for NPC response (attempt ${attempt + 1}):`, error);
        
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('Timeout waiting for NPC response');
  }

  /**
   * Notify web API of events
   */
  private async notifyWebAPI(eventType: string, data: any): Promise<void> {
    try {
      // Use longer timeout for reflection events which involve LLM processing
      const timeout = eventType === 'post_gauntlet_reflection' ? 30000 : 10000;
      
      const response = await fetch('http://web-api:3000/dating/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: eventType,
          data
        }),
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        console.warn(`⚠️ [SPEED_DATING] Web API responded with status ${response.status} for event ${eventType}`);
        return;
      }
      
      console.log(`✅ [SPEED_DATING] Successfully notified web API of ${eventType}`);
    } catch (error) {
      // Log the error but don't throw - speed dating should continue even if web API is down
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [SPEED_DATING] Failed to notify web API of ${eventType}:`, errorMessage);
      console.warn(`⚠️ [SPEED_DATING] Speed dating event will continue without web API integration`);
    }
  }

  /**
   * Fetch and broadcast results to all players with retry logic
   */
  private async fetchAndBroadcastResults(): Promise<void> {
    if (!this.currentEvent) return;
    
    const maxRetries = 8; // Increased from 3 to 8 for more patience with LLM processing
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`📊 [SPEED_DATING] Fetching results for event ${this.currentEvent.id} (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Fetch results from web API with longer timeout
        const response = await fetch(`http://web-api:3000/dating/gauntlet-results/${this.currentEvent.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch results: ${response.status}`);
        }
        
        const results = await response.json() as any[];
        
        // Check if results are empty - might need to wait more
        if (!results || results.length === 0) {
          console.log(`⏳ [SPEED_DATING] No results yet, waiting before retry (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds (increased from 3)
          retryCount++;
          continue;
        }
        
        // Group results by NPC
        const npcGroupedResults: any[] = [];
        const npcIds = [...new Set(results.map((r: any) => r.npc_id))];
        
        for (const npcId of npcIds) {
          const npcRankings = results
            .filter((r: any) => r.npc_id === npcId)
            .map((r: any) => ({
              playerId: r.player_name || r.player_id, // Use player_name for display if available
              playerIdOriginal: r.player_id, // Keep original ID for matching
              finalRank: r.final_rank,
              overallImpression: r.overall_impression,
              attractionLevel: r.attraction_level,
              compatibilityRating: r.compatibility_rating,
              relationshipPotential: r.relationship_potential,
              confessionalStatement: r.confessional_statement,
              reasoning: r.reasoning,
              memorableMoments: r.memorable_moments
            }))
            .sort((a: any, b: any) => a.finalRank - b.finalRank);
          
          console.log(`📊 [SPEED_DATING] NPC ${npcId} rankings:`, npcRankings.map(r => `${r.playerId} (#${r.finalRank})`));
          
          npcGroupedResults.push({
            npcId,
            rankings: npcRankings
          });
        }
        
        // Broadcast results to all players
        await this.broadcastEvent('speed_dating_results', {
          eventId: this.currentEvent.id,
          npcResults: npcGroupedResults
        });
        
        console.log(`✅ [SPEED_DATING] Results broadcast to all players`);
        return; // Success, exit the retry loop
        
      } catch (error) {
        console.error(`❌ [SPEED_DATING] Error fetching/broadcasting results (attempt ${retryCount + 1}):`, error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          // Send error to all players after all retries failed
          console.error(`❌ [SPEED_DATING] Failed to fetch results after ${maxRetries} attempts`);
          await this.broadcastEvent('speed_dating_results', {
            error: true,
            message: 'The NPCs are taking longer than expected to process their thoughts. Results will be available shortly.'
          });
        } else {
          // Wait before retrying (longer delay for LLM processing)
          await new Promise(resolve => setTimeout(resolve, 5000)); // Increased from 2 to 5 seconds
        }
      }
    }
  }

  /**
   * Get current event status
   */
  getEventStatus(): any {
    if (!this.currentEvent) {
      return { status: 'no_event' };
    }

    return {
      status: this.currentEvent.status,
      eventName: this.currentEvent.eventName,
      participantCount: this.currentEvent.participants.length,
      matchCount: this.currentEvent.matches.length,
      currentMatch: this.currentMatch ? {
        matchOrder: this.currentMatch.matchOrder,
        playerId: this.currentMatch.playerId,
        npcId: this.currentMatch.npcId,
        timeRemaining: this.currentMatch.startTime ? 
          Math.max(0, this.currentMatch.durationSeconds * 1000 - (Date.now() - this.currentMatch.startTime.getTime())) : 0
      } : null,
      isCountingDown: this.isCountingDown,
      countdownSeconds: this.eventStartCountdown
    };
  }

  /**
   * Cancel the current event
   */
  async cancelEvent(): Promise<void> {
    if (!this.currentEvent) return;

    console.log(`❌ [SPEED_DATING] Cancelling event: ${this.currentEvent.eventName}`);
    
    this.currentEvent.status = 'cancelled';

    // Clear all timers
    this.clearAllTimers();

    // Resume NPC activities
    try {
      await this.resumeNPCActivities();
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error resuming NPC activities during cancel:', error);
    }

    // Broadcast cancellation
    await this.broadcastEvent('speed_dating_cancelled', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName
    });

    // Clean up
    this.currentEvent = null;
    this.currentMatch = null;
    this.vibeScores.clear();
    this.activeMatches.clear();
    this.pausedActivities.clear();
    this.isCountingDown = false;
    this.eventStartCountdown = 0;
    this.currentRound = 0;
    this.maxRounds = 0;
  }
  
  /**
   * Clear all timers
   */
  private clearAllTimers(): void {
    if (this.eventTimer) {
      clearTimeout(this.eventTimer);
      this.eventTimer = null;
    }
    
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
    }
    
    this.clearCountdownTimer();
  }
} 