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
  private broadcastCallback: (eventType: string, data: any) => void;
  private currentEvent: SpeedDatingEvent | null = null;
  private currentMatch: SpeedDatingMatch | null = null;
  private vibeScores: Map<number, VibeScoreEntry[]> = new Map();
  private eventTimer: NodeJS.Timeout | null = null;
  private matchTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private isCountingDown: boolean = false;
  private eventStartCountdown: number = 0;
  private pausedActivities: Map<string, any> = new Map();

  // Dating-specific configuration (using real-world time, not game time)
  private readonly DEFAULT_DATE_DURATION = 5 * 60 * 1000; // 5 minutes in real-world milliseconds
  private readonly COUNTDOWN_DURATION = 15 * 1000; // 15 seconds in real-world milliseconds
  private readonly VIBE_KEYWORDS = {
    positive: ['love', 'like', 'enjoy', 'fun', 'great', 'amazing', 'wonderful', 'beautiful', 'interesting', 'exciting'],
    negative: ['hate', 'dislike', 'boring', 'terrible', 'awful', 'disgusting', 'annoying', 'stupid', 'waste', 'pointless'],
    romantic: ['romantic', 'love', 'heart', 'soul', 'beautiful', 'gorgeous', 'handsome', 'attraction', 'chemistry', 'spark'],
    intellectual: ['think', 'philosophy', 'ideas', 'knowledge', 'learning', 'books', 'wisdom', 'understand', 'analyze'],
    adventure: ['adventure', 'explore', 'travel', 'excitement', 'risk', 'new', 'discover', 'journey', 'challenge'],
    family: ['family', 'children', 'home', 'future', 'together', 'commitment', 'marriage', 'settle', 'build']
  };

  constructor(agents: Map<string, SpawnedAgent>, broadcastCallback: (eventType: string, data: any) => void) {
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

    // Broadcast countdown start
    await this.broadcastEvent('speed_dating_countdown', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName,
      countdownSeconds: this.eventStartCountdown,
      location: this.currentEvent.location
    });

    // Start countdown timer with proper cleanup
    this.countdownTimer = setInterval(async () => {
      this.eventStartCountdown--;
      
      console.log(`⏰ [SPEED_DATING] Countdown: ${this.eventStartCountdown} seconds remaining`);
      
      // Broadcast countdown update
      await this.broadcastEvent('speed_dating_countdown', {
        eventId: this.currentEvent?.id || 0,
        remainingSeconds: this.eventStartCountdown
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

    // For speed dating, we should only have one human player, but handle multiple players gracefully
    if (players.length === 0) {
      console.warn('⚠️ [SPEED_DATING] No players registered for speed dating event');
      return;
    }

    if (players.length > 1) {
      console.warn(`⚠️ [SPEED_DATING] Multiple players registered (${players.length}), speed dating is designed for single player`);
    }

    // Create matches for the first player with each NPC (sequential dates)
    const primaryPlayer = players[0];
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      
              const match: SpeedDatingMatch = {
          id: Date.now() + Math.floor(Math.random() * 10000),
          eventId: this.currentEvent.id,
          playerId: primaryPlayer.participantId,
          npcId: npc.participantId,
          matchOrder: i + 1,
          durationSeconds: this.DEFAULT_DATE_DURATION / 1000,
          status: 'scheduled'
        };

      this.currentEvent.matches.push(match);
      
      // Initialize vibe scores for this match
      this.vibeScores.set(match.id, []);
    }

    console.log(`📋 [SPEED_DATING] Created ${this.currentEvent.matches.length} matches for player ${primaryPlayer.participantId} with ${npcs.length} NPCs`);
    
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

    // Guard against multiple matches starting simultaneously
    if (this.currentMatch) {
      console.warn('⚠️ [SPEED_DATING] Match already in progress, skipping startNextMatch');
      return;
    }

    // Find the next scheduled match
    const nextMatch = this.currentEvent.matches.find(m => m.status === 'scheduled');
    
    if (!nextMatch) {
      // No more matches, event is complete
      console.log('🎉 [SPEED_DATING] All matches completed, ending event');
      await this.completeEvent();
      return;
    }

    console.log(`💕 [SPEED_DATING] Starting match ${nextMatch.matchOrder}: ${nextMatch.playerId} with ${nextMatch.npcId} (Duration: ${nextMatch.durationSeconds}s)`);
    
    this.currentMatch = nextMatch;
    nextMatch.status = 'active';
    nextMatch.startTime = new Date();

    // Broadcast match start
    await this.broadcastEvent('speed_dating_match_start', {
      eventId: this.currentEvent.id,
      matchId: nextMatch.id,
      playerId: nextMatch.playerId,
      npcId: nextMatch.npcId,
      matchOrder: nextMatch.matchOrder,
      duration: nextMatch.durationSeconds,
      npcName: nextMatch.npcId // Include NPC name for UI
    });

    // Start match timer - this should run for the full duration in real-world time
    console.log(`⏱️ [SPEED_DATING] Setting match timer for ${nextMatch.durationSeconds} seconds (real-world time)`);
    this.matchTimer = setTimeout(async () => {
      console.log(`⏰ [SPEED_DATING] Match timer expired for match ${nextMatch.matchOrder}`);
      await this.endCurrentMatch();
    }, nextMatch.durationSeconds * 1000); // Real-world milliseconds, not affected by game time multiplier
  }

  /**
   * End the current speed dating match
   */
  private async endCurrentMatch(): Promise<void> {
    if (!this.currentMatch) {
      console.warn('⚠️ [SPEED_DATING] No active match to end');
      return;
    }

    const matchOrder = this.currentMatch.matchOrder;
    const npcId = this.currentMatch.npcId;
    
    console.log(`⏰ [SPEED_DATING] Ending match ${matchOrder} with ${npcId}`);
    
    this.currentMatch.status = 'completed';
    this.currentMatch.endTime = new Date();

    // Clear match timer
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
      console.log(`🔄 [SPEED_DATING] Cleared match timer for match ${matchOrder}`);
    }

    // Broadcast match end
    await this.broadcastEvent('speed_dating_match_end', {
      eventId: this.currentEvent?.id || 0,
      matchId: this.currentMatch.id,
      playerId: this.currentMatch.playerId,
      npcId: this.currentMatch.npcId,
      matchOrder: matchOrder
    });

    // Trigger post-date assessment
    await this.triggerPostDateAssessment(this.currentMatch);

    // Clear current match BEFORE starting next one
    this.currentMatch = null;
    
    console.log(`⏸️ [SPEED_DATING] Match ${matchOrder} ended, waiting 3 seconds before next match...`);

    // Start next match after a brief pause
    setTimeout(async () => {
      console.log(`🔄 [SPEED_DATING] Starting next match after pause...`);
      await this.startNextMatch();
    }, 3000); // 3 second pause between matches
  }

  /**
   * Process a conversation message during a speed date
   */
  async processDateConversation(playerId: string, message: string, npcResponse?: string): Promise<void> {
    if (!this.currentMatch || this.currentMatch.playerId !== playerId) {
      console.warn('⚠️ [SPEED_DATING] No active match for player conversation');
      return;
    }

    console.log(`💬 [SPEED_DATING] Processing message from ${playerId}: "${message}"`);

    // If no NPC response provided, request one from the web API
    if (!npcResponse) {
      try {
        const response = await this.requestNPCResponse(playerId, message, this.currentMatch.npcId);
        npcResponse = response;
      } catch (error) {
        console.error('❌ [SPEED_DATING] Failed to get NPC response:', error);
        npcResponse = "I'm having trouble responding right now.";
      }
    }

    // Broadcast NPC response to client
    console.log(`📢 [SPEED_DATING] Broadcasting NPC response for match ${this.currentMatch.id}: "${npcResponse}"`);
    await this.broadcastEvent('speed_dating_npc_response', {
      eventId: this.currentEvent?.id || 0,
      matchId: this.currentMatch.id,
      npcId: this.currentMatch.npcId,
      npcName: this.currentMatch.npcId,
      message: npcResponse,
      timestamp: Date.now()
    });

    // Calculate vibe score based on message content
    const vibeScore = this.calculateVibeScore(message, this.currentMatch.npcId);
    
    // Create vibe score entry
    const vibeEntry: VibeScoreEntry = {
      matchId: this.currentMatch.id,
      playerMessage: message,
      npcResponse,
      vibeScore: vibeScore.score,
      vibeReason: vibeScore.reason,
      keywordMatches: vibeScore.keywords,
      timestamp: new Date()
    };

    // Store vibe score
    const matchVibes = this.vibeScores.get(this.currentMatch.id) || [];
    matchVibes.push(vibeEntry);
    this.vibeScores.set(this.currentMatch.id, matchVibes);

    // Only broadcast vibe update if there's an actual score change (non-zero)
    if (vibeScore.score !== 0) {
      await this.broadcastEvent('speed_dating_vibe_update', {
        eventId: this.currentEvent?.id || 0,
        matchId: this.currentMatch.id,
        playerId,
        vibeScore: vibeScore.score,
        vibeReason: vibeScore.reason,
        cumulativeScore: this.calculateCumulativeVibeScore(this.currentMatch.id)
      });
    }

    // Notify web API for storage
    await this.notifyWebAPI('vibe_score_recorded', {
      matchId: this.currentMatch.id,
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

    // Broadcast event completion
    await this.broadcastEvent('speed_dating_complete', {
      eventId: this.currentEvent.id,
      eventName: this.currentEvent.eventName,
      totalMatches: this.currentEvent.matches.length
    });

    // Trigger post-gauntlet NPC reflections
    await this.triggerPostGauntletReflections();

    // Resume normal NPC activities
    await this.resumeNPCActivities();

    // Clean up
    this.currentEvent = null;
    this.vibeScores.clear();
    
    console.log(`✅ [SPEED_DATING] Event completed successfully`);
  }

  /**
   * Trigger post-gauntlet NPC reflections
   */
  private async triggerPostGauntletReflections(): Promise<void> {
    if (!this.currentEvent) return;

    const npcParticipants = this.currentEvent.participants.filter(p => p.participantType === 'npc');
    
    for (const participant of npcParticipants) {
      const npcMatches = this.currentEvent.matches.filter(m => m.npcId === participant.participantId);
      
      await this.notifyWebAPI('post_gauntlet_reflection', {
        eventId: this.currentEvent.id,
        npcId: participant.participantId,
        matches: npcMatches,
        vibeScores: npcMatches.map(m => ({
          matchId: m.id,
          scores: this.vibeScores.get(m.id) || []
        }))
      });
    }
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
   * Broadcast event to all clients
   */
  private async broadcastEvent(eventType: string, data: any): Promise<void> {
    console.log(`📢 [SPEED_DATING] Broadcasting ${eventType}:`, data);
    
    // Use the broadcast callback from HeartwoodRoom
    this.broadcastCallback(eventType, data);
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
          characterId: playerId // Use player ID as character ID for speed dating
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