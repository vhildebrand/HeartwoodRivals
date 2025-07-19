import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from '../services/AgentMemoryManager';
import OpenAI from 'openai';

export function thoughtRoutes(pool: Pool, redisClient: ReturnType<typeof createClient>) {
  const router = express.Router();
  const memoryManager = new AgentMemoryManager(pool, redisClient);
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // POST /thought/trigger-immediate - Trigger immediate thought that may interrupt current activity
  router.post('/trigger-immediate', async (req, res) => {
    try {
      const { agentId, eventType, eventData, importance } = req.body;

      if (!agentId || !eventType) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, eventType'
        });
      }

      // Verify agent exists
      const agentResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Process immediate thought
      const result = await processImmediateThought(agentId, eventType, eventData, importance || 8);

      res.json({
        success: true,
        message: `Immediate thought triggered for ${agent.name}`,
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/trigger-immediate:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/trigger-scheduled - Trigger thought that may schedule future activity
  router.post('/trigger-scheduled', async (req, res) => {
    try {
      const { agentId, eventType, eventData, importance } = req.body;

      if (!agentId || !eventType) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, eventType'
        });
      }

      // Verify agent exists
      const agentResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Process scheduled thought
      const result = await processScheduledThought(agentId, eventType, eventData, importance || 6);

      res.json({
        success: true,
        message: `Scheduled thought triggered for ${agent.name}`,
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/trigger-scheduled:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/trigger-goal-reflection - Trigger evening goal reflection
  router.post('/trigger-goal-reflection', async (req, res) => {
    try {
      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({
          error: 'Missing required field: agentId'
        });
      }

      // Verify agent exists
      const agentResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Process goal reflection
      const result = await processGoalReflection(agentId);

      res.json({
        success: true,
        message: `Goal reflection triggered for ${agent.name}`,
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/trigger-goal-reflection:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/pre-response-thinking - Trigger pre-response thinking for conversations
  router.post('/pre-response-thinking', async (req, res) => {
    try {
      const { agentId, playerMessage, characterId } = req.body;

      if (!agentId || !playerMessage) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, playerMessage'
        });
      }

      // Process pre-response thinking
      const result = await processPreResponseThinking(agentId, playerMessage, characterId);

      res.json({
        success: true,
        message: 'Pre-response thinking completed',
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/pre-response-thinking:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/evaluate-truth - Trigger truth evaluation
  router.post('/evaluate-truth', async (req, res) => {
    try {
      const { agentId, statement, speaker } = req.body;

      if (!agentId || !statement) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, statement'
        });
      }

      // Process truth evaluation
      const result = await processTruthEvaluation(agentId, statement, speaker);

      res.json({
        success: true,
        message: 'Truth evaluation completed',
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/evaluate-truth:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/relationship-thinking - Trigger relationship thinking
  router.post('/relationship-thinking', async (req, res) => {
    try {
      const { agentId, targetPerson, context } = req.body;

      if (!agentId || !targetPerson) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, targetPerson'
        });
      }

      // Process relationship thinking
      const result = await processRelationshipThinking(agentId, targetPerson, context);

      res.json({
        success: true,
        message: 'Relationship thinking completed',
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/relationship-thinking:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /thought/status/:agentId - Get thought processing status for an agent
  router.get('/status/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;

      // Get recent thoughts
      const thoughtsResult = await pool.query(`
        SELECT * FROM agent_thoughts 
        WHERE agent_id = $1 
        ORDER BY created_at DESC 
        LIMIT 10
      `, [agentId]);

      // Get thought limits
      const limitsResult = await pool.query(`
        SELECT * FROM thought_limits 
        WHERE agent_id = $1 AND date = CURRENT_DATE
      `, [agentId]);

      // Get conversation intentions
      const intentionsResult = await pool.query(`
        SELECT * FROM conversation_intentions 
        WHERE agent_id = $1 AND status = 'pending'
        ORDER BY created_at DESC
      `, [agentId]);

      res.json({
        agentId,
        recentThoughts: thoughtsResult.rows,
        dailyLimits: limitsResult.rows[0] || null,
        conversationIntentions: intentionsResult.rows
      });

    } catch (error) {
      console.error('Error in /thought/status:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/process - Unified thought processing (Phase 1)
  router.post('/process', async (req, res) => {
    try {
      const { agentId, eventType, eventData, importance } = req.body;

      if (!agentId || !eventType) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, eventType'
        });
      }

      // Verify agent exists
      const agentResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Process unified thought
      const result = await processUnifiedThought(agentId, eventType, eventData, importance || 5);

      // Execute all actions from the unified thought
      if (result.actions && result.actions.length > 0) {
        for (const action of result.actions) {
          if (action.type !== 'none') {
            await executeUnifiedThoughtAction(agentId, action);
          }
        }
      }

      res.json({
        success: true,
        message: `Unified thought processed for ${agent.name}`,
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/process:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/conversation-recall - Lightweight memory recall for conversations
  router.post('/conversation-recall', async (req, res) => {
    try {
      const { agentId, playerMessage, characterId } = req.body;

      if (!agentId || !playerMessage) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, playerMessage'
        });
      }

      // Verify agent exists
      const agentResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Lightweight conversation memory recall
      const result = await processConversationMemoryRecall(agentId, playerMessage, characterId);

      res.json({
        success: true,
        message: `Memory recall completed for ${agent.name}`,
        agentId,
        memoryRecall: result
      });

    } catch (error) {
      console.error('Error in /thought/conversation-recall:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/conversation-complete - Process thoughts after conversation ends
  router.post('/conversation-complete', async (req, res) => {
    try {
      const { agentId, conversationSummary, duration, importance } = req.body;

      if (!agentId || !conversationSummary) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, conversationSummary'
        });
      }

      // Verify agent exists
      const agentResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Process post-conversation thoughts using unified system
      const result = await processUnifiedThought(agentId, 'conversation_complete', {
        conversationSummary,
        duration,
        importance
      }, importance || 5);

      // Execute all actions from the unified thought
      if (result.actions && result.actions.length > 0) {
        for (const action of result.actions) {
          if (action.type !== 'none') {
            await executeUnifiedThoughtAction(agentId, action);
          }
        }
      }

      res.json({
        success: true,
        message: `Post-conversation thoughts processed for ${agent.name}`,
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/conversation-complete:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /thought/speed-dating-evaluation - Process thoughts during speed dating
  router.post('/speed-dating-evaluation', async (req, res) => {
    try {
      const { agentId, playerMessage, playerResponse, matchContext } = req.body;

      if (!agentId || !playerMessage) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, playerMessage'
        });
      }

      // Verify agent exists
      const agentResult = await pool.query(
        'SELECT id, name FROM agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];

      // Process speed dating evaluation
      const result = await processSpeedDatingEvaluation(agentId, playerMessage, playerResponse, matchContext);

      res.json({
        success: true,
        message: `Speed dating evaluation completed for ${agent.name}`,
        agentId,
        thoughtResult: result
      });

    } catch (error) {
      console.error('Error in /thought/speed-dating-evaluation:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // Speed Dating Vibe Score Endpoint - Real-time evaluation
  router.post('/speed-dating-vibe', async (req, res) => {
    try {
      const { agentId, playerMessage, matchContext } = req.body;
      
      // Get agent personality and preferences
      const agentResult = await pool.query(`
        SELECT * FROM agents WHERE id = $1
      `, [agentId]);

      const agent = agentResult.rows[0];
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Parse personality seed for dating preferences
      let personalitySeed = null;
      if (agent.personality_seed) {
        try {
          personalitySeed = JSON.parse(agent.personality_seed);
        } catch (error) {
          console.error(`Error parsing personality seed for ${agentId}:`, error);
        }
      }

      // Build prompt for vibe evaluation
      const prompt = `You are ${agent.name}, evaluating a message from someone you're speed dating.

YOUR PERSONALITY:
${agent.constitution}

YOUR DATING PREFERENCES:
${personalitySeed ? `
- Dating style: ${personalitySeed.datingStyle}
- Attraction triggers: ${personalitySeed.attractionTriggers?.join(', ')}
- Dealbreakers: ${personalitySeed.dealbreakers?.join(', ')}
- Conversation style: ${personalitySeed.conversationStyle}
` : 'Standard preferences'}

THEIR MESSAGE: "${playerMessage}"

Evaluate this message for romantic compatibility. Consider:
1. Does it align with your interests and values?
2. Does it trigger attraction or turn-offs?
3. Is their communication style appealing to you?
4. Do they show genuine interest or understanding?

Respond with a JSON object:
{
  "vibeScore": -10 to +10 (negative for turn-offs, positive for attraction),
  "vibeReason": "Brief explanation of your reaction",
  "attractionFactors": ["list", "of", "specific", "things", "you", "liked"],
  "turnOffFactors": ["list", "of", "specific", "things", "you", "disliked"],
  "emotionalReaction": "How this makes you feel emotionally"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 200
      });

      const vibeEvaluation = parseVibeResponse(response.choices[0].message.content);
      
      res.json({
        vibeScore: vibeEvaluation.vibeScore,
        vibeReason: vibeEvaluation.vibeReason,
        evaluation: vibeEvaluation,
        success: true
      });
    } catch (error) {
      console.error('Error in speed dating vibe evaluation:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Helper functions for thought processing
  async function processImmediateThought(agentId: string, eventType: string, eventData: any, importance: number) {
    // Get agent context
    const context = await buildThoughtContext(agentId, eventType, eventData);
    
    // Generate thought using LLM
    const prompt = buildImmediateThoughtPrompt(context, eventType, eventData);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const result = parseThoughtResponse(response.choices[0].message.content);
    
    // Store thought in database
    await storeThought(agentId, 'immediate_interruption', eventType, eventData, result);
    
    // Execute action if needed
    if (result.action && result.action.type !== 'none') {
      await executeThoughtAction(agentId, result);
    }

    return result;
  }

  async function processScheduledThought(agentId: string, eventType: string, eventData: any, importance: number) {
    // Get agent context
    const context = await buildThoughtContext(agentId, eventType, eventData);
    
    // Generate thought using LLM
    const prompt = buildScheduledThoughtPrompt(context, eventType, eventData);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const result = parseThoughtResponse(response.choices[0].message.content);
    
    // Store thought in database
    await storeThought(agentId, 'scheduled_activity', eventType, eventData, result);
    
    // Execute action if needed
    if (result.action && result.action.type !== 'none') {
      await executeThoughtAction(agentId, result);
    }

    return result;
  }

  async function processGoalReflection(agentId: string) {
    // Get agent context
    const context = await buildThoughtContext(agentId, 'goal_reflection', {});
    
    // Generate thought using LLM
    const prompt = buildGoalReflectionPrompt(context);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.7
    });

    const result = parseThoughtResponse(response.choices[0].message.content);
    
    // Store thought in database
    await storeThought(agentId, 'goal_reflection', 'evening_reflection', {}, result);
    
    // Execute action if needed
    if (result.action && result.action.type !== 'none') {
      await executeThoughtAction(agentId, result);
    }

    return result;
  }

  async function processPreResponseThinking(agentId: string, playerMessage: string, characterId: string) {
    // Get agent context
    const context = await buildThoughtContext(agentId, 'conversation', { playerMessage, characterId });
    
    // Generate thought using LLM
    const prompt = buildPreResponseThinkingPrompt(context, playerMessage);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });

    const result = parseThoughtResponse(response.choices[0].message.content);
    
    // Store thought in database
    await storeThought(agentId, 'pre_response_thinking', 'conversation', { playerMessage, characterId }, result);

    return result;
  }

  async function processTruthEvaluation(agentId: string, statement: string, speaker: string) {
    // Get agent context
    const context = await buildThoughtContext(agentId, 'truth_evaluation', { statement, speaker });
    
    // Generate thought using LLM
    const prompt = buildTruthEvaluationPrompt(context, statement, speaker);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });

    const result = parseThoughtResponse(response.choices[0].message.content);
    
    // Store thought in database
    await storeThought(agentId, 'truth_evaluation', 'conversation', { statement, speaker }, result);

    return result;
  }

  async function processRelationshipThinking(agentId: string, targetPerson: string, context: string) {
    // Get agent context
    const agentContext = await buildThoughtContext(agentId, 'relationship_thinking', { targetPerson, context });
    
    // Generate thought using LLM
    const prompt = buildRelationshipThinkingPrompt(agentContext, targetPerson, context);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.7
    });

    const result = parseThoughtResponse(response.choices[0].message.content);
    
    // Store thought in database
    await storeThought(agentId, 'relationship_thinking', 'internal_reflection', { targetPerson, context }, result);

    return result;
  }

  async function processUnifiedThought(agentId: string, eventType: string, eventData: any, importance: number) {
    // Get agent context
    const context = await buildThoughtContext(agentId, eventType, eventData);
    
    // Generate thought using LLM
    const prompt = buildUnifiedThoughtPrompt(context, eventType, eventData);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const result = parseUnifiedThoughtResponse(response.choices[0].message.content);
    
    // Store thought in database
    await storeThought(agentId, 'unified_thought', eventType, eventData, result);
    
    // Execute all actions from the unified thought
    if (result.actions && result.actions.length > 0) {
      for (const action of result.actions) {
        if (action.type !== 'none') {
          await executeUnifiedThoughtAction(agentId, action);
        }
      }
    }

    return result;
  }

  async function executeUnifiedThoughtAction(agentId: string, action: any) {
    console.log(`🎯 [UNIFIED_THOUGHT] Executing action for ${agentId}:`, action);
    
    switch (action.type) {
      case 'immediate_activity':
        // Handle immediate activities - interrupt current activity
        if (action.timing === 'now') {
          console.log(`🚨 [UNIFIED_THOUGHT] Immediate activity change: ${action.details.activity}`);
          await redisClient.publish('game_server_activity_change', JSON.stringify({
            agentId,
            activityName: action.details.activity,
            priority: 10,
            interruptCurrent: true,
            parameters: {
              specificLocation: action.details.location,
              reason: action.details.reason,
              thoughtTriggered: true,
              unified: true
            }
          }));
        }
        break;
        
      case 'scheduled_activity':
        // Handle scheduled activities based on timing
        let scheduledTime;
        let priority = 5;
        let isFlexible = true;
        
        switch (action.timing) {
          case 'later_today':
            // Schedule for later today - specific time or flexible
            scheduledTime = action.details.time || 'later_today';
            priority = 7;
            isFlexible = !action.details.time; // Flexible if no specific time
            break;
            
          case 'tomorrow':
            scheduledTime = action.details.time || 'tomorrow';
            priority = 6;
            isFlexible = true;
            break;
            
          case 'when_convenient':
            scheduledTime = 'when_convenient';
            priority = 4;
            isFlexible = true;
            break;
            
          default:
            // Default to flexible scheduling
            scheduledTime = action.details.time || 'when_convenient';
            priority = 5;
            isFlexible = true;
        }
        
        console.log(`📅 [UNIFIED_THOUGHT] Scheduling activity: ${action.details.activity} for ${scheduledTime}`);
        
        // Store scheduled activity
        await pool.query(`
          INSERT INTO agent_schedules (agent_id, start_time, activity, location, priority, is_flexible)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [agentId, scheduledTime, action.details.activity, action.details.location, priority, isFlexible]);
        break;
        
      case 'modify_goals':
        // Update agent goals
        console.log(`🎯 [UNIFIED_THOUGHT] Modifying goals for ${agentId}`);
        await pool.query(`
          UPDATE agents 
          SET primary_goal = $1, secondary_goals = $2, updated_at = NOW()
          WHERE id = $3
        `, [action.details.primary_goal, action.details.secondary_goals, agentId]);
        break;
        
      case 'initiate_conversation':
        // Store conversation intention with timing
        console.log(`💬 [UNIFIED_THOUGHT] Planning conversation: ${agentId} -> ${action.details.target}`);
        
        let conversationTiming;
        switch (action.timing) {
          case 'now':
            conversationTiming = 'immediate';
            break;
          case 'later_today':
            conversationTiming = 'later_today';
            break;
          case 'tomorrow':
            conversationTiming = 'tomorrow';
            break;
          default:
            conversationTiming = action.timing || 'when_convenient';
        }
        
        await pool.query(`
          INSERT INTO conversation_intentions (agent_id, target, topic, approach, timing, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          agentId,
          action.details.target,
          action.details.topic,
          action.details.approach,
          conversationTiming
        ]);
        break;
        
      case 'none':
        // No action needed
        console.log(`✅ [UNIFIED_THOUGHT] No action required for ${agentId}`);
        break;
        
      default:
        console.log(`⚠️ [UNIFIED_THOUGHT] Unknown action type: ${action.type}`);
    }
  }

  async function buildThoughtContext(agentId: string, eventType: string, eventData: any) {
    // Get agent data
    const agentResult = await pool.query(`
      SELECT * FROM agents WHERE id = $1
    `, [agentId]);

    const agent = agentResult.rows[0];

    // Get recent memories
    const recentMemories = await memoryManager.getContextualMemories(agentId, 'recent thoughts and activities', 10);

    // Get relationships
    const relationshipsResult = await pool.query(`
      SELECT * FROM agent_relationships WHERE agent_id = $1
    `, [agentId]);

    return {
      agent,
      recentMemories,
      relationships: relationshipsResult.rows,
      eventType,
      eventData,
      currentTime: new Date().toISOString()
    };
  }

  function buildImmediateThoughtPrompt(context: any, eventType: string, eventData: any): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

CURRENT SITUATION:
- Current activity: ${agent.current_activity}
- Current location: ${agent.current_location}
- Current goals: ${agent.primary_goal}
- Secondary goals: ${agent.secondary_goals?.join(', ') || 'None'}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

IMMEDIATE EVENT:
Type: ${eventType}
Data: ${JSON.stringify(eventData)}

IMMEDIATE INTERRUPTION THINKING:
Something has happened that might require you to immediately stop what you're doing and do something else instead. This could be:
- An urgent external event you witnessed
- Someone said something that requires immediate action
- An internal realization that something is more important than your current activity

Evaluate whether this situation requires immediate action. If so, what should you do right now?

Respond in JSON format:
{
  "decision": "Your decision about what to do",
  "action": {
    "type": "immediate_activity" | "none",
    "details": {
      "activity": "activity_name",
      "location": "location_if_needed",
      "reason": "why_this_is_urgent"
    }
  },
  "reasoning": "Your thought process",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
  }

  function buildScheduledThoughtPrompt(context: any, eventType: string, eventData: any): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

CURRENT SITUATION:
- Current activity: ${agent.current_activity}
- Current location: ${agent.current_location}
- Current goals: ${agent.primary_goal}
- Secondary goals: ${agent.secondary_goals?.join(', ') || 'None'}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

EVENT:
Type: ${eventType}
Data: ${JSON.stringify(eventData)}

SCHEDULED ACTIVITY THINKING:
Something has happened that makes you think you should schedule a future activity. This could be:
- Planning to meet someone later
- Remembering you need to do something
- Deciding to pursue an opportunity at a specific time

Should you schedule something for later? If so, what and when?

Respond in JSON format:
{
  "decision": "Your decision about what to schedule",
  "action": {
    "type": "schedule_activity" | "none",
    "details": {
      "activity": "activity_name",
      "time": "when_to_do_it",
      "location": "location_if_needed",
      "reason": "why_schedule_this"
    }
  },
  "reasoning": "Your thought process",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
  }

  function buildGoalReflectionPrompt(context: any): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

CURRENT SITUATION:
- Current activity: ${agent.current_activity}
- Current location: ${agent.current_location}
- Current goals: ${agent.primary_goal}
- Secondary goals: ${agent.secondary_goals?.join(', ') || 'None'}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

EVENING GOAL REFLECTION:
It's evening, and you're reflecting on your primary and secondary goals. Based on the day's events and your recent experiences:
- Are your current goals still the right priorities?
- Should you change your primary goal?
- Should you add, remove, or modify your secondary goals?
- What did you learn today that might change your priorities?

Respond in JSON format:
{
  "decision": "Your decision about goal changes",
  "action": {
    "type": "modify_goals" | "none",
    "details": {
      "primary_goal": "new_primary_goal_or_keep_current",
      "secondary_goals": ["list", "of", "secondary", "goals"],
      "changes_made": "what_changed_and_why"
    }
  },
  "reasoning": "Your thought process about your goals",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
  }

  function buildPreResponseThinkingPrompt(context: any, playerMessage: string): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

PLAYER MESSAGE: "${playerMessage}"

PRE-RESPONSE THINKING:
Before responding to someone, you need to think about what they said and recall relevant information.

Consider:
- What relevant memories do you have about this person or topic?
- What's your relationship with this person?
- How should you respond based on your personality and memories?

Respond in JSON format:
{
  "decision": "Your thoughts about how to respond",
  "action": {
    "type": "none",
    "details": {}
  },
  "reasoning": "Your thought process and memory recall",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
  }

  function buildTruthEvaluationPrompt(context: any, statement: string, speaker: string): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

STATEMENT TO EVALUATE: "${statement}"
SPEAKER: ${speaker}

TRUTH EVALUATION THINKING:
Someone has told you something, and you need to evaluate whether you believe it's true.

Consider:
- Does this align with what you know?
- Is this person trustworthy?
- Does this make sense given your experience?
- How confident are you in this assessment?

Respond in JSON format:
{
  "decision": "Whether you believe the statement",
  "action": {
    "type": "none",
    "details": {
      "believability": "how_much_you_believe_it_0_to_10",
      "reasoning": "why_you_believe_or_doubt_it"
    }
  },
  "reasoning": "Your evaluation process",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
  }

  function buildRelationshipThinkingPrompt(context: any, targetPerson: string, relationshipContext: string): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

RELATIONSHIP THINKING:
You're thinking about your relationship with ${targetPerson}.
Context: ${relationshipContext}

Consider:
- How do you feel about this person?
- Where do you see this relationship going?
- Have your feelings changed recently?
- What do you want from this relationship?

Respond in JSON format:
{
  "decision": "Your thoughts about this relationship",
  "action": {
    "type": "none",
    "details": {
      "person": "${targetPerson}",
      "feelings": "how_you_feel_about_them",
      "relationship_direction": "where_you_see_it_going",
      "desired_actions": "what_you_want_to_do_about_it"
    }
  },
  "reasoning": "Your relationship analysis",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
  }

  function buildUnifiedThoughtPrompt(context: any, eventType: string, eventData: any): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

CURRENT SITUATION:
- Current activity: ${agent.current_activity}
- Current location: ${agent.current_location}
- Current goals: ${agent.primary_goal}
- Secondary goals: ${agent.secondary_goals?.join(', ') || 'None'}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

NEW INFORMATION:
Type: ${eventType}
Data: ${JSON.stringify(eventData)}

UNIFIED THINKING PROCESS:
You've received new information. Consider holistically:

1. **RELEVANCE**: Is this information relevant to you personally or professionally?
2. **CURRENT TASK**: How important is what you're doing right now? Can it be interrupted?
3. **URGENCY**: If this is relevant, does it need immediate action or can it wait?
4. **TIMING**: When would be the best time to act on this?
5. **PRIORITY**: How does this compare to your current goals and activities?

Based on your personality, profession, and current situation, decide:
- What (if anything) should you do about this information?
- When should you do it (now, later today, when convenient)?
- What would you need to change in your current plans?

You can decide on multiple actions if needed (e.g., do something now AND schedule something for later).

Respond in JSON format:
{
  "decision": "Your overall decision about this information",
  "relevance": 1-10,
  "current_task_priority": 1-10,
  "actions": [
    {
      "type": "immediate_activity" | "scheduled_activity" | "modify_goals" | "initiate_conversation" | "none",
      "timing": "now" | "later_today" | "tomorrow" | "when_convenient" | "never",
      "details": {
        "activity": "what_to_do",
        "location": "where_to_do_it",
        "reason": "why_do_this",
        "time": "specific_time_if_scheduled",
        "target": "person_to_talk_to_if_conversation",
        "topic": "conversation_topic_if_conversation",
        "approach": "conversation_approach_if_conversation",
        "primary_goal": "new_primary_goal_if_modifying",
        "secondary_goals": ["list", "of", "secondary", "goals"]
      }
    }
  ],
  "reasoning": "Your complete thought process including how you weighed current task vs new information",
  "importance": 1-10,
  "urgency": 1-10,
  "confidence": 1-10
}`;
  }

  function parseThoughtResponse(responseText: string | null): any {
    try {
      if (!responseText) {
        throw new Error('Empty response');
      }
      
      const parsed = JSON.parse(responseText);
      return {
        decision: parsed.decision || 'No decision made',
        action: parsed.action || { type: 'none', details: {} },
        reasoning: parsed.reasoning || 'No reasoning provided',
        importance: parsed.importance || 5,
        urgency: parsed.urgency || 5,
        confidence: parsed.confidence || 5
      };
    } catch (error) {
      console.error('Error parsing thought response:', error);
      return {
        decision: 'Unable to process thought',
        action: { type: 'none', details: {} },
        reasoning: 'Error in thought processing',
        importance: 3,
        urgency: 1,
        confidence: 1
      };
    }
  }

  function parseUnifiedThoughtResponse(responseText: string | null): any {
    try {
      if (!responseText) {
        throw new Error('Empty response');
      }
      
      // Clean up response - remove markdown code blocks if present
      let cleanResponse = responseText.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '');
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      return {
        decision: parsed.decision || 'No decision made',
        relevance: parsed.relevance || 5,
        current_task_priority: parsed.current_task_priority || 5,
        actions: parsed.actions || [{ type: 'none', timing: 'never', details: {} }],
        reasoning: parsed.reasoning || 'No reasoning provided',
        importance: parsed.importance || 5,
        urgency: parsed.urgency || 5,
        confidence: parsed.confidence || 5
      };
    } catch (error) {
      console.error('Error parsing unified thought response:', error);
      console.error('Raw response:', responseText);
      return {
        decision: 'Unable to process thought',
        relevance: 3,
        current_task_priority: 5,
        actions: [{ type: 'none', timing: 'never', details: {} }],
        reasoning: 'Error in thought processing',
        importance: 3,
        urgency: 1,
        confidence: 1
      };
    }
  }

  async function storeThought(agentId: string, thoughtType: string, triggerType: string, triggerData: any, result: any) {
    await pool.query(`
      INSERT INTO agent_thoughts (
        agent_id, thought_type, trigger_type, trigger_data, 
        decision, action_type, action_details, reasoning, 
        importance, urgency, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      agentId, thoughtType, triggerType, triggerData,
      result.decision, result.action?.type, result.action?.details,
      result.reasoning, result.importance, result.urgency, result.confidence
    ]);
  }

  async function executeThoughtAction(agentId: string, result: any) {
    const action = result.action;
    
    switch (action.type) {
      case 'immediate_activity':
        // Publish immediate activity change
        await redisClient.publish('game_server_activity_change', JSON.stringify({
          agentId,
          activityName: action.details.activity,
          priority: 10,
          interruptCurrent: true,
          parameters: {
            specificLocation: action.details.location,
            reason: action.details.reason,
            thoughtTriggered: true
          }
        }));
        break;
        
      case 'schedule_activity':
        // Store scheduled activity
        await pool.query(`
          INSERT INTO agent_schedules (agent_id, start_time, activity, location, priority, is_flexible)
          VALUES ($1, $2, $3, $4, $5, true)
        `, [agentId, action.details.time, action.details.activity, action.details.location, 7]);
        break;
        
      case 'modify_goals':
        // Update agent goals
        await pool.query(`
          UPDATE agents 
          SET primary_goal = $1, secondary_goals = $2, updated_at = NOW()
          WHERE id = $3
        `, [action.details.primary_goal, action.details.secondary_goals, agentId]);
        break;
        
      case 'initiate_conversation':
        // Store conversation intention
        await pool.query(`
          INSERT INTO conversation_intentions (agent_id, target, topic, approach, timing, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          agentId,
          action.details.target,
          action.details.topic,
          action.details.approach,
          action.timing
        ]);
        break;
        
      case 'none':
        // No action needed
        console.log(`✅ [UNIFIED_THOUGHT] No action required for ${agentId}`);
        break;
        
      default:
        console.log(`⚠️ [UNIFIED_THOUGHT] Unknown action type: ${action.type}`);
    }
  }

  async function processConversationMemoryRecall(agentId: string, playerMessage: string, characterId: string) {
    // Get agent context for memory recall
    const context = await buildThoughtContext(agentId, 'conversation_memory', { playerMessage, characterId });
    
    // Build a simple memory recall prompt
    const prompt = buildConversationMemoryRecallPrompt(context, playerMessage);
    
    // Use LLM to recall relevant memories
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.3
    });

    const result = parseMemoryRecallResponse(response.choices[0].message.content);
    
    // Store the memory recall (lightweight, no actions)
    await pool.query(`
      INSERT INTO agent_thoughts (
        agent_id, thought_type, trigger_type, trigger_data, 
        decision, reasoning, importance, urgency, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      agentId, 'conversation_memory_recall', 'conversation', { playerMessage, characterId },
      result.relevantMemories, result.reasoning, 3, 1, result.confidence
    ]);

    return result;
  }

  function buildConversationMemoryRecallPrompt(context: any, playerMessage: string): string {
    const { agent, recentMemories } = context;
    
    return `You are ${agent.name}, an autonomous NPC in Heartwood Valley.

YOUR IDENTITY:
${agent.constitution}

RECENT MEMORIES:
${recentMemories.map((m: any) => `- ${m.content}`).join('\n')}

PLAYER MESSAGE: "${playerMessage}"

MEMORY RECALL FOR CONVERSATION:
The player just said something to you. Look through your memories and identify what's relevant to this conversation. Do NOT make scheduling decisions or plan activities - just recall relevant information that should inform your response.

Consider:
- What do you remember about this person?
- What related experiences have you had?
- What information is relevant to what they're saying?

Respond in JSON format:
{
  "relevantMemories": "Brief summary of what you remember that's relevant to this conversation",
  "reasoning": "Why these memories are relevant",
  "confidence": 1-10
}`;
  }

  function parseMemoryRecallResponse(responseText: string | null): any {
    try {
      if (!responseText) {
        throw new Error('Empty response');
      }
      
      const parsed = JSON.parse(responseText);
      return {
        relevantMemories: parsed.relevantMemories || 'No relevant memories found',
        reasoning: parsed.reasoning || 'No reasoning provided',
        confidence: parsed.confidence || 5
      };
    } catch (error) {
      console.error('Error parsing memory recall response:', error);
      return {
        relevantMemories: 'Error recalling memories',
        reasoning: 'Error in memory processing',
        confidence: 1
      };
    }
  }

  function parseVibeResponse(responseText: string | null | undefined): any {
    if (!responseText) {
      return {
        vibeScore: 0,
        vibeReason: 'No response',
        attractionFactors: [],
        turnOffFactors: [],
        emotionalReaction: 'Neutral'
      };
    }

    try {
      // Clean up the response
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      const parsed = JSON.parse(cleanedResponse);
      
      // Ensure vibe score is within bounds
      parsed.vibeScore = Math.max(-10, Math.min(10, parsed.vibeScore || 0));
      
      return {
        vibeScore: parsed.vibeScore,
        vibeReason: parsed.vibeReason || 'Evaluating...',
        attractionFactors: parsed.attractionFactors || [],
        turnOffFactors: parsed.turnOffFactors || [],
        emotionalReaction: parsed.emotionalReaction || 'Processing...'
      };
    } catch (error) {
      console.error('Error parsing vibe response:', error);
      console.error('Raw response:', responseText);
      return {
        vibeScore: 0,
        vibeReason: 'Unable to evaluate',
        attractionFactors: [],
        turnOffFactors: [],
        emotionalReaction: 'Confused'
      };
    }
  }

  async function processSpeedDatingEvaluation(agentId: string, playerMessage: string, playerResponse: string, matchContext: any) {
    // Get agent context with full personality and memory
    const context = await buildSpeedDatingContext(agentId, playerMessage, matchContext);
    
    // Get reputation and relationship context
    const reputationResult = await pool.query(`
      SELECT reputation_score, reputation_notes 
      FROM player_reputations 
      WHERE character_id = $1
    `, [matchContext.playerId]);
    
    const reputation = reputationResult.rows[0] || { reputation_score: 0, reputation_notes: 'First time meeting' };
    
    // Build comprehensive speed dating evaluation prompt
    const prompt = buildSpeedDatingEvaluationPrompt(context, playerMessage, reputation, matchContext);
    
    // Use GPT-4o for better quality evaluation without token limits
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    });

    const result = parseSpeedDatingEvaluationResponse(response.choices[0].message.content);
    
    // Store the evaluation 
    await pool.query(`
      INSERT INTO agent_thoughts (
        agent_id, thought_type, trigger_type, trigger_data, 
        decision, reasoning, importance, urgency, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      agentId, 'speed_dating_evaluation', 'speed_dating', 
      { playerMessage, matchContext, evaluation: result },
      result.overallImpression, result.internalThoughts, 
      result.attractionLevel, 1, result.confidence
    ]);

    return result;
  }

  function buildSpeedDatingEvaluationPrompt(context: any, playerMessage: string, reputation: any, matchContext: any): string {
    const { agent, personalitySeed, recentMemories, relationships } = context;
    
    // Get personality traits and preferences
    const personalityTraits = agent.personality_traits?.join(', ') || 'Unknown';
    const likes = agent.likes?.join(', ') || 'Unknown';
    const dislikes = agent.dislikes?.join(', ') || 'Unknown';
    
    // Get dating preferences from personality seed if available
    const datingPreferences = personalitySeed ? `
DATING PREFERENCES:
- Dating Style: ${personalitySeed.datingStyle || 'Not specified'}
- Romantic Goals: ${personalitySeed.romanticGoals?.join(', ') || 'Not specified'}
- Conversation Style: ${personalitySeed.conversationStyle || 'Not specified'}
- Attraction Triggers: ${personalitySeed.attractionTriggers?.join(', ') || 'Not specified'}
- Dealbreakers: ${personalitySeed.dealbreakers?.join(', ') || 'Not specified'}
` : '';
    
    return `You are ${agent.name}, on a speed date in Heartwood Valley.

YOUR IDENTITY & PERSONALITY:
${agent.constitution}

Personality Traits: ${personalityTraits}
Things You Like: ${likes}
Things You Dislike: ${dislikes}
${datingPreferences}

YOUR DATING PRIORITIES:
Based on your personality, what matters most to you in a romantic partner? What are your dealbreakers?

SPEED DATING CONTEXT:
- This is date #${matchContext.matchOrder || 1} in the speed dating gauntlet
- You have 2 minutes together, so time is precious
- Your goal is to evaluate romantic compatibility

WHAT THE PERSON JUST SAID: "${playerMessage}"

PREVIOUS INTERACTIONS WITH THIS PERSON:
${reputation.reputation_score > 0 ? `You've met before. Your impression: ${reputation.reputation_notes}` : 'This is your first time meeting.'}

RELEVANT MEMORIES & CONTEXT:
${recentMemories.slice(0, 5).map((m: any) => `- ${m.content}`).join('\n')}

OTHER ROMANTIC INTERESTS:
${relationships.filter((r: any) => r.relationship_type === 'romantic_interest').map((r: any) => `- ${r.target_person}: ${r.notes}`).join('\n') || 'None currently'}

INTERNAL THOUGHT PROCESS - EVALUATE THIS INTERACTION:

1. **IMMEDIATE REACTION**: What's your gut feeling about what they just said? Does it make you more or less interested?

2. **COMPATIBILITY CHECK**: 
   - Does their response align with your values and interests?
   - Do they share any of your likes? Do they express any of your dislikes?
   - Based on their personality so far, would you be compatible?

3. **ATTRACTION & CHEMISTRY**:
   - Are you feeling any romantic spark?
   - Do you find their conversation style attractive?
   - Is there natural chemistry in how you communicate?

4. **TRUTH EVALUATION** (if applicable):
   - Do you believe what they're saying is genuine?
   - Are they being authentic or just trying to impress you?
   - Any red flags or inconsistencies?

5. **COMPARISON** (if you have other romantic interests):
   - How does this person compare to others you're interested in?
   - What unique qualities do they bring?
   - Who are you more drawn to and why?

6. **ROMANTIC POTENTIAL**:
   - Could you see yourself dating this person?
   - What level of interest do you have? (Not interested / Friend potential / Romantic interest / Strong attraction)
   - Would you want to see them again after this event?

Respond with your INTERNAL THOUGHTS (not what you'd say out loud) in JSON format:
{
  "immediateReaction": "Your gut reaction to what they said",
  "compatibilityThoughts": "Your analysis of compatibility based on values, interests, personality",
  "attractionLevel": 1-10,
  "chemistryNotes": "Notes about romantic chemistry or lack thereof",
  "believability": "Do you think they're being genuine? Any concerns?",
  "comparisonToOthers": "How they compare to other romantic interests (if any)",
  "romanticPotential": "not_interested" | "friend_zone" | "maybe_interested" | "definitely_interested" | "very_attracted",
  "specificLikesOrDislikes": "Specific things about them you like or dislike",
  "overallImpression": "Your overall impression after this exchange",
  "internalThoughts": "Your complete internal monologue about this person and interaction",
  "whatYouWantToKnowNext": "What questions you'd want to ask to learn more about compatibility",
  "confidence": 1-10
}`;
  }

  function parseSpeedDatingEvaluationResponse(responseText: string | null): any {
    try {
      if (!responseText) {
        throw new Error('Empty response');
      }
      
      // Clean up response - remove markdown code blocks if present
      let cleanResponse = responseText.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '');
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      return {
        immediateReaction: parsed.immediateReaction || 'No reaction',
        compatibilityThoughts: parsed.compatibilityThoughts || 'No compatibility thoughts',
        attractionLevel: parsed.attractionLevel || 5,
        chemistryNotes: parsed.chemistryNotes || 'No chemistry notes',
        believability: parsed.believability || 'Unable to assess',
        comparisonToOthers: parsed.comparisonToOthers || 'No comparison available',
        romanticPotential: parsed.romanticPotential || 'not_interested',
        specificLikesOrDislikes: parsed.specificLikesOrDislikes || 'None noted',
        overallImpression: parsed.overallImpression || 'No overall impression',
        internalThoughts: parsed.internalThoughts || 'No internal thoughts',
        whatYouWantToKnowNext: parsed.whatYouWantToKnowNext || 'Nothing specific',
        confidence: parsed.confidence || 5
      };
    } catch (error) {
      console.error('Error parsing speed dating evaluation response:', error);
      console.error('Raw response:', responseText);
      return {
        immediateReaction: 'Unable to process',
        compatibilityThoughts: 'Error in evaluation',
        attractionLevel: 1,
        chemistryNotes: 'System error',
        believability: 'Cannot assess',
        comparisonToOthers: 'Not available',
        romanticPotential: 'not_interested',
        specificLikesOrDislikes: 'Error',
        overallImpression: 'Unable to process evaluation',
        internalThoughts: 'Error in evaluation processing',
        whatYouWantToKnowNext: 'Unable to determine',
        confidence: 1
      };
    }
  }

  async function buildSpeedDatingContext(agentId: string, playerMessage: string, matchContext: any) {
    // Get agent data
    const agentResult = await pool.query(`
      SELECT * FROM agents WHERE id = $1
    `, [agentId]);

    const agent = agentResult.rows[0];

    // Get personality seed data for dating preferences from the personality_seed JSON column
    let personalitySeed = null;
    if (agent.personality_seed) {
      try {
        personalitySeed = JSON.parse(agent.personality_seed);
      } catch (error) {
        console.error(`Error parsing personality seed for ${agentId}:`, error);
      }
    }

    // Get recent memories
    const recentMemories = await memoryManager.getContextualMemories(agentId, 'recent thoughts and activities', 10);

    // Get relationships - especially romantic interests
    const relationshipsResult = await pool.query(`
      SELECT * FROM agent_relationships 
      WHERE agent_id = $1 AND relationship_type IN ('romantic_interest', 'dating', 'crush')
    `, [agentId]);

    return {
      agent,
      personalitySeed,
      recentMemories,
      relationships: relationshipsResult.rows,
      playerMessage,
      matchContext,
      currentTime: new Date().toISOString()
    };
  }

  return router;
}