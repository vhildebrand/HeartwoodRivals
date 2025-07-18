import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from '../services/AgentMemoryManager';
import { ThoughtSystemIntegration } from '../services/ThoughtSystemIntegration';
import { NPCAwarenessSystem } from '../services/NPCAwarenessSystem';

export function npcAwarenessRoutes(pool: Pool, redisClient: ReturnType<typeof createClient>) {
  const router = express.Router();
  
  const memoryManager = new AgentMemoryManager(pool, redisClient);
  const thoughtSystemIntegration = new ThoughtSystemIntegration(pool, redisClient, memoryManager);
  const npcAwarenessSystem = new NPCAwarenessSystem(pool, redisClient, memoryManager, thoughtSystemIntegration);

  // GET /awareness/stats - Get NPC awareness statistics
  router.get('/stats', async (req, res) => {
    try {
      const stats = await npcAwarenessSystem.getAwarenessStats();
      
      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting NPC awareness stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get awareness stats'
      });
    }
  });

  // GET /awareness/observations/:agentId - Get recent observations for an NPC
  router.get('/observations/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get recent observations where this NPC observed other NPCs
      const observations = await pool.query(`
        SELECT id, content, importance_score, related_agents, timestamp
        FROM agent_memories
        WHERE agent_id = $1 
        AND memory_type = 'observation'
        AND related_agents != '{}'
        ORDER BY timestamp DESC
        LIMIT $2
      `, [agentId, limit]);

      res.json({
        success: true,
        observations: observations.rows,
        count: observations.rows.length
      });
    } catch (error) {
      console.error('Error getting NPC observations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get observations'
      });
    }
  });

  // POST /awareness/trigger-observation - Manually trigger NPC observation for testing
  router.post('/trigger-observation', async (req, res) => {
    try {
      const { observerId, targetId, activityDescription } = req.body;
      
      if (!observerId || !targetId || !activityDescription) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: observerId, targetId, activityDescription'
        });
      }

      // Publish NPC activity change to trigger observations
      await redisClient.publish('npc_activity_change', JSON.stringify({
        npcId: targetId,
        npcName: `Test_${targetId}`,
        newActivity: activityDescription,
        location: 'test_location'
      }));

      res.json({
        success: true,
        message: 'Observation trigger published',
        observerId,
        targetId,
        activityDescription
      });
    } catch (error) {
      console.error('Error triggering observation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger observation'
      });
    }
  });

  // GET /awareness/nearby/:agentId - Get NPCs nearby a specific agent
  router.get('/nearby/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      
      // Get agent's current position
      const agentResult = await pool.query(`
        SELECT a.id, a.name, a.current_location, s.current_x, s.current_y
        FROM agents a
        LEFT JOIN agent_states s ON a.id = s.agent_id
        WHERE a.id = $1
      `, [agentId]);

      if (agentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      const agent = agentResult.rows[0];
      const observationRange = 8; // Same as NPCAwarenessSystem

      let nearbyNPCs = [];
      
      if (agent.current_x && agent.current_y) {
        // Find NPCs within coordinate range
        const result = await pool.query(`
          SELECT a.id, a.name, a.current_location, a.current_activity, s.current_x, s.current_y
          FROM agents a
          LEFT JOIN agent_states s ON a.id = s.agent_id
          WHERE a.id != $1
          AND s.current_x IS NOT NULL AND s.current_y IS NOT NULL
          AND ABS(s.current_x - $2) <= $4 AND ABS(s.current_y - $3) <= $4
        `, [agentId, agent.current_x, agent.current_y, observationRange]);
        
        nearbyNPCs = result.rows;
      } else {
        // Find NPCs in same named location
        const result = await pool.query(`
          SELECT a.id, a.name, a.current_location, a.current_activity, s.current_x, s.current_y
          FROM agents a
          LEFT JOIN agent_states s ON a.id = s.agent_id
          WHERE a.current_location = $1 AND a.id != $2
        `, [agent.current_location, agentId]);
        
        nearbyNPCs = result.rows;
      }

      res.json({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          location: agent.current_location,
          coordinates: agent.current_x && agent.current_y ? { x: agent.current_x, y: agent.current_y } : null
        },
        nearbyNPCs,
        count: nearbyNPCs.length,
        observationRange
      });
    } catch (error) {
      console.error('Error getting nearby NPCs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get nearby NPCs'
      });
    }
  });

  return router;
} 