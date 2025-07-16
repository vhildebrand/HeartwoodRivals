import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { MetacognitionProcessor } from '../services/MetacognitionProcessor';
import { AgentMemoryManager } from '../services/AgentMemoryManager';

export function metacognitionRoutes(pool: Pool, redisClient: ReturnType<typeof createClient>) {
  const router = express.Router();
  const metacognitionProcessor = new MetacognitionProcessor(pool, redisClient);
  const memoryManager = new AgentMemoryManager(pool, redisClient);

  // POST /metacognition/trigger - Manually trigger metacognitive evaluation for an agent
  router.post('/trigger', async (req, res) => {
    try {
      const { agentId, reason } = req.body;

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
      const triggerReason = reason || 'manual_trigger';

      // Trigger metacognitive evaluation
      await metacognitionProcessor.triggerMetacognition(agentId, triggerReason);

      res.json({
        success: true,
        message: `Metacognitive evaluation triggered for ${agent.name}`,
        agentId: agentId,
        trigger_reason: triggerReason
      });

    } catch (error) {
      console.error('Error in /metacognition/trigger:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /metacognition/queue-status - Get metacognitive queue status
  router.get('/queue-status', async (req, res) => {
    try {
      const status = await metacognitionProcessor.getQueueStatus();
      res.json(status);
    } catch (error) {
      console.error('Error in /metacognition/queue-status:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /metacognition/history/:agentId - Get metacognitive history for an agent
  router.get('/history/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get metacognitive evaluations for the agent
      const result = await pool.query(
        `SELECT id, performance_evaluation, strategy_adjustments, goal_modifications, 
                self_awareness_notes, created_at
         FROM agent_metacognition
         WHERE agent_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [agentId, limit]
      );

      // Get metacognitive memories
      const memoriesResult = await pool.query(
        `SELECT id, content, importance_score, timestamp
         FROM agent_memories
         WHERE agent_id = $1 AND memory_type = 'metacognition'
         ORDER BY timestamp DESC
         LIMIT $2`,
        [agentId, limit]
      );

      res.json({
        agent_id: agentId,
        metacognitive_evaluations: result.rows,
        metacognitive_memories: memoriesResult.rows
      });

    } catch (error) {
      console.error('Error in /metacognition/history:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /metacognition/stats - Get overall metacognitive statistics
  router.get('/stats', async (req, res) => {
    try {
      // Get metacognitive stats across all agents
      const result = await pool.query(`
        SELECT 
          agent_id,
          COUNT(*) as evaluation_count,
          MAX(created_at) as last_evaluation,
          MIN(created_at) as first_evaluation
        FROM agent_metacognition
        GROUP BY agent_id
        ORDER BY evaluation_count DESC
      `);

      // Get agent names
      const agentNames = await pool.query('SELECT id, name FROM agents');
      const nameMap = new Map(agentNames.rows.map(row => [row.id, row.name]));

      // Get schedule modifications count
      const scheduleModsResult = await pool.query(`
        SELECT COUNT(*) as modification_count
        FROM agent_plans
        WHERE goal LIKE 'Metacognitive schedule modification:%'
      `);

      const stats = result.rows.map(row => ({
        agent_id: row.agent_id,
        agent_name: nameMap.get(row.agent_id) || 'Unknown',
        evaluation_count: parseInt(row.evaluation_count),
        last_evaluation: row.last_evaluation,
        first_evaluation: row.first_evaluation
      }));

      res.json({
        total_agents_with_evaluations: stats.length,
        total_evaluations: stats.reduce((sum, s) => sum + s.evaluation_count, 0),
        total_schedule_modifications: parseInt(scheduleModsResult.rows[0].modification_count),
        agent_stats: stats
      });

    } catch (error) {
      console.error('Error in /metacognition/stats:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /metacognition/conversation-trigger - DISABLED - Was creating artificial memories
  router.post('/conversation-trigger', async (req, res) => {
    return res.status(403).json({
      error: 'Conversation trigger endpoint disabled',
      message: 'This endpoint was creating artificial conversation memories that cluttered the NPC memory stream',
      alternative: 'Use real player conversations through /npc/interact instead'
    });
  });

  // GET /metacognition/schedule-modifications/:agentId - Get schedule modifications for an agent
  router.get('/schedule-modifications/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get schedule modifications (stored as plans)
      const result = await pool.query(
        `SELECT id, goal, plan_steps, status, priority, created_at, updated_at
         FROM agent_plans
         WHERE agent_id = $1 
         AND goal LIKE 'Metacognitive schedule modification:%'
         ORDER BY created_at DESC
         LIMIT $2`,
        [agentId, limit]
      );

      const modifications = result.rows.map(row => {
        let planData: any = { schedule: {}, reasoning: 'No reasoning provided' };
        try {
          planData = JSON.parse(row.plan_steps[0]);
        } catch (e) {
          planData = { schedule: {}, reasoning: 'Parse error' };
        }

        return {
          id: row.id,
          goal: row.goal,
          schedule: planData.schedule || {},
          reasoning: planData.reasoning || 'No reasoning provided',
          status: row.status,
          priority: row.priority,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      });

      res.json({
        agent_id: agentId,
        schedule_modifications: modifications
      });

    } catch (error) {
      console.error('Error in /metacognition/schedule-modifications:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /metacognition/sarah-seeds-example - DISABLED - Was creating artificial memories
  router.post('/sarah-seeds-example', async (req, res) => {
    return res.status(403).json({
      error: 'Sarah seeds example endpoint disabled',
      message: 'This endpoint was creating artificial memories that cluttered the NPC memory stream',
      alternative: 'Test by having a real player talk to Sarah through /npc/interact with the message: "I heard there are some really good seeds available at the mansion that could help with your salt-resistant crops!"',
      proper_testing: {
        method: 'POST',
        url: '/npc/interact',
        body: {
          npcId: 'sarah_farmer',
          message: 'I heard there are some really good seeds available at the mansion that could help with your salt-resistant crops!',
          characterId: 'your-character-id'
        }
      }
         });
   });

  return router;
} 