import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { ReflectionProcessor } from '../services/ReflectionProcessor';
import { AgentMemoryManager } from '../services/AgentMemoryManager';

export function reflectionRoutes(pool: Pool, redisClient: ReturnType<typeof createClient>) {
  const router = express.Router();
  const reflectionProcessor = new ReflectionProcessor(pool, redisClient);
  const memoryManager = new AgentMemoryManager(pool, redisClient);

  // POST /reflection/trigger - Manually trigger reflection for an agent
  router.post('/trigger', async (req, res) => {
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

      // Trigger reflection
      await reflectionProcessor.triggerReflection(agentId);

      res.json({
        success: true,
        message: `Reflection triggered for ${agent.name}`,
        agentId: agentId
      });

    } catch (error) {
      console.error('Error in /reflection/trigger:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /reflection/queue-status - Get reflection queue status
  router.get('/queue-status', async (req, res) => {
    try {
      const status = await reflectionProcessor.getQueueStatus();
      res.json(status);
    } catch (error) {
      console.error('Error in /reflection/queue-status:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /reflection/history/:agentId - Get reflection history for an agent
  router.get('/history/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get reflections for the agent
      const result = await pool.query(
        `SELECT id, content, importance_score, emotional_relevance, tags, timestamp
         FROM agent_memories
         WHERE agent_id = $1 AND memory_type = 'reflection'
         ORDER BY timestamp DESC
         LIMIT $2`,
        [agentId, limit]
      );

      res.json({
        agent_id: agentId,
        reflections: result.rows
      });

    } catch (error) {
      console.error('Error in /reflection/history:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET /reflection/stats - Get overall reflection statistics
  router.get('/stats', async (req, res) => {
    try {
      // Get reflection stats across all agents
      const result = await pool.query(`
        SELECT 
          agent_id,
          COUNT(*) as reflection_count,
          AVG(importance_score) as avg_importance,
          MAX(timestamp) as last_reflection,
          MIN(timestamp) as first_reflection
        FROM agent_memories
        WHERE memory_type = 'reflection'
        GROUP BY agent_id
        ORDER BY reflection_count DESC
      `);

      // Get agent names
      const agentNames = await pool.query('SELECT id, name FROM agents');
      const nameMap = new Map(agentNames.rows.map(row => [row.id, row.name]));

      const stats = result.rows.map(row => ({
        agent_id: row.agent_id,
        agent_name: nameMap.get(row.agent_id) || 'Unknown',
        reflection_count: parseInt(row.reflection_count),
        avg_importance: parseFloat(row.avg_importance),
        last_reflection: row.last_reflection,
        first_reflection: row.first_reflection
      }));

      res.json({
        total_agents_with_reflections: stats.length,
        total_reflections: stats.reduce((sum, s) => sum + s.reflection_count, 0),
        agent_stats: stats
      });

    } catch (error) {
      console.error('Error in /reflection/stats:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // POST /reflection/test-memory-addition - DISABLED - Was creating artificial memories
  router.post('/test-memory-addition', async (req, res) => {
    return res.status(403).json({
      error: 'Test memory addition endpoint disabled',
      message: 'This endpoint was creating artificial memories that cluttered the NPC memory stream',
      alternative: 'Use real player interactions to create natural memories instead'
    });
  });

  return router;
} 