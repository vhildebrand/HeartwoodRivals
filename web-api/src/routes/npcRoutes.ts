import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import Queue from 'bull';

export function npcRoutes(pool: Pool, redisClient: ReturnType<typeof createClient>) {
  const router = express.Router();

  // Create a Redis queue for LLM conversation jobs
  const conversationQueue = new Queue('conversation', {
    redis: {
      host: 'redis',
      port: 6379,
    },
  });

  // POST /npc/generate-plan - Debug endpoint to trigger plan generation
  router.post('/generate-plan', async (req, res) => {
    try {
      const { npcId, forceRegenerate } = req.body;

      if (!npcId) {
        return res.status(400).json({
          error: 'Missing required field: npcId'
        });
      }

      // Verify Agent exists
      const agentResult = await pool.query(
        'SELECT id, name, constitution FROM agents WHERE id = $1',
        [npcId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Create a Redis message to trigger plan generation
      const message = {
        agentId: npcId,
        agentName: agent.name,
        forceRegenerate: forceRegenerate || false,
        timestamp: Date.now()
      };

      await redisClient.publish('generate_plan', JSON.stringify(message));

      console.log(`📋 [NPC_ROUTES] Plan generation triggered for ${agent.name} (force: ${forceRegenerate || false})`);

      res.json({
        success: true,
        message: `Plan generation triggered for ${agent.name}${forceRegenerate ? ' (forced)' : ''}`,
        agentId: npcId,
        forceRegenerate: forceRegenerate || false
      });

    } catch (error) {
      console.error('❌ [NPC_ROUTES] Error in /npc/generate-plan:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /npc/list - Get list of all NPCs for debug panel
  router.get('/list', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, current_location, current_activity FROM agents ORDER BY name'
      );

      res.json({
        agents: result.rows
      });

    } catch (error) {
      console.error('Error in /npc/list:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /npc/interact - Main endpoint for NPC conversations
  router.post('/interact', async (req, res) => {
    try {
      const { npcId, message, characterId, context, contextDetails } = req.body;

      // Validate request
      if (!npcId || !message) {
        return res.status(400).json({
          error: 'Missing required fields: npcId and message'
        });
      }

      if (typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          error: 'Message must be a non-empty string'
        });
      }

      // Use provided characterId or fall back to dummy for backward compatibility
      const actualCharacterId = characterId || 'test-character-id';

      // Check rate limiting (1 message per 5 seconds per user)
      const rateLimitKey = `ratelimit:interact:${actualCharacterId}`;
      const rateLimitCheck = await redisClient.get(rateLimitKey);
      
      if (rateLimitCheck) {
        return res.status(429).json({
          error: 'Rate limit exceeded. Please wait before sending another message.'
        });
      }

      // Set rate limit
      await redisClient.setEx(rateLimitKey, 5, 'limited');

      // Verify Agent exists
      const agentResult = await pool.query(
        'SELECT id, name, constitution FROM agents WHERE id = $1',
        [npcId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Add conversation job to queue
      const jobData = {
        npcId: agent.id,
        npcName: agent.name,
        constitution: agent.constitution,
        characterId: actualCharacterId,
        playerMessage: message.trim(),
        timestamp: Date.now(),
        context: context || 'general', // Add context (speed_dating or general)
        contextDetails: contextDetails || {} // Add context details
      };

      const job = await conversationQueue.add('processConversation', jobData);

      // Return job ID for tracking
      res.status(202).json({
        jobId: job.id,
        status: 'processing',
        message: 'Conversation job queued successfully'
      });

    } catch (error) {
      console.error('Error in /npc/interact:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /npc/conversation/:jobId - Check conversation job status
  router.get('/conversation/:jobId', async (req, res) => {
    try {
      const jobId = req.params.jobId;
      const job = await conversationQueue.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          error: 'Job not found'
        });
      }

      const status = await job.getState();
      
      if (status === 'completed') {
        res.json({
          status: 'completed',
          response: job.returnvalue
        });
      } else if (status === 'failed') {
        res.json({
          status: 'failed',
          error: job.failedReason
        });
      } else {
        res.json({
          status: status,
          message: 'Job is still processing'
        });
      }

    } catch (error) {
      console.error('Error checking job status:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /npc/conversation-end - Handle conversation end for post-conversation reflection
  router.post('/conversation-end', async (req, res) => {
    try {
      const { npcId, npcName, characterId, conversationHistory, startTime, endTime, duration } = req.body;

      // Validate request
      if (!npcId || !conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({
          error: 'Missing required fields: npcId, conversationHistory'
        });
      }

      // Only process conversations that actually had content
      if (conversationHistory.length === 0) {
        return res.status(200).json({
          message: 'Empty conversation - no reflection needed'
        });
      }

      console.log(`💬 [NPC_ROUTES] Conversation ended with ${npcName} (${npcId})`);
      console.log(`💬 [NPC_ROUTES] Duration: ${duration}ms, Messages: ${conversationHistory.length}`);

      // Queue conversation for post-conversation reflection
      const reflectionData = {
        npcId,
        npcName,
        characterId,
        conversationHistory,
        startTime,
        endTime,
        duration,
        timestamp: Date.now()
      };

      await redisClient.lPush('conversation_reflection_queue', JSON.stringify(reflectionData));
      
      res.json({
        success: true,
        message: `Conversation reflection queued for ${npcName}`,
        conversationLength: conversationHistory.length
      });

    } catch (error) {
      console.error('Error in /npc/conversation-end:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // === DEBUG ENDPOINTS FOR CONVERSATION TESTING ===

  // POST /npc/debug/force-player-conversation - Force an NPC to initiate conversation with a player
  router.post('/debug/force-player-conversation', async (req, res) => {
    try {
      const { npcId, playerId, topic, approach, openingMessage } = req.body;

      if (!npcId || !playerId) {
        return res.status(400).json({
          error: 'Missing required fields: npcId, playerId'
        });
      }

      // Verify NPC exists
      const npcResult = await pool.query(
        'SELECT id, name, current_location FROM agents WHERE id = $1',
        [npcId]
      );

      if (npcResult.rows.length === 0) {
        return res.status(404).json({
          error: 'NPC not found'
        });
      }

      const npc = npcResult.rows[0];

      // Create conversation initiation message
      const conversationData = {
        agentId: npcId,
        target: playerId,
        topic: topic || 'general conversation',
        approach: approach || 'friendly',
        timing: 'immediate',
        opening_message: openingMessage || `Hello! I wanted to talk with you about something.`,
        forced_debug: true,
        timestamp: Date.now()
      };

      // Publish to initiate_conversation channel (same channel the ThoughtSystem uses)
      await redisClient.publish('initiate_conversation', JSON.stringify(conversationData));

      console.log(`🐛 [DEBUG] Forced conversation initiation: ${npc.name} -> Player ${playerId}`);
      console.log(`🐛 [DEBUG] Topic: ${conversationData.topic}, Opening: "${conversationData.opening_message}"`);

      res.json({
        success: true,
        message: `Forced conversation initiation between ${npc.name} and player ${playerId}`,
        conversationData: conversationData
      });

    } catch (error) {
      console.error('❌ [DEBUG] Error in force-player-conversation:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /npc/debug/force-npc-conversation - Force two NPCs to start a conversation
  router.post('/debug/force-npc-conversation', async (req, res) => {
    try {
      const { initiatorId, targetId, topic, approach, openingMessage } = req.body;

      if (!initiatorId || !targetId) {
        return res.status(400).json({
          error: 'Missing required fields: initiatorId, targetId'
        });
      }

      if (initiatorId === targetId) {
        return res.status(400).json({
          error: 'Initiator and target cannot be the same NPC'
        });
      }

      // Verify both NPCs exist
      const npcsResult = await pool.query(
        'SELECT id, name, current_location FROM agents WHERE id = ANY($1)',
        [[initiatorId, targetId]]
      );

      if (npcsResult.rows.length < 2) {
        return res.status(404).json({
          error: 'One or both NPCs not found'
        });
      }

      const initiator = npcsResult.rows.find(npc => npc.id === initiatorId);
      const target = npcsResult.rows.find(npc => npc.id === targetId);

      // Create conversation initiation message (NPC-NPC)
      const conversationData = {
        agentId: initiatorId,
        target: targetId,
        topic: topic || 'general conversation',
        approach: approach || 'friendly',
        timing: 'immediate',
        opening_message: openingMessage || `Hi ${target.name}! I wanted to chat with you about something.`,
        forced_debug: true,
        timestamp: Date.now()
      };

      // Publish to initiate_conversation channel
      await redisClient.publish('initiate_conversation', JSON.stringify(conversationData));

      console.log(`🐛 [DEBUG] Forced NPC-NPC conversation: ${initiator.name} -> ${target.name}`);
      console.log(`🐛 [DEBUG] Topic: ${conversationData.topic}, Opening: "${conversationData.opening_message}"`);

      res.json({
        success: true,
        message: `Forced NPC-NPC conversation between ${initiator.name} and ${target.name}`,
        conversationData: conversationData
      });

    } catch (error) {
      console.error('❌ [DEBUG] Error in force-npc-conversation:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /npc/debug/conversation-status - Get current conversation status and debug info
  router.get('/debug/conversation-status', async (req, res) => {
    try {
      // Get active conversations from game server (we'll need to query Redis or add this to game state)
      // For now, return debug info about conversation system status

      // Check Redis for recent conversation messages
      const recentConversations = await redisClient.lRange('conversation_debug_log', 0, 9);

      // Get NPC locations and activities
      const npcsResult = await pool.query(`
        SELECT id, name, current_location, current_activity, 
               EXTRACT(EPOCH FROM last_activity_change) as last_activity_timestamp
        FROM agents 
        ORDER BY last_activity_change DESC 
        LIMIT 20
      `);

      // Check for recent conversation intentions
      const intentionsResult = await pool.query(`
        SELECT agent_id, target, topic, approach, timing, created_at
        FROM conversation_intentions 
        ORDER BY created_at DESC 
        LIMIT 10
      `).catch(() => ({ rows: [] })); // Table might not exist yet

      res.json({
        success: true,
        debug: {
          recentConversationAttempts: recentConversations.map(conv => {
            try {
              return JSON.parse(conv);
            } catch {
              return conv;
            }
          }),
          recentNPCActivities: npcsResult.rows.map(npc => ({
            ...npc,
            last_activity_timestamp: npc.last_activity_timestamp ? new Date(npc.last_activity_timestamp * 1000).toISOString() : null
          })),
          conversationIntentions: intentionsResult.rows || [],
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ [DEBUG] Error getting conversation status:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /npc/debug/trigger-thought - Force a specific NPC to generate thoughts (which might lead to conversations)
  router.post('/debug/trigger-thought', async (req, res) => {
    try {
      const { npcId, thoughtTrigger, importance } = req.body;

      if (!npcId || !thoughtTrigger) {
        return res.status(400).json({
          error: 'Missing required fields: npcId, thoughtTrigger'
        });
      }

      // Verify NPC exists
      const npcResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [npcId]
      );

      if (npcResult.rows.length === 0) {
        return res.status(404).json({
          error: 'NPC not found'
        });
      }

      const npc = npcResult.rows[0];

      // Create forced thought trigger
      const thoughtData = {
        agentId: npcId,
        agentName: npc.name,
        trigger: thoughtTrigger,
        importance: importance || 7,
        forced_debug: true,
        timestamp: Date.now()
      };

      // Publish to thought system trigger
      await redisClient.publish('force_thought_generation', JSON.stringify(thoughtData));

      console.log(`🐛 [DEBUG] Forced thought generation for ${npc.name}: ${thoughtTrigger}`);

      res.json({
        success: true,
        message: `Forced thought generation for ${npc.name}`,
        thoughtData: thoughtData
      });

    } catch (error) {
      console.error('❌ [DEBUG] Error in trigger-thought:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /npc/test-urgent-scenario - Test urgent scenarios for different character types
  router.post('/test-urgent-scenario', async (req, res) => {
    try {
      const { npcId, scenario } = req.body;

      if (!npcId || !scenario) {
        return res.status(400).json({
          error: 'Missing required fields: npcId, scenario'
        });
      }

      // Verify Agent exists
      const agentResult = await pool.query(
        'SELECT id, name, constitution FROM agents WHERE id = $1',
        [npcId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Predefined urgent scenarios for testing
      const urgentScenarios = {
        'medical_emergency': {
          urgencyLevel: 9,
          reason: 'Medical emergency requiring immediate attention',
          conversationText: `Player: Doctor, there's been a terrible accident at the docks! Someone is badly injured and needs immediate medical attention!\n${agent.name}: I need to go help them right away!`
        },
        'fire_emergency': {
          urgencyLevel: 9,
          reason: 'Fire emergency requiring immediate response',
          conversationText: `Player: The church is on fire! We need help immediately!\n${agent.name}: This is an emergency! I need to respond right away!`
        },
        'police_emergency': {
          urgencyLevel: 8,
          reason: 'Criminal emergency requiring immediate police response',
          conversationText: `Player: Officer, there's a robbery happening at the market right now!\n${agent.name}: I need to respond to this criminal emergency immediately!`
        },
        'exciting_opportunity': {
          urgencyLevel: 7,
          reason: 'Exciting personal opportunity that requires immediate action',
          conversationText: `Player: Hey, your favorite musician is performing at the tavern right now! They're only here for one show!\n${agent.name}: Oh my goodness, I've been waiting for this opportunity for years!`
        },
        'old_friend_visit': {
          urgencyLevel: 7,
          reason: 'Old friend is visiting and requires immediate social response',
          conversationText: `Player: Your old friend from childhood is at the tavern and asking for you! They're leaving town tomorrow!\n${agent.name}: I haven't seen them in years! I need to go right away!`
        },
        'routine_conversation': {
          urgencyLevel: 2,
          reason: 'Routine conversation with no urgent action needed',
          conversationText: `Player: How's your day going?\n${agent.name}: It's going well, thank you for asking!`
        },
        'market_delivery_today': {
          urgencyLevel: 5,
          reason: 'Time-sensitive delivery that should be done today but not immediately',
          conversationText: `Player: The market needs your special bread delivery before they close today at 6pm.\n${agent.name}: I should make sure to get that delivered this afternoon.`
        },
        'town_meeting_tonight': {
          urgencyLevel: 6,
          reason: 'Important town meeting tonight requiring schedule adjustment',
          conversationText: `Player: Don't forget there's an important town meeting tonight at 7pm about the new trade routes.\n${agent.name}: That's right, I need to make sure I'm there for that discussion.`
        },
        'seasonal_ingredient_available': {
          urgencyLevel: 4,
          reason: 'Seasonal ingredient available today but can wait a few hours',
          conversationText: `Player: The fisherman just brought in some rare sea salt that you wanted for your recipes. He'll be at the dock until late afternoon.\n${agent.name}: Oh wonderful! I should visit him later today to get some of that special salt.`
        },
        'library_book_due': {
          urgencyLevel: 3,
          reason: 'Library book due today but low priority',
          conversationText: `Player: Just a reminder that your library book is due today.\n${agent.name}: Thanks for reminding me, I should return it when I have a chance.`
        },
        'weather_change_preparation': {
          urgencyLevel: 5,
          reason: 'Weather change requiring preparation but not immediate action',
          conversationText: `Player: The weather forecast shows a storm coming this evening. You might want to prepare your outdoor equipment.\n${agent.name}: Good point, I should secure things before the storm hits tonight.`
        }
      };

      const selectedScenario = urgentScenarios[scenario as keyof typeof urgentScenarios];
      if (!selectedScenario) {
        return res.status(400).json({
          error: 'Invalid scenario. Available scenarios: ' + Object.keys(urgentScenarios).join(', ')
        });
      }

      console.log(`🧪 [TEST] Testing urgent scenario '${scenario}' for ${agent.name}`);
      console.log(`🧪 [TEST] Urgency Level: ${selectedScenario.urgencyLevel}`);
      console.log(`🧪 [TEST] Conversation: ${selectedScenario.conversationText}`);

      // Create test conversation history
      const conversationHistory = [
        {
          message: selectedScenario.conversationText.split('\n')[0].replace('Player: ', ''),
          sender: 'player' as const,
          timestamp: Date.now() - 1000
        },
        {
          message: selectedScenario.conversationText.split('\n')[1].replace(`${agent.name}: `, ''),
          sender: 'npc' as const,
          timestamp: Date.now()
        }
      ];

      // Queue conversation for reflection (simulating end of conversation)
      const reflectionData = {
        npcId,
        npcName: agent.name,
        characterId: 'test-character-urgent',
        conversationHistory,
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        timestamp: Date.now()
      };

      await redisClient.lPush('conversation_reflection_queue', JSON.stringify(reflectionData));

      res.json({
        success: true,
        message: `Urgent scenario '${scenario}' queued for ${agent.name}`,
        agent: {
          id: agent.id,
          name: agent.name
        },
        scenario: {
          name: scenario,
          urgencyLevel: selectedScenario.urgencyLevel,
          reason: selectedScenario.reason
        },
        conversationHistory
      });

    } catch (error) {
      console.error('Error in /npc/test-urgent-scenario:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /npc/test-scenarios - List available test scenarios
  router.get('/test-scenarios', async (req, res) => {
    try {
      const scenarios = {
        'medical_emergency': {
          description: 'Medical emergency requiring immediate attention (urgency 9)',
          bestFor: ['dr_helena', 'medical staff'],
          expectedResponse: 'Immediate medical response with emergency_response activity'
        },
        'fire_emergency': {
          description: 'Fire emergency requiring immediate response (urgency 9)',
          bestFor: ['fire_chief', 'community members'],
          expectedResponse: 'Immediate fire response with fire_response activity'
        },
        'police_emergency': {
          description: 'Criminal emergency requiring immediate police response (urgency 8)',
          bestFor: ['officer_blake', 'police officers'],
          expectedResponse: 'Immediate police response with police_response activity'
        },
        'exciting_opportunity': {
          description: 'Exciting personal opportunity (urgency 7)',
          bestFor: ['music lovers', 'social NPCs'],
          expectedResponse: 'Immediate social response with entertainment/social activity'
        },
        'old_friend_visit': {
          description: 'Old friend visiting (urgency 7)',
          bestFor: ['social NPCs', 'any character'],
          expectedResponse: 'Immediate social response with social/visit activity'
        },
        'routine_conversation': {
          description: 'Routine conversation (urgency 2)',
          bestFor: ['any character'],
          expectedResponse: 'No urgent action, regular memory storage'
        },
        'market_delivery_today': {
          description: 'Time-sensitive delivery needed today (urgency 5)',
          bestFor: ['isabella_baker', 'merchants', 'traders'],
          expectedResponse: 'Scheduled for this afternoon, not immediate'
        },
        'town_meeting_tonight': {
          description: 'Important town meeting tonight (urgency 6)',
          bestFor: ['mayor_henderson', 'community leaders', 'any character'],
          expectedResponse: 'Scheduled for evening, high priority'
        },
        'seasonal_ingredient_available': {
          description: 'Seasonal ingredient available today (urgency 4)',
          bestFor: ['isabella_baker', 'sophia_apothecary', 'chefs'],
          expectedResponse: 'Scheduled for later today when convenient'
        },
        'library_book_due': {
          description: 'Library book due today (urgency 3)',
          bestFor: ['professor_cornelius', 'maya_teacher', 'any character'],
          expectedResponse: 'Scheduled when convenient, low priority'
        },
        'weather_change_preparation': {
          description: 'Storm preparation needed before evening (urgency 5)',
          bestFor: ['oliver_lighthouse_keeper', 'william_shipwright', 'outdoor workers'],
          expectedResponse: 'Scheduled for before evening, moderate priority'
        }
      };

      res.json({
        success: true,
        scenarios,
        usage: {
          testEndpoint: 'POST /npc/test-urgent-scenario',
          parameters: {
            npcId: 'Agent ID to test (e.g., dr_helena, officer_blake)',
            scenario: 'Scenario name from the list above'
          }
        }
      });

    } catch (error) {
      console.error('Error in /npc/test-scenarios:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  return router;
} 