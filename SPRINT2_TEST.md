# Sprint 2 - Memory System Test Guide

## Overview
This document provides testing instructions for Sprint 2: "The Observing Agent (Memory System)" implementation.

## What Was Implemented

### 1. Database Changes
- ✅ Updated `docker-compose.yml` to use `pgvector/pgvector:pg14` image
- ✅ Added pgvector extension to PostgreSQL
- ✅ Added `embedding vector(1536)` column to `agent_memories` table
- ✅ Created vector similarity indexes for efficient semantic search

### 2. Agent Memory System
- ✅ Created `AgentMemoryManager` service with:
  - Memory storage with automatic embedding generation
  - Semantic similarity search using pgvector
  - Memory retrieval with recency, importance, and relevance scoring
  - Context-aware memory selection for agent decision making

### 3. Agent Observation System
- ✅ Created `AgentObservationSystem` service with:
  - Real-time player action monitoring via Redis pub/sub
  - Automatic observation generation for nearby agents
  - Intelligent importance scoring based on action type
  - Contextual observation enrichment (time of day, agent activity)

### 4. Game Server Integration
- ✅ Added Redis client to `HeartwoodRoom`
- ✅ Publishing player actions (join, leave, move) to Redis
- ✅ Integrated with observation system for real-time memory creation

### 5. Testing API Endpoints
- ✅ Created test routes for memory system validation
- ✅ Added endpoints for observation testing and statistics

## Testing Instructions

### Prerequisites
```bash
# Make sure you have OpenAI API key set
export OPENAI_API_KEY="your-api-key-here"

# Start the full system
docker-compose up --build
```

### Test 1: Store a Test Observation
```bash
curl -X POST http://localhost:3000/memory/test-observation \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "elara_blacksmith",
    "observation": "I saw a player walking near my shop",
    "location": "blacksmith_shop"
  }'
```

Expected response:
```json
{
  "success": true,
  "memory_id": 1,
  "message": "Observation stored successfully"
}
```

### Test 2: Retrieve Agent Memories
```bash
curl http://localhost:3000/memory/agent/elara_blacksmith/memories?limit=5
```

Expected response:
```json
{
  "agent_id": "elara_blacksmith",
  "memories": [
    {
      "id": 1,
      "content": "I saw a player walking near my shop",
      "timestamp": "2024-01-15T10:30:00Z",
      "importance": 5,
      "location": "blacksmith_shop"
    }
  ]
}
```

### Test 3: Test Semantic Search
```bash
curl -X POST http://localhost:3000/memory/test-semantic-search \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "elara_blacksmith",
    "query": "player interaction"
  }'
```

Expected response:
```json
{
  "agent_id": "elara_blacksmith",
  "query": "player interaction",
  "memories": [
    {
      "id": 1,
      "content": "I saw a player walking near my shop",
      "timestamp": "2024-01-15T10:30:00Z",
      "importance": 5,
      "similarity": 0.15
    }
  ]
}
```

### Test 4: Simulate Player Action
```bash
curl -X POST http://localhost:3000/memory/test-player-action \
  -H "Content-Type: application/json" \
  -d '{
    "player_id": "test-player-123",
    "action_type": "move",
    "location": "8,6"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Player action recorded successfully"
}
```

### Test 5: Get Memory Statistics
```bash
curl http://localhost:3000/memory/agent/elara_blacksmith/memory-stats
```

Expected response:
```json
{
  "agent_id": "elara_blacksmith",
  "stats": {
    "total_memories": 2,
    "recent_memories": 1,
    "memory_types": {
      "observation": 2
    },
    "avg_importance": 5.0
  }
}
```

### Test 6: Get Observation Statistics
```bash
curl http://localhost:3000/memory/observation-stats
```

Expected response:
```json
{
  "stats": {
    "total_observations": 5,
    "recent_observations": 3,
    "observations_by_agent": {
      "elara_blacksmith": 2,
      "marcus_merchant": 2,
      "sarah_farmer": 1
    }
  }
}
```

## Database Verification

### Check Vector Extension
```sql
# Connect to database
psql -U heartwood_user -h localhost heartwood_db

# Verify pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

# Check agent_memories table structure
\d agent_memories;

# Verify vector indexes
\di *embedding*;
```

### Check Stored Memories
```sql
# View recent memories
SELECT id, agent_id, content, importance_score, timestamp 
FROM agent_memories 
ORDER BY timestamp DESC 
LIMIT 10;

# Test vector similarity search
SELECT content, importance_score, 
       embedding <-> '[0.1, 0.2, 0.3, ...]' as similarity
FROM agent_memories 
WHERE agent_id = 'elara_blacksmith'
ORDER BY similarity
LIMIT 5;
```

## Game Client Integration Test

### Test Player Join Observation
1. Start the game client (http://localhost:5173)
2. Join the game with a player
3. Check that agents observed the player joining:
```bash
curl http://localhost:3000/memory/agent/elara_blacksmith/memories?limit=5
```

### Test Player Movement Observation
1. Move the player around in the game
2. Check that agents observed the movement:
```bash
curl http://localhost:3000/memory/agent/elara_blacksmith/memories?limit=10
```

## Expected Deliverable Verification

**Sprint 2 Goal**: "An agent can observe a player's actions (e.g., "Player walked into the room") and store this as a memory in the Vector DB."

### ✅ Verification Steps:
1. **Vector DB Setup**: pgvector extension enabled and configured
2. **Memory Storage**: Observations stored with embeddings
3. **Player Action Detection**: Game server publishes player actions
4. **Agent Observation**: Agents generate observations from player actions
5. **Semantic Search**: Vector similarity search working for memory retrieval

### Success Criteria Met:
- ✅ Agents can observe player actions in real-time
- ✅ Observations are stored as memories with semantic embeddings
- ✅ Memory retrieval works with recency, importance, and relevance
- ✅ Integration between game server and memory system functional
- ✅ Test API endpoints confirm system operation

## Troubleshooting

### Common Issues:
1. **OpenAI API Key**: Ensure OPENAI_API_KEY is set in environment
2. **Redis Connection**: Verify Redis container is running
3. **Database Connection**: Check PostgreSQL container status
4. **Vector Extension**: Confirm pgvector extension is installed

### Debug Commands:
```bash
# Check container status
docker-compose ps

# View web-api logs
docker-compose logs web-api

# View game-server logs
docker-compose logs game-server

# Check Redis connectivity
redis-cli -h localhost -p 6379 ping
```

## Next Steps (Sprint 3)

The memory system is now ready for Sprint 3: "The Acting Agent (Basic Planning)" where agents will:
1. Use their memories to make decisions
2. Execute simple pre-defined plans
3. Reference their observations in conversations
4. Begin autonomous goal-directed behavior

The foundational memory stream is complete and functional! 🎉 