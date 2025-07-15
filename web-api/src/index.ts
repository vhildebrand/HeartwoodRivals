import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from 'redis';
import { Pool } from 'pg';
import { npcRoutes } from './routes/npcRoutes';
import { memoryRoutes } from './routes/memoryRoutes';
import { LLMWorker } from './services/LLMWorker';
import { AgentMemoryManager } from './services/AgentMemoryManager';
import { AgentObservationSystem } from './services/AgentObservationSystem';
import { loadAgents } from './utils/loadAgents';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'heartwood_user',
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'heartwood_db',
  password: process.env.DB_PASSWORD || 'heartwood_password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Redis connection
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

// Initialize connections
async function initializeConnections() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    
    // Connect to Redis
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    
    // Initialize Memory Manager
    const memoryManager = new AgentMemoryManager(pool, redisClient);
    console.log('✅ Agent Memory Manager initialized');
    
    // Initialize Observation System
    const observationSystem = new AgentObservationSystem(pool, redisClient, memoryManager);
    await observationSystem.initialize();
    console.log('✅ Agent Observation System initialized');
    
    // Initialize LLM Worker
    const llmWorker = new LLMWorker(pool, redisClient);
    await llmWorker.start();
    console.log('✅ LLM Worker started successfully');
    
    // Load agents from JSON files
    await loadAgents(pool);
    
  } catch (error) {
    console.error('❌ Failed to initialize connections:', error);
    process.exit(1);
  }
}

// Routes
app.use('/npc', npcRoutes(pool, redisClient));
app.use('/memory', memoryRoutes(pool, redisClient));

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Web API Server running on port ${PORT}`);
  await initializeConnections();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down gracefully...');
  await pool.end();
  await redisClient.disconnect();
  process.exit(0);
});
