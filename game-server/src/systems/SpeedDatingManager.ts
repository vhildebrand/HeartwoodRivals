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
  private readonly DEFAULT_DATE_DURATION = 2 * 60 * 1000; // 2 minutes in real-world milliseconds
  private readonly COUNTDOWN_DURATION = 15 * 1000; // 15 seconds in real-world milliseconds
  private readonly VIBE_KEYWORDS = {
    positive: ['love', 'like', 'enjoy', 'fun', 'great', 'amazing', 'wonderful', 'beautiful', 'interesting', 'exciting'],
    negative: ['hate', 'dislike', 'boring', 'terrible', 'awful', 'disgusting', 'annoying', 'stupid', 'waste', 'pointless'],
    romantic: ['romantic', 'love', 'heart', 'soul', 'beautiful', 'gorgeous', 'handsome', 'attraction', 'chemistry', 'spark'],
    intellectual: ['think', 'philosophy', 'ideas', 'knowledge', 'learning', 'books', 'wisdom', 'understand', 'analyze'],
    adventure: ['adventure', 'explore', 'travel', 'excitement', 'risk', 'new', 'discover', 'journey', 'challenge'],
    family: ['family', 'children', 'home', 'future', 'together', 'commitment', 'marriage', 'settle', 'build']
  };

  constructor(agents: Map<string, SpawnedAgent>, broadcastCallback: (eventType: string, data: any, targetPlayer?: string) => void) {
    this.agents = agents;
    this.broadcastCallback = broadcastCallback;
  }

  /**
   * Initialize a speed dating event
   */
  async initializeEvent(eventData: Partial<SpeedDatingEvent>): Promise<void> {
    console.log(`🌹 [SPEED_DATING] Initializing event: ${eventData.eventName}`);
    
    try {
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

      console.log(`✅ [SPEED_DATING] Event initialized: ${this.currentEvent.eventName}`);
      
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

    // Calculate total rounds (each player should date each NPC)
    this.maxRounds = npcs.length;

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

    // If no NPC response provided, request one from the web API
    if (!npcResponse) {
      try {
        const response = await this.requestNPCResponse(playerId, message, currentMatch.npcId);
        npcResponse = response;
      } catch (error) {
        console.error('❌ [SPEED_DATING] Failed to get NPC response:', error);
        npcResponse = "I'm having trouble responding right now.";
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

    // Get sophisticated vibe score from LLM evaluation
    let vibeScore: { score: number, reason: string, keywords: string[] } = { score: 0, reason: 'Evaluating...', keywords: [] };
    try {
      // Calculate time remaining properly without including timer object
      let timeRemaining = 0;
      if (currentMatch.startTime) {
        const elapsedSeconds = Math.floor((Date.now() - currentMatch.startTime.getTime()) / 1000);
        timeRemaining = Math.max(0, currentMatch.durationSeconds - elapsedSeconds);
      }
      
      const vibeResponse = await fetch('http://web-api:3000/thought/speed-dating-vibe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: currentMatch.npcId,
          playerMessage: message,
          matchContext: {
            playerId,
            matchOrder: currentMatch.matchOrder,
            eventName: this.currentEvent?.eventName,
            timeRemaining: timeRemaining
          }
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (vibeResponse.ok) {
        const vibeData = await vibeResponse.json() as any;
        vibeScore = {
          score: vibeData.vibeScore || 0,
          reason: vibeData.vibeReason || 'Processing...',
          keywords: vibeData.evaluation?.attractionFactors || []
        };
        console.log(`💝 [SPEED_DATING] LLM vibe evaluation: ${vibeScore.score} - ${vibeScore.reason}`);
      } else {
        console.warn('⚠️ [SPEED_DATING] Failed to get LLM vibe evaluation, falling back to keyword matching');
        // Fall back to basic keyword matching
        vibeScore = this.calculateVibeScore(message, currentMatch.npcId);
      }
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error getting LLM vibe evaluation:', error);
      // Fall back to basic keyword matching
      vibeScore = this.calculateVibeScore(message, currentMatch.npcId);
    }
    
    // Create vibe score entry
    const vibeEntry: VibeScoreEntry = {
      matchId: currentMatch.id,
      playerMessage: message,
      npcResponse,
      vibeScore: vibeScore.score,
      vibeReason: vibeScore.reason,
      keywordMatches: vibeScore.keywords,
      timestamp: new Date()
    };

    // Store vibe score
    const matchVibes = this.vibeScores.get(currentMatch.id) || [];
    matchVibes.push(vibeEntry);
    this.vibeScores.set(currentMatch.id, matchVibes);

    // Only send vibe update to specific player if there's an actual score change (non-zero)
    if (vibeScore.score !== 0) {
      await this.broadcastEvent('speed_dating_vibe_update', {
        eventId: this.currentEvent?.id || 0,
        matchId: currentMatch.id,
        playerId,
        vibeScore: vibeScore.score,
        vibeReason: vibeScore.reason,
        cumulativeScore: this.calculateCumulativeVibeScore(currentMatch.id)
      }, playerId);
    }

    // Notify web API for storage
    await this.notifyWebAPI('vibe_score_recorded', {
      matchId: currentMatch.id,
      vibeEntry
    });
  }

  /**
   * Calculate vibe score based on message content and NPC personality
   */
  private calculateVibeScore(message: string, npcId: string): { score: number, reason: string, keywords: string[] } {
    // Get NPC personality seed for more accurate scoring
    const agent = this.agents.get(npcId);
    if (!agent) {
      return { score: 0, reason: 'Unknown NPC', keywords: [] };
    }

    const messageLower = message.toLowerCase();
    let score = 0;
    let reason = '';
    let keywords: string[] = [];

    // Check for keyword matches
    for (const [category, categoryKeywords] of Object.entries(this.VIBE_KEYWORDS)) {
      const matches = categoryKeywords.filter(keyword => messageLower.includes(keyword));
      
      if (matches.length > 0) {
        keywords.push(...matches);
        
        switch (category) {
          case 'positive':
            score += matches.length * 2;
            reason = 'Positive language detected';
            break;
          case 'negative':
            score -= matches.length * 2;
            reason = 'Negative language detected';
            break;
          case 'romantic':
            score += matches.length * 3;
            reason = 'Romantic interest expressed';
            break;
          case 'intellectual':
            score += matches.length * 2;
            reason = 'Intellectual connection made';
            break;
          case 'adventure':
            score += matches.length * 2;
            reason = 'Adventurous spirit shown';
            break;
          case 'family':
            score += matches.length * 2;
            reason = 'Family values expressed';
            break;
        }
      }
    }

    // Normalize score to -10 to +10 range
    score = Math.max(-10, Math.min(10, score));

    return {
      score,
      reason: reason || 'Neutral response',
      keywords
    };
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
   * Complete the speed dating event
   */
  private async completeEvent(): Promise<void> {
    if (!this.currentEvent) return;

    console.log(`🎉 [SPEED_DATING] Completing event: ${this.currentEvent.eventName}`);
    
    this.currentEvent.status = 'completed';

    // Broadcast event completion to all players
    await this.broadcastEvent('speed_dating_complete', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName,
      totalMatches: this.currentEvent.matches.length
    });

    // Trigger post-gauntlet NPC reflections
    await this.triggerPostGauntletReflections();

    // Resume normal NPC activities
    await this.resumeNPCActivities();

    // Wait a bit for reflections to complete before clearing data
    setTimeout(() => {
      // Clean up
      this.currentEvent = null;
      this.vibeScores.clear();
    }, 5000);
    
    console.log(`✅ [SPEED_DATING] Event completed successfully`);
  }

  /**
   * Trigger post-gauntlet NPC reflections
   */
  private async triggerPostGauntletReflections(): Promise<void> {
    if (!this.currentEvent) return;

    const npcParticipants = this.currentEvent.participants.filter(p => p.participantType === 'npc');
    
    // Process all NPC reflections
    const reflectionPromises = npcParticipants.map(participant => {
      const npcMatches = this.currentEvent!.matches.filter(m => m.npcId === participant.participantId);
      
      return this.notifyWebAPI('post_gauntlet_reflection', {
        eventId: this.currentEvent!.id,
        npcId: participant.participantId,
        matches: npcMatches,
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
    setTimeout(async () => {
      await this.fetchAndBroadcastResults();
    }, 2000); // Give the web API time to process reflections
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
        if (pausedActivity) {
          agent.activityManager.requestActivity({
            activityName: pausedActivity.name,
            priority: pausedActivity.priority || 1
          });
        }
        
        console.log(`▶️ [SPEED_DATING] Resumed activities for ${agentId}`);
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
  private async requestNPCResponse(playerId: string, message: string, npcId: string): Promise<string> {
    try {
      console.log(`🤖 [SPEED_DATING] Requesting NPC response from ${npcId} for message: "${message}"`);
      
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
            matchOrder: this.currentMatch?.matchOrder,
            timeRemaining: this.currentMatch?.durationSeconds,
            eventName: this.currentEvent?.eventName
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
  private async pollForNPCResponse(jobId: string): Promise<string> {
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
          return result.response.response;
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
      const response = await fetch('http://web-api:3000/dating/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: eventType,
          data
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000)
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
   * Fetch and broadcast results to all players
   */
  private async fetchAndBroadcastResults(): Promise<void> {
    if (!this.currentEvent) return;
    
    try {
      console.log(`📊 [SPEED_DATING] Fetching results for event ${this.currentEvent.id}`);
      
      // Fetch results from web API
      const response = await fetch(`http://web-api:3000/dating/gauntlet-results/${this.currentEvent.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.status}`);
      }
      
      const results = await response.json() as any[];
      
      // Group results by NPC
      const npcGroupedResults: any[] = [];
      const npcIds = [...new Set(results.map((r: any) => r.npc_id))];
      
      for (const npcId of npcIds) {
        const npcRankings = results
          .filter((r: any) => r.npc_id === npcId)
          .map((r: any) => ({
            playerId: r.player_id,
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
      
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error fetching/broadcasting results:', error);
      
      // Send error to all players
      await this.broadcastEvent('speed_dating_results', {
        error: true,
        message: 'Failed to load results'
      });
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
    if (this.eventTimer) {
      clearTimeout(this.eventTimer);
      this.eventTimer = null;
    }
    
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
    }
    
    this.clearCountdownTimer();

    // Resume NPC activities
    await this.resumeNPCActivities();

    // Broadcast cancellation
    await this.broadcastEvent('speed_dating_cancelled', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName
    });

    // Clean up
    this.currentEvent = null;
    this.currentMatch = null;
    this.vibeScores.clear();
    this.isCountingDown = false;
    this.eventStartCountdown = 0;
  }
} 