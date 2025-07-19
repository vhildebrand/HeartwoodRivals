import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { SpeedDatingService } from '../services/SpeedDatingService';
import { NPCGenerationService } from '../services/NPCGenerationService';

export function datingRoutes(pool: Pool, redisClient: ReturnType<typeof createClient>) {
  const router = express.Router();
  const speedDatingService = new SpeedDatingService(pool, redisClient);
  const npcGenerationService = new NPCGenerationService(pool, redisClient);

  // ============================================
  // EVENT MANAGEMENT ROUTES
  // ============================================

  // POST /dating/events - Create a new speed dating event
  router.post('/events', async (req, res) => {
    try {
      const { eventName, eventDate, startTime, endTime, maxParticipants, location, seasonTheme } = req.body;

      if (!eventName || !eventDate || !startTime || !endTime) {
        return res.status(400).json({
          error: 'Missing required fields: eventName, eventDate, startTime, endTime'
        });
      }

      const eventId = await speedDatingService.createSpeedDatingEvent({
        eventName,
        eventDate,
        startTime,
        endTime,
        maxParticipants: maxParticipants || 10,
        location: location || 'town_square',
        seasonTheme
      });

      res.json({
        success: true,
        message: 'Speed dating event created successfully',
        eventId
      });

    } catch (error) {
      console.error('Error in POST /dating/events:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/events - Get all speed dating events
  router.get('/events', async (req, res) => {
    try {
      const { status } = req.query;
      
      const events = await speedDatingService.getSpeedDatingEvents(status as string);
      
      res.json({
        success: true,
        events
      });

    } catch (error) {
      console.error('Error in GET /dating/events:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // PUT /dating/events/:eventId/status - Update event status
  router.put('/events/:eventId/status', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          error: 'Missing required field: status'
        });
      }

      await speedDatingService.updateEventStatus(parseInt(eventId), status);

      res.json({
        success: true,
        message: `Event status updated to ${status}`
      });

    } catch (error) {
      console.error('Error in PUT /dating/events/:eventId/status:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // ============================================
  // SCORING AND ASSESSMENT ROUTES
  // ============================================

  // POST /dating/vibe-score - Store a vibe score entry
  router.post('/vibe-score', async (req, res) => {
    try {
      const { matchId, playerMessage, npcResponse, vibeScore, vibeReason, keywordMatches } = req.body;

      if (!matchId || !playerMessage || vibeScore === undefined || !vibeReason) {
        return res.status(400).json({
          error: 'Missing required fields: matchId, playerMessage, vibeScore, vibeReason'
        });
      }

      const vibeEntry = {
        matchId,
        playerMessage,
        npcResponse,
        vibeScore,
        vibeReason,
        keywordMatches: keywordMatches || [],
        timestamp: new Date()
      };

      await speedDatingService.storeVibeScore(vibeEntry);

      res.json({
        success: true,
        message: 'Vibe score stored successfully'
      });

    } catch (error) {
      console.error('Error in POST /dating/vibe-score:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/vibe-scores/:matchId - Get vibe scores for a match
  router.get('/vibe-scores/:matchId', async (req, res) => {
    try {
      const { matchId } = req.params;
      
      const vibeScores = await speedDatingService.getVibeScores(parseInt(matchId));
      
      res.json({
        success: true,
        vibeScores
      });

    } catch (error) {
      console.error('Error in GET /dating/vibe-scores/:matchId:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /dating/assess-date - Process post-date assessment
  router.post('/assess-date', async (req, res) => {
    try {
      const { matchId, playerId, npcId, conversationTranscript, vibeScores } = req.body;

      if (!matchId || !playerId || !npcId || !conversationTranscript) {
        return res.status(400).json({
          error: 'Missing required fields: matchId, playerId, npcId, conversationTranscript'
        });
      }

      const assessment = await speedDatingService.processDateAssessment({
        matchId,
        playerId,
        npcId,
        conversationTranscript,
        vibeScores: vibeScores || []
      });

      res.json({
        success: true,
        message: 'Date assessment completed',
        assessment
      });

    } catch (error) {
      console.error('Error in POST /dating/assess-date:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // ============================================
  // RANKING AND RESULTS ROUTES
  // ============================================

  // POST /dating/rank-players - Process post-gauntlet NPC ranking
  router.post('/rank-players', async (req, res) => {
    try {
      const { eventId, npcId, matches, vibeScores } = req.body;

      if (!eventId || !npcId || !matches) {
        return res.status(400).json({
          error: 'Missing required fields: eventId, npcId, matches'
        });
      }

      const rankings = await speedDatingService.processGauntletRanking({
        eventId,
        npcId,
        matches,
        vibeScores: vibeScores || []
      });

      res.json({
        success: true,
        message: 'Player ranking completed',
        rankings
      });

    } catch (error) {
      console.error('Error in POST /dating/rank-players:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/results/:eventId - Get gauntlet results for an event
  router.get('/results/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const results = await speedDatingService.getGauntletResults(parseInt(eventId));
      
      res.json({
        success: true,
        results
      });

    } catch (error) {
      console.error('Error in GET /dating/results/:eventId:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/rankings/:eventId/:npcId - Get player rankings by specific NPC
  router.get('/rankings/:eventId/:npcId', async (req, res) => {
    try {
      const { eventId, npcId } = req.params;
      
      const rankings = await speedDatingService.getPlayerRankingsByNPC(parseInt(eventId), npcId);
      
      res.json({
        success: true,
        rankings
      });

    } catch (error) {
      console.error('Error in GET /dating/rankings/:eventId/:npcId:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/leaderboard/:eventId/:playerId - Get leaderboard for a specific player
  router.get('/leaderboard/:eventId/:playerId', async (req, res) => {
    try {
      const { eventId, playerId } = req.params;
      
      const leaderboard = await speedDatingService.getPlayerLeaderboard(parseInt(eventId), playerId);
      
      res.json({
        success: true,
        leaderboard
      });

    } catch (error) {
      console.error('Error in GET /dating/leaderboard/:eventId/:playerId:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/gauntlet-results/:eventId - Get all results for a gauntlet
  router.get('/gauntlet-results/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const results = await speedDatingService.getGauntletResults(parseInt(eventId));
      
      res.json(results);

    } catch (error) {
      console.error('Error in GET /dating/gauntlet-results/:eventId:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/player-leaderboard/:eventId/:playerId - Get player's rankings across all NPCs
  router.get('/player-leaderboard/:eventId/:playerId', async (req, res) => {
    try {
      const { eventId, playerId } = req.params;
      
      const leaderboard = await speedDatingService.getPlayerLeaderboard(
        parseInt(eventId),
        playerId
      );
      
      res.json({
        success: true,
        eventId: parseInt(eventId),
        playerId,
        leaderboard
      });

    } catch (error) {
      console.error('Error in GET /dating/player-leaderboard/:eventId/:playerId:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // ============================================
  // NPC GENERATION ROUTES
  // ============================================

  // POST /dating/generate-personalities - Generate personality seeds for all NPCs
  router.post('/generate-personalities', async (req, res) => {
    try {
      const { seasonTheme } = req.body;
      
      const personalitySeeds = await npcGenerationService.generateSeasonalPersonalitySeeds(seasonTheme);
      
      res.json({
        success: true,
        message: `Generated ${personalitySeeds.length} personality seeds`,
        personalitySeeds
      });

    } catch (error) {
      console.error('Error in POST /dating/generate-personalities:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /dating/create-season - Create a new social season
  router.post('/create-season', async (req, res) => {
    try {
      const { themeName, startDate, endDate } = req.body;

      if (!themeName || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required fields: themeName, startDate, endDate'
        });
      }

      const seasonId = await npcGenerationService.createSocialSeason(
        themeName,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        message: 'Social season created successfully',
        seasonId
      });

    } catch (error) {
      console.error('Error in POST /dating/create-season:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/themes - Get available season themes
  router.get('/themes', async (req, res) => {
    try {
      const themes = npcGenerationService.getAvailableThemes();
      
      res.json({
        success: true,
        themes
      });

    } catch (error) {
      console.error('Error in GET /dating/themes:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/personality-seed/:npcId - Get personality seed for a specific NPC
  router.get('/personality-seed/:npcId', async (req, res) => {
    try {
      const { npcId } = req.params;
      
      const personalitySeed = await npcGenerationService.getPersonalitySeed(npcId);
      
      if (!personalitySeed) {
        return res.status(404).json({
          error: 'Personality seed not found for NPC'
        });
      }
      
      res.json({
        success: true,
        personalitySeed
      });

    } catch (error) {
      console.error('Error in GET /dating/personality-seed/:npcId:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // ============================================
  // GAME SERVER COMMUNICATION ROUTES
  // ============================================

  // POST /dating/event - Handle events from game server
  router.post('/event', async (req, res) => {
    try {
      const { type, data } = req.body;

      if (!type || !data) {
        return res.status(400).json({
          error: 'Missing required fields: type, data'
        });
      }

      console.log(`🎮 [DATING_ROUTES] Received event from game server: ${type}`);

      switch (type) {
        case 'speed_dating_initialized':
          await speedDatingService.storeInitialEventWithMatches(data.event);
          break;

        case 'vibe_score_recorded':
          await speedDatingService.storeVibeScore(data.vibeEntry);
          break;
          
        case 'speed_dating_conversation_memory':
          // Store conversation memories like normal conversations
          await speedDatingService.storeConversationMemory(data);
          break;

        case 'match_created':
          // This case is now deprecated in favor of 'speed_dating_initialized'
          // but we'll leave it here for backward compatibility or debugging.
          console.warn('⚠️ [DATING_ROUTES] Received deprecated "match_created" event. Please use "speed_dating_initialized".');
          await speedDatingService.storeMatch(data.match);
          break;

        case 'post_date_assessment':
          const assessment = await speedDatingService.processDateAssessment(data);
          res.json({
            success: true,
            message: 'Date assessment completed',
            assessment
          });
          return;

        case 'post_gauntlet_reflection':
          const rankings = await speedDatingService.processGauntletRanking(data);
          res.json({
            success: true,
            message: 'Gauntlet ranking completed',
            rankings
          });
          return;

        case 'event_created':
          // This case is now deprecated in favor of 'speed_dating_initialized'
          console.warn('⚠️ [DATING_ROUTES] Received deprecated "event_created" event. Please use "speed_dating_initialized".');
          break;
          
        case 'player_registered':
        case 'npcs_registered':
          // These are informational events, just log them
          console.log(`📝 [DATING_ROUTES] Event logged: ${type}`, data);
          break;

        default:
          console.warn(`⚠️ [DATING_ROUTES] Unknown event type: ${type}`);
      }

      res.json({
        success: true,
        message: `Event ${type} processed successfully`
      });

    } catch (error) {
      console.error('Error in POST /dating/event:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // ============================================
  // TESTING AND DEBUG ROUTES
  // ============================================

  // POST /dating/test-assessment - Test date assessment with sample data
  router.post('/test-assessment', async (req, res) => {
    try {
      const { npcId, conversationTranscript } = req.body;

      if (!npcId || !conversationTranscript) {
        return res.status(400).json({
          error: 'Missing required fields: npcId, conversationTranscript'
        });
      }

      const testRequest = {
        matchId: 999999, // Test match ID
        playerId: 'test_player',
        npcId,
        conversationTranscript,
        vibeScores: []
      };

      const assessment = await speedDatingService.processDateAssessment(testRequest);

      res.json({
        success: true,
        message: 'Test assessment completed',
        assessment
      });

    } catch (error) {
      console.error('Error in POST /dating/test-assessment:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /dating/test-ranking - Test gauntlet ranking with sample data
  router.post('/test-ranking', async (req, res) => {
    try {
      const { npcId, playerIds } = req.body;

      if (!npcId || !playerIds || !Array.isArray(playerIds)) {
        return res.status(400).json({
          error: 'Missing required fields: npcId, playerIds (array)'
        });
      }

      const testMatches = playerIds.map((playerId: string, index: number) => ({
        id: 999900 + index,
        playerId,
        npcId,
        matchOrder: index + 1,
        status: 'completed'
      }));

      const testRequest = {
        eventId: 999999,
        npcId,
        matches: testMatches,
        vibeScores: []
      };

      const rankings = await speedDatingService.processGauntletRanking(testRequest);

      res.json({
        success: true,
        message: 'Test ranking completed',
        rankings
      });

    } catch (error) {
      console.error('Error in POST /dating/test-ranking:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /dating/debug/config - Get dating system configuration
  router.get('/debug/config', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM dating_system_config ORDER BY config_key');
      
      res.json({
        success: true,
        config: result.rows
      });

    } catch (error) {
      console.error('Error in GET /dating/debug/config:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  return router;
} 