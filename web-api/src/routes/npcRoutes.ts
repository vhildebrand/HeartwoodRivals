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

  // POST /npc/interact - Main endpoint for NPC conversations
  router.post('/interact', async (req, res) => {
    try {
      const { npcId, message } = req.body;

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

      // For Sprint 3, we'll use a dummy character ID since authentication isn't implemented yet
      const dummyCharacterId = 'test-character-id';

      // Check rate limiting (1 message per 5 seconds per user)
      const rateLimitKey = `ratelimit:interact:${dummyCharacterId}`;
      const rateLimitCheck = await redisClient.get(rateLimitKey);
      
      if (rateLimitCheck) {
        return res.status(429).json({
          error: 'Rate limit exceeded. Please wait before sending another message.'
        });
      }

      // Set rate limit
      await redisClient.setEx(rateLimitKey, 5, 'limited');

      // Verify NPC exists
      const npcResult = await pool.query(
        'SELECT id, name, constitution FROM npcs WHERE id = $1',
        [npcId]
      );

      if (npcResult.rows.length === 0) {
        return res.status(404).json({
          error: 'NPC not found'
        });
      }

      const npc = npcResult.rows[0];

      // Create conversation job
      const jobData = {
        npcId,
        npcName: npc.name,
        constitution: npc.constitution,
        characterId: dummyCharacterId,
        playerMessage: message.trim(),
        timestamp: Date.now()
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

  // GET /npc/list - Get all available NPCs
  router.get('/list', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, x_position, y_position FROM npcs ORDER BY name'
      );

      res.json({
        npcs: result.rows
      });

    } catch (error) {
      console.error('Error fetching NPCs:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  return router;
} 