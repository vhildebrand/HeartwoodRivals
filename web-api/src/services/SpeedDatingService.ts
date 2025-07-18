import { Pool } from 'pg';
import { createClient } from 'redis';
import OpenAI from 'openai';
import { NPCGenerationService } from './NPCGenerationService';

interface DateAssessmentRequest {
  matchId: number;
  playerId: string;
  npcId: string;
  conversationTranscript: string;
  vibeScores: VibeScoreEntry[];
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

interface DateAssessment {
  matchId: number;
  overallScore: number;
  chemistryScore: number;
  compatibilityScore: number;
  personalityMatchScore: number;
  assessmentReasoning: string;
  highlightedMoments: string[];
  npcPerspective: string;
}

interface GauntletRankingRequest {
  eventId: number;
  npcId: string;
  matches: SpeedDatingMatch[];
  vibeScores: MatchVibeScores[];
}

interface SpeedDatingMatch {
  id: number;
  playerId: string;
  npcId: string;
  matchOrder: number;
  status: string;
}

interface MatchVibeScores {
  matchId: number;
  scores: VibeScoreEntry[];
}

interface PlayerRanking {
  playerId: string;
  finalRank: number;
  overallImpression: string;
  attractionLevel: number;
  compatibilityRating: number;
  relationshipPotential: string;
  confessionalStatement: string;
  reasoning: string;
  memorableMoments: string[];
}

export class SpeedDatingService {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private openai: OpenAI;
  private npcGenerationService: NPCGenerationService;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    });
    
    // Initialize NPC generation service
    this.npcGenerationService = new NPCGenerationService(pool, redisClient);
  }

  /**
   * Store a speed dating match in the database
   */
  async storeMatch(match: any): Promise<void> {
    try {
      // Use the provided ID for the match since it's referenced by vibe scores
      await this.pool.query(
        `INSERT INTO speed_dating_matches (id, event_id, player_id, npc_id, match_order, duration_seconds, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          match.id,
          match.eventId,
          match.playerId,
          match.npcId,
          match.matchOrder,
          match.durationSeconds,
          match.status
        ]
      );
      
      console.log(`✅ [SPEED_DATING] Stored match ${match.id} in database`);
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error storing match:', error);
      throw error;
    }
  }

  /**
   * Store an entire speed dating event and its matches in a single transaction
   */
  async storeInitialEventWithMatches(event: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert the event
      await client.query(
        `INSERT INTO speed_dating_events (id, event_name, event_date, start_time, end_time, max_participants, location, season_theme)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.eventName,
          event.eventDate,
          event.startTime,
          event.endTime,
          event.maxParticipants,
          event.location,
          event.seasonTheme
        ]
      );

      // Insert all matches
      for (const match of event.matches) {
        await client.query(
          `INSERT INTO speed_dating_matches (id, event_id, player_id, npc_id, match_order, duration_seconds, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            match.id,
            match.eventId,
            match.playerId,
            match.npcId,
            match.matchOrder,
            match.durationSeconds,
            match.status
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`✅ [SPEED_DATING] Stored event ${event.id} and ${event.matches.length} matches in database`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [SPEED_DATING] Error storing initial event and matches:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store a vibe score entry in the database
   */
  async storeVibeScore(vibeEntry: VibeScoreEntry): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO date_vibe_scores (match_id, player_message, npc_response, vibe_score, vibe_reason, keyword_matches, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          vibeEntry.matchId,
          vibeEntry.playerMessage,
          vibeEntry.npcResponse,
          vibeEntry.vibeScore,
          vibeEntry.vibeReason,
          vibeEntry.keywordMatches,
          vibeEntry.timestamp
        ]
      );
      
      console.log(`✅ [SPEED_DATING] Stored vibe score for match ${vibeEntry.matchId}: ${vibeEntry.vibeScore}`);
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error storing vibe score:', error);
      throw error;
    }
  }

  /**
   * Get vibe scores for a match
   */
  async getVibeScores(matchId: number): Promise<VibeScoreEntry[]> {
    try {
      const result = await this.pool.query(
        `SELECT match_id, player_message, npc_response, vibe_score, vibe_reason, keyword_matches, timestamp
         FROM date_vibe_scores
         WHERE match_id = $1
         ORDER BY timestamp ASC`,
        [matchId]
      );
      
      return result.rows.map(row => ({
        matchId: row.match_id,
        playerMessage: row.player_message,
        npcResponse: row.npc_response,
        vibeScore: row.vibe_score,
        vibeReason: row.vibe_reason,
        keywordMatches: row.keyword_matches,
        timestamp: row.timestamp
      }));
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error getting vibe scores:', error);
      throw error;
    }
  }

  /**
   * Process post-date assessment using LLM
   */
  async processDateAssessment(request: DateAssessmentRequest): Promise<DateAssessment> {
    try {
      console.log(`🔍 [SPEED_DATING] Processing post-date assessment for match ${request.matchId}`);
      
      // Get NPC data and personality seed
      const npcData = await this.getNPCData(request.npcId);
      const personalitySeed = await this.npcGenerationService.getPersonalitySeed(request.npcId);
      
      // Get scoring prompt from configuration
      const scoringPrompt = await this.getScoringPrompt();
      
      // Build assessment prompt
      const assessmentPrompt = this.buildAssessmentPrompt(
        scoringPrompt,
        request,
        npcData,
        personalitySeed
      );
      
      // Call LLM for assessment
      const llmResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: assessmentPrompt },
          { role: 'user', content: `Please assess this conversation transcript:\n\n${request.conversationTranscript}` }
        ],
        max_tokens: 800,
        temperature: 0.7,
        functions: [
          {
            name: 'provide_date_assessment',
            description: 'Provide a detailed assessment of the speed dating interaction',
            parameters: {
              type: 'object',
              properties: {
                overall_score: {
                  type: 'number',
                  description: 'Overall date success score (0-100)',
                  minimum: 0,
                  maximum: 100
                },
                chemistry_score: {
                  type: 'number',
                  description: 'Chemistry and connection score (0-100)',
                  minimum: 0,
                  maximum: 100
                },
                compatibility_score: {
                  type: 'number',
                  description: 'Compatibility based on shared interests (0-100)',
                  minimum: 0,
                  maximum: 100
                },
                personality_match_score: {
                  type: 'number',
                  description: 'Personality match and communication style (0-100)',
                  minimum: 0,
                  maximum: 100
                },
                assessment_reasoning: {
                  type: 'string',
                  description: 'Detailed reasoning for the scores'
                },
                highlighted_moments: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Key positive and negative moments from the conversation'
                },
                npc_perspective: {
                  type: 'string',
                  description: 'How the NPC felt about the date from their perspective'
                }
              },
              required: ['overall_score', 'chemistry_score', 'compatibility_score', 'personality_match_score', 'assessment_reasoning', 'highlighted_moments', 'npc_perspective']
            }
          }
        ],
        function_call: { name: 'provide_date_assessment' }
      });
      
      // Parse LLM response
      const functionCall = llmResponse.choices[0].message.function_call;
      if (!functionCall) {
        throw new Error('No function call in LLM response');
      }
      
      const assessmentData = JSON.parse(functionCall.arguments);
      
      // Create assessment object
      const assessment: DateAssessment = {
        matchId: request.matchId,
        overallScore: assessmentData.overall_score,
        chemistryScore: assessmentData.chemistry_score,
        compatibilityScore: assessmentData.compatibility_score,
        personalityMatchScore: assessmentData.personality_match_score,
        assessmentReasoning: assessmentData.assessment_reasoning,
        highlightedMoments: assessmentData.highlighted_moments,
        npcPerspective: assessmentData.npc_perspective
      };
      
      // Store assessment in database
      await this.storeDateAssessment(assessment, request.conversationTranscript);
      
      console.log(`✅ [SPEED_DATING] Completed assessment for match ${request.matchId} - Overall: ${assessment.overallScore}/100`);
      
      return assessment;
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error processing date assessment:', error);
      throw error;
    }
  }

  /**
   * Store date assessment in database
   */
  private async storeDateAssessment(assessment: DateAssessment, conversationTranscript: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO date_assessments (match_id, conversation_transcript, overall_score, chemistry_score, compatibility_score, personality_match_score, assessment_reasoning, highlighted_moments, npc_perspective)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        assessment.matchId,
        conversationTranscript,
        assessment.overallScore,
        assessment.chemistryScore,
        assessment.compatibilityScore,
        assessment.personalityMatchScore,
        assessment.assessmentReasoning,
        assessment.highlightedMoments,
        assessment.npcPerspective
      ]
    );
  }

  /**
   * Process post-gauntlet NPC ranking and reflection
   */
  async processGauntletRanking(request: GauntletRankingRequest): Promise<PlayerRanking[]> {
    try {
      console.log(`🏆 [SPEED_DATING] Processing gauntlet ranking for NPC ${request.npcId}`);
      
      // Get NPC data and personality seed
      const npcData = await this.getNPCData(request.npcId);
      const personalitySeed = await this.npcGenerationService.getPersonalitySeed(request.npcId);
      
      // Get all assessments for this NPC's matches
      const assessments = await this.getAssessmentsForMatches(request.matches.map(m => m.id));
      
      // Get gauntlet reflection prompt
      const reflectionPrompt = await this.getGauntletReflectionPrompt();
      
      // Build ranking prompt
      const rankingPrompt = this.buildRankingPrompt(
        reflectionPrompt,
        request,
        npcData,
        personalitySeed,
        assessments
      );
      
      // Call LLM for ranking
      const llmResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: rankingPrompt },
          { role: 'user', content: 'Please rank all the players you met during the speed dating gauntlet.' }
        ],
        max_tokens: 1200,
        temperature: 0.8,
        functions: [
          {
            name: 'rank_players',
            description: 'Rank all players from the speed dating gauntlet',
            parameters: {
              type: 'object',
              properties: {
                rankings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      player_id: { type: 'string' },
                      final_rank: { type: 'number', minimum: 1 },
                      overall_impression: { type: 'string' },
                      attraction_level: { type: 'number', minimum: 1, maximum: 10 },
                      compatibility_rating: { type: 'number', minimum: 1, maximum: 10 },
                      relationship_potential: { 
                        type: 'string',
                        enum: ['not_interested', 'friends', 'romantic_interest', 'soulmate']
                      },
                      confessional_statement: { type: 'string' },
                      reasoning: { type: 'string' },
                      memorable_moments: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['player_id', 'final_rank', 'overall_impression', 'attraction_level', 'compatibility_rating', 'relationship_potential', 'confessional_statement', 'reasoning', 'memorable_moments']
                  }
                }
              },
              required: ['rankings']
            }
          }
        ],
        function_call: { name: 'rank_players' }
      });
      
      // Parse LLM response
      const functionCall = llmResponse.choices[0].message.function_call;
      if (!functionCall) {
        throw new Error('No function call in LLM response');
      }
      
      const rankingData = JSON.parse(functionCall.arguments);
      
      // Create rankings
      const rankings: PlayerRanking[] = rankingData.rankings.map((ranking: any) => ({
        playerId: ranking.player_id,
        finalRank: ranking.final_rank,
        overallImpression: ranking.overall_impression,
        attractionLevel: ranking.attraction_level,
        compatibilityRating: ranking.compatibility_rating,
        relationshipPotential: ranking.relationship_potential,
        confessionalStatement: ranking.confessional_statement,
        reasoning: ranking.reasoning,
        memorableMoments: ranking.memorable_moments
      }));
      
      // Store rankings in database
      await this.storeGauntletRankings(request.eventId, request.npcId, rankings);
      
      console.log(`✅ [SPEED_DATING] Completed gauntlet ranking for NPC ${request.npcId} - ${rankings.length} players ranked`);
      
      return rankings;
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error processing gauntlet ranking:', error);
      throw error;
    }
  }

  /**
   * Store gauntlet rankings in database
   */
  private async storeGauntletRankings(eventId: number, npcId: string, rankings: PlayerRanking[]): Promise<void> {
    for (const ranking of rankings) {
      await this.pool.query(
        `INSERT INTO gauntlet_results (event_id, player_id, npc_id, final_rank, overall_impression, attraction_level, compatibility_rating, relationship_potential, confessional_statement, reasoning, memorable_moments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          eventId,
          ranking.playerId,
          npcId,
          ranking.finalRank,
          ranking.overallImpression,
          ranking.attractionLevel,
          ranking.compatibilityRating,
          ranking.relationshipPotential,
          ranking.confessionalStatement,
          ranking.reasoning,
          ranking.memorableMoments
        ]
      );
    }
  }

  /**
   * Get gauntlet results for an event
   */
  async getGauntletResults(eventId: number): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT event_id, player_id, npc_id, final_rank, overall_impression, attraction_level, compatibility_rating, relationship_potential, confessional_statement, reasoning, memorable_moments, created_at
         FROM gauntlet_results
         WHERE event_id = $1
         ORDER BY npc_id, final_rank ASC`,
        [eventId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error getting gauntlet results:', error);
      throw error;
    }
  }

  /**
   * Get player rankings from a specific NPC
   */
  async getPlayerRankingsByNPC(eventId: number, npcId: string): Promise<PlayerRanking[]> {
    try {
      const result = await this.pool.query(
        `SELECT player_id, final_rank, overall_impression, attraction_level, compatibility_rating, relationship_potential, confessional_statement, reasoning, memorable_moments
         FROM gauntlet_results
         WHERE event_id = $1 AND npc_id = $2
         ORDER BY final_rank ASC`,
        [eventId, npcId]
      );
      
      return result.rows.map(row => ({
        playerId: row.player_id,
        finalRank: row.final_rank,
        overallImpression: row.overall_impression,
        attractionLevel: row.attraction_level,
        compatibilityRating: row.compatibility_rating,
        relationshipPotential: row.relationship_potential,
        confessionalStatement: row.confessional_statement,
        reasoning: row.reasoning,
        memorableMoments: row.memorable_moments
      }));
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error getting player rankings by NPC:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for a player across all NPCs
   */
  async getPlayerLeaderboard(eventId: number, playerId: string): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT gr.npc_id, a.name as npc_name, gr.final_rank, gr.overall_impression, gr.attraction_level, gr.compatibility_rating, gr.relationship_potential, gr.confessional_statement
         FROM gauntlet_results gr
         JOIN agents a ON gr.npc_id = a.id
         WHERE gr.event_id = $1 AND gr.player_id = $2
         ORDER BY gr.final_rank ASC`,
        [eventId, playerId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error getting player leaderboard:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private async getNPCData(npcId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT id, name, constitution, personality_traits, likes, dislikes FROM agents WHERE id = $1',
      [npcId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`NPC not found: ${npcId}`);
    }
    
    return result.rows[0];
  }

  private async getScoringPrompt(): Promise<string> {
    const result = await this.pool.query(
      'SELECT config_value FROM dating_system_config WHERE config_key = $1',
      ['scoring_prompt']
    );
    
    return result.rows[0]?.config_value || 'Analyze this conversation for compatibility and chemistry.';
  }

  private async getGauntletReflectionPrompt(): Promise<string> {
    const result = await this.pool.query(
      'SELECT config_value FROM dating_system_config WHERE config_key = $1',
      ['gauntlet_reflection_prompt']
    );
    
    return result.rows[0]?.config_value || 'Rank the players you met during the speed dating event.';
  }

  private buildAssessmentPrompt(
    basePrompt: string,
    request: DateAssessmentRequest,
    npcData: any,
    personalitySeed: any
  ): string {
    let prompt = basePrompt;
    
    // Replace placeholders
    prompt = prompt.replace('{npc_name}', npcData.name);
    prompt = prompt.replace('{player_name}', `Player ${request.playerId}`);
    prompt = prompt.replace('{npc_traits}', npcData.personality_traits?.join(', ') || 'Unknown');
    prompt = prompt.replace('{npc_likes}', npcData.likes?.join(', ') || 'Unknown');
    prompt = prompt.replace('{npc_dislikes}', npcData.dislikes?.join(', ') || 'Unknown');
    
    // Add personality seed information if available
    if (personalitySeed) {
      prompt += `\n\nAdditional personality context for ${npcData.name}:\n`;
      prompt += `Dating style: ${personalitySeed.datingStyle}\n`;
      prompt += `Romantic goals: ${personalitySeed.romanticGoals.join(', ')}\n`;
      prompt += `Conversation style: ${personalitySeed.conversationStyle}\n`;
      prompt += `Attraction triggers: ${personalitySeed.attractionTriggers.join(', ')}\n`;
      prompt += `Dealbreakers: ${personalitySeed.dealbreakers.join(', ')}\n`;
    }
    
    return prompt;
  }

  private buildRankingPrompt(
    basePrompt: string,
    request: GauntletRankingRequest,
    npcData: any,
    personalitySeed: any,
    assessments: any[]
  ): string {
    let prompt = basePrompt;
    
    // Replace placeholders
    prompt = prompt.replace('{npc_name}', npcData.name);
    prompt = prompt.replace('{personality_traits}', npcData.personality_traits?.join(', ') || 'Unknown');
    prompt = prompt.replace('{likes}', npcData.likes?.join(', ') || 'Unknown');
    prompt = prompt.replace('{dislikes}', npcData.dislikes?.join(', ') || 'Unknown');
    
    // Add personality seed information
    if (personalitySeed) {
      prompt += `\n\nYour dating preferences:\n`;
      prompt += `Dating style: ${personalitySeed.datingStyle}\n`;
      prompt += `Romantic goals: ${personalitySeed.romanticGoals.join(', ')}\n`;
      prompt += `What attracts you: ${personalitySeed.attractionTriggers.join(', ')}\n`;
      prompt += `Your dealbreakers: ${personalitySeed.dealbreakers.join(', ')}\n`;
    }
    
    // Add assessment summaries
    if (assessments.length > 0) {
      prompt += `\n\nHere are the detailed assessments from your conversations:\n`;
      assessments.forEach((assessment, index) => {
        prompt += `\nPlayer ${index + 1}:\n`;
        prompt += `- Overall chemistry: ${assessment.chemistry_score}/100\n`;
        prompt += `- Compatibility: ${assessment.compatibility_score}/100\n`;
        prompt += `- Personality match: ${assessment.personality_match_score}/100\n`;
        prompt += `- Your perspective: ${assessment.npc_perspective}\n`;
        prompt += `- Key moments: ${assessment.highlighted_moments.join(', ')}\n`;
      });
    }
    
    return prompt;
  }

  private async getAssessmentsForMatches(matchIds: number[]): Promise<any[]> {
    if (matchIds.length === 0) return [];
    
    const placeholders = matchIds.map((_, index) => `$${index + 1}`).join(', ');
    const result = await this.pool.query(
      `SELECT match_id, chemistry_score, compatibility_score, personality_match_score, npc_perspective, highlighted_moments
       FROM date_assessments
       WHERE match_id IN (${placeholders})
       ORDER BY match_id`,
      matchIds
    );
    
    return result.rows;
  }

  /**
   * Create a new speed dating event
   */
  async createSpeedDatingEvent(eventData: any): Promise<number> {
    try {
      let query, params;
      
      // If custom ID is provided (from game server), use it
      if (eventData.id) {
        query = `INSERT INTO speed_dating_events (id, event_name, event_date, start_time, end_time, max_participants, location, season_theme)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                 ON CONFLICT (id) DO NOTHING
                 RETURNING id`;
        params = [
          eventData.id,
          eventData.eventName,
          eventData.eventDate,
          eventData.startTime,
          eventData.endTime,
          eventData.maxParticipants,
          eventData.location,
          eventData.seasonTheme
        ];
      } else {
        // Legacy mode - auto-generate ID (for manual event creation)
        query = `INSERT INTO speed_dating_events (event_name, event_date, start_time, end_time, max_participants, location, season_theme)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
        params = [
          eventData.eventName,
          eventData.eventDate,
          eventData.startTime,
          eventData.endTime,
          eventData.maxParticipants,
          eventData.location,
          eventData.seasonTheme
        ];
      }
      
      const result = await this.pool.query(query, params);
      
      // Return the provided ID or the generated one
      return eventData.id || result.rows[0].id;
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error creating speed dating event:', error);
      throw error;
    }
  }

  /**
   * Get speed dating events
   */
  async getSpeedDatingEvents(status?: string): Promise<any[]> {
    try {
      let query = 'SELECT * FROM speed_dating_events';
      let params: any[] = [];
      
      if (status) {
        query += ' WHERE status = $1';
        params = [status];
      }
      
      query += ' ORDER BY event_date DESC, start_time DESC';
      
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error getting speed dating events:', error);
      throw error;
    }
  }

  /**
   * Update speed dating event status
   */
  async updateEventStatus(eventId: number, status: string): Promise<void> {
    try {
      await this.pool.query(
        'UPDATE speed_dating_events SET status = $1, updated_at = now() WHERE id = $2',
        [status, eventId]
      );
    } catch (error) {
      console.error('❌ [SPEED_DATING] Error updating event status:', error);
      throw error;
    }
  }
} 