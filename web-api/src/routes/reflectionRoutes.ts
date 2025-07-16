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

  // POST /reflection/test-memory-addition - Add test memories to trigger reflection
  router.post('/test-memory-addition', async (req, res) => {
    try {
      const { agentId, memoryCount = 5 } = req.body;

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

      // Add test memories with high importance to trigger reflection
      const testMemories = [
        `I had an interesting conversation with a player about ${agent.name}'s work`,
        `A player asked me about my goals and I shared my thoughts`,
        `I noticed more players are visiting the town lately`,
        `I completed an important task that I've been working on`,
        `I had a meaningful interaction with another townsperson`,
        `I observed some changes in the town's atmosphere`,
        `A player showed interest in my personal story`,
        `I made progress on one of my secondary goals`,
        `I had a particularly engaging conversation today`,
        `I noticed a pattern in how players interact with me`
      ];

      let addedMemories = 0;
      for (let i = 0; i < Math.min(memoryCount, testMemories.length); i++) {
        const memoryId = await memoryManager.storeObservation(
          agentId,
          testMemories[i],
          'test_location',
          [], // related_agents
          ['test-player-id'], // related_players
          8 // high importance to trigger reflection
        );

        if (memoryId !== -1) {
          addedMemories++;
        }
      }

      res.json({
        success: true,
        message: `Added ${addedMemories} test memories for ${agent.name}`,
        agentId: agentId,
        memories_added: addedMemories
      });

    } catch (error) {
      console.error('Error in /reflection/test-memory-addition:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  return router;
} 