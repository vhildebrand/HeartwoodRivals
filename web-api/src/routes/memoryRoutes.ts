import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from '../services/AgentMemoryManager';
import { AgentObservationSystem } from '../services/AgentObservationSystem';

export function memoryRoutes(pool: Pool, redisClient: ReturnType<typeof createClient>) {
  const router = express.Router();
  
  // Initialize services
  const memoryManager = new AgentMemoryManager(pool, redisClient);
  const observationSystem = new AgentObservationSystem(pool, redisClient, memoryManager);

  // Test endpoint: Store a test observation
  router.post('/test-observation', async (req, res) => {
    try {
      const { agent_id, observation, location } = req.body;
      
      if (!agent_id || !observation || !location) {
        return res.status(400).json({
          error: 'Missing required fields: agent_id, observation, location'
        });
      }

      const memoryId = await memoryManager.storeObservation(
        agent_id,
        observation,
        location,
        [],
        [],
        5
      );

      if (memoryId === -1) {
        res.json({
          success: true,
          memory_id: null,
          message: 'Observation filtered out (duplicate or low importance)',
          filtered: true
        });
      } else {
        res.json({
          success: true,
          memory_id: memoryId,
          message: 'Observation stored successfully',
          filtered: false
        });
      }
    } catch (error) {
      console.error('Error storing test observation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint: Get recent memories for an agent
  router.get('/agent/:agent_id/memories', async (req, res) => {
    try {
      const { agent_id } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const memories = await memoryManager.retrieveMemories({
        agent_id,
        limit,
        memory_types: ['observation']
      });

      res.json({
        agent_id,
        memories: memories.map(m => ({
          id: m.id,
          content: m.content,
          timestamp: m.timestamp,
          importance: m.importance_score,
          location: m.location
        }))
      });
    } catch (error) {
      console.error('Error retrieving memories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint: Get memory statistics
  router.get('/agent/:agent_id/memory-stats', async (req, res) => {
    try {
      const { agent_id } = req.params;
      
      const stats = await memoryManager.getMemoryStats(agent_id);
      
      res.json({
        agent_id,
        stats
      });
    } catch (error) {
      console.error('Error retrieving memory stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint: Simulate player action
  router.post('/test-player-action', async (req, res) => {
    try {
      const { player_id, action_type, location, target } = req.body;
      
      if (!player_id || !action_type || !location) {
        return res.status(400).json({
          error: 'Missing required fields: player_id, action_type, location'
        });
      }

      await observationSystem.recordPlayerAction({
        player_id,
        action_type,
        location,
        target,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Player action recorded successfully'
      });
    } catch (error) {
      console.error('Error recording player action:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint: Get observation statistics
  router.get('/observation-stats', async (req, res) => {
    try {
      const stats = await observationSystem.getObservationStats();
      
      res.json({
        stats
      });
    } catch (error) {
      console.error('Error retrieving observation stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint: Test semantic search
  router.post('/test-semantic-search', async (req, res) => {
    try {
      const { agent_id, query } = req.body;
      
      if (!agent_id || !query) {
        return res.status(400).json({
          error: 'Missing required fields: agent_id, query'
        });
      }

      const memories = await memoryManager.getContextualMemories(agent_id, query);
      
      res.json({
        agent_id,
        query,
        memories: memories.map(m => ({
          id: m.id,
          content: m.content,
          timestamp: m.timestamp,
          importance: m.importance_score,
          similarity: (m as any).similarity
        }))
      });
    } catch (error) {
      console.error('Error performing semantic search:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint: Add environment observations
  router.post('/test-environment-observations', async (req, res) => {
    try {
      await observationSystem.simulateEnvironmentObservations();
      
      res.json({
        success: true,
        message: 'Environment observations added successfully'
      });
    } catch (error) {
      console.error('Error adding environment observations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint: Demonstrate memory filtering
  router.post('/test-filtering-demo', async (req, res) => {
    try {
      const { agent_id } = req.body;
      
      if (!agent_id) {
        return res.status(400).json({
          error: 'Missing required field: agent_id'
        });
      }

      const results = [];
      
      // Test 1: Low importance (should be filtered)
      const lowImportance = await memoryManager.storeObservation(
        agent_id,
        'I noticed a small leaf falling',
        'environment',
        [], [], 2
      );
      results.push({
        test: 'Low importance filtering',
        observation: 'I noticed a small leaf falling',
        importance: 2,
        stored: lowImportance !== -1,
        memory_id: lowImportance === -1 ? null : lowImportance
      });

      // Test 2: High importance (should be stored)
      const highImportance = await memoryManager.storeObservation(
        agent_id,
        'A player approached and interacted with me directly',
        'blacksmith_shop',
        [], ['test-player'], 8
      );
      results.push({
        test: 'High importance storage',
        observation: 'A player approached and interacted with me directly',
        importance: 8,
        stored: highImportance !== -1,
        memory_id: highImportance === -1 ? null : highImportance
      });

      // Test 3: Duplicate (should be filtered)
      const duplicate = await memoryManager.storeObservation(
        agent_id,
        'A player approached and interacted with me directly',
        'blacksmith_shop',
        [], ['test-player'], 8
      );
      results.push({
        test: 'Duplicate filtering',
        observation: 'A player approached and interacted with me directly',
        importance: 8,
        stored: duplicate !== -1,
        memory_id: duplicate === -1 ? null : duplicate
      });

      // Test 4: Semantically similar (should be filtered)
      const semanticallySimilar = await memoryManager.storeObservation(
        agent_id,
        'A player came to me and we had an interaction',
        'blacksmith_shop',
        [], ['test-player'], 8
      );
      results.push({
        test: 'Semantic similarity filtering',
        observation: 'A player came to me and we had an interaction',
        importance: 8,
        stored: semanticallySimilar !== -1,
        memory_id: semanticallySimilar === -1 ? null : semanticallySimilar
      });

      res.json({
        success: true,
        agent_id,
        message: 'Memory filtering demonstration completed',
        results
      });
    } catch (error) {
      console.error('Error in filtering demo:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
} 