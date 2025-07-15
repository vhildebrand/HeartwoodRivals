# NPC Memory System Documentation
**Project: Heartwood Valley - Generative Agent Memory Architecture**

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Memory Types and Structure](#memory-types-and-structure)
4. [Database Schema](#database-schema)
5. [Agent Architecture](#agent-architecture)
6. [Memory Filtering and Efficiency](#memory-filtering-and-efficiency)
7. [Data Flow Patterns](#data-flow-patterns)
8. [Vector Embeddings and Semantic Search](#vector-embeddings-and-semantic-search)
9. [Reflection and Metacognition](#reflection-and-metacognition)
10. [Integration Points](#integration-points)
11. [Performance Optimizations](#performance-optimizations)
12. [Future Enhancements](#future-enhancements)

---

## System Overview

The NPC memory system in Heartwood Valley implements a sophisticated generative agent architecture based on research from "Generative Agents: Interactive Simulacra of Human Behavior" and "Metacognition is all you need? Using Introspection in Generative Agents to Improve Goal-directed Behavior". 

### Key Goals
- **Autonomous NPCs**: Create truly autonomous agents with persistent memory, goals, and emergent behaviors
- **Cost Efficiency**: Implement filtering and caching mechanisms to reduce expensive LLM calls
- **Semantic Understanding**: Use vector embeddings for intelligent memory retrieval and similarity matching
- **Emergent Behavior**: Enable complex social dynamics and relationships through memory-driven interactions

### Architecture Pattern
The system follows a **Memory-Reflection-Planning-Metacognition** loop:
- **Memory**: Continuous observation storage and intelligent retrieval
- **Reflection**: Periodic analysis of memory patterns to generate insights
- **Planning**: Goal-oriented behavior based on memory context
- **Metacognition**: Self-evaluation and strategy adjustment

---

## Core Components

### 1. AgentMemoryManager (`web-api/src/services/AgentMemoryManager.ts`)
**Purpose**: Central hub for all memory operations including storage, retrieval, and filtering.

**Key Features**:
- Memory storage with multiple filtering mechanisms
- Semantic similarity search using vector embeddings
- Contextual memory retrieval for decision-making
- Automated reflection trigger system
- Memory statistics and analytics

**Methods**:
- `storeMemory()`: Store new memories with filtering
- `retrieveMemories()`: Retrieve memories with various filters
- `getContextualMemories()`: Get relevant memories for decision-making
- `storeObservation()`: Store observations from game events
- `generateEmbedding()`: Create vector embeddings for semantic search

### 2. AgentObservationSystem (`web-api/src/services/AgentObservationSystem.ts`)
**Purpose**: Monitors game events and creates observations for NPCs.

**Key Features**:
- Real-time monitoring of player actions
- Proximity-based observation filtering
- Movement session tracking to reduce noise
- Contextual observation generation
- Batch processing for efficiency

**Observation Types**:
- Player movement (with session tracking)
- Player join/leave events
- Player interactions
- Player chat messages

### 3. LLMWorker (`web-api/src/services/LLMWorker.ts`)
**Purpose**: Handles asynchronous LLM processing for agent conversations and reasoning.

**Key Features**:
- Redis queue-based job processing
- Prompt construction with agent context
- OpenAI GPT-4o-mini integration
- Conversation logging
- Error handling and retry logic

### 4. Database Layer (`db/init.sql`)
**Purpose**: Persistent storage for agents, memories, relationships, and game state.

**Key Tables**:
- `agents`: Core agent information and configuration
- `agent_memories`: Memory stream with vector embeddings
- `agent_states`: Real-time agent state
- `agent_relationships`: Social connections
- `agent_reflections`: Generated insights
- `agent_metacognition`: Self-evaluation records

### 5. Agent Loading System (`web-api/src/utils/loadAgents.ts`)
**Purpose**: Initializes agents from JSON configuration files.

**Process**:
1. Reads JSON files from `db/agents/` directory
2. Parses agent configuration data
3. Inserts/updates agents table with upsert operations
4. Initializes agent states with starting positions

---

## Memory Types and Structure

### Memory Interface
```typescript
interface Memory {
  id?: number;
  agent_id: string;
  memory_type: 'observation' | 'reflection' | 'plan' | 'metacognition';
  content: string;
  importance_score: number;      // 1-10 scale
  emotional_relevance: number;   // 1-10 scale
  tags: string[];
  related_agents: string[];
  related_players: string[];
  location: string;
  timestamp?: Date;
  embedding?: number[];          // Vector embedding for semantic search
}
```

### Memory Types

#### 1. Observations
- **Purpose**: Direct perceptions of the game world
- **Examples**: 
  - "Player_John entered the area at blacksmith_shop"
  - "Player_Sarah interacted with me while I was working at anvil"
  - "Marcus said something at general_store"
- **Generation**: Automatically created by `AgentObservationSystem`
- **Filtering**: Subject to temporal, semantic, and importance filtering

#### 2. Reflections
- **Purpose**: High-level insights generated from observations
- **Examples**:
  - "Alice seems worried about the harvest this year"
  - "Bob has been visiting me more often lately"
  - "The town feels more tense since the merchant shortage"
- **Generation**: Periodic analysis of memory patterns via LLM
- **Trigger**: Every 20 memories accumulated in 24 hours

#### 3. Plans
- **Purpose**: Goal-oriented action sequences
- **Examples**:
  - "I should finish this horseshoe before dinner"
  - "I want to ask Bob about his mining concerns"
  - "I need to restock iron before the festival"
- **Generation**: Created during planning phase
- **Updates**: Modified based on outcomes and new information

#### 4. Metacognition
- **Purpose**: Self-evaluation and strategy adjustment
- **Examples**:
  - "My current strategy of working alone isn't helping me understand the town's problems"
  - "I should be more social to help the town's economy"
- **Generation**: Triggered when goals show little progress
- **Impact**: Influences future planning and behavior

---

## Database Schema

### Core Tables

#### agents
```sql
CREATE TABLE agents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    constitution TEXT NOT NULL,           -- Core personality
    current_location VARCHAR(100),
    current_activity TEXT,
    energy_level INT DEFAULT 100,
    mood VARCHAR(50) DEFAULT 'neutral',
    primary_goal TEXT,
    secondary_goals TEXT[],
    personality_traits TEXT[],
    likes TEXT[],
    dislikes TEXT[],
    background TEXT,
    schedule JSONB,
    current_plans TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### agent_memories
```sql
CREATE TABLE agent_memories (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    memory_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    importance_score INT DEFAULT 0,
    emotional_relevance INT DEFAULT 0,
    tags TEXT[],
    related_agents TEXT[],
    related_players TEXT[],
    location VARCHAR(100),
    timestamp TIMESTAMPTZ DEFAULT now(),
    embedding vector(1536)               -- OpenAI embedding vector
);
```

#### agent_states
```sql
CREATE TABLE agent_states (
    agent_id VARCHAR(50) PRIMARY KEY REFERENCES agents(id),
    current_x INT,
    current_y INT,
    current_direction VARCHAR(10),
    current_action VARCHAR(100),
    action_start_time TIMESTAMPTZ,
    interaction_target VARCHAR(50),
    emotional_state JSONB,
    physical_state JSONB,
    cognitive_load INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes for Performance
```sql
-- Memory retrieval optimization
CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_timestamp ON agent_memories(timestamp);
CREATE INDEX idx_agent_memories_importance ON agent_memories(importance_score);
CREATE INDEX idx_agent_memories_type ON agent_memories(memory_type);

-- Vector similarity search
CREATE INDEX idx_agent_memories_embedding ON agent_memories 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Composite indexes for complex queries
CREATE INDEX idx_agent_memories_agent_time ON agent_memories(agent_id, timestamp DESC);
CREATE INDEX idx_agent_memories_agent_importance ON agent_memories(agent_id, importance_score DESC);
```

---

## Agent Architecture

### Agent Configuration (JSON)
Each agent is defined by a JSON configuration file in `db/agents/`:

```json
{
  "id": "elara_blacksmith",
  "name": "Elara",
  "constitution": "You are Elara, a shy and thoughtful blacksmith...",
  "current_location": "blacksmith_shop",
  "current_activity": "working at anvil",
  "energy_level": 75,
  "mood": "focused",
  "primary_goal": "Master the blacksmith craft and help the town prosper",
  "secondary_goals": [
    "Grow a beautiful flower garden",
    "Build meaningful relationships with townspeople"
  ],
  "personality_traits": ["shy", "thoughtful", "reserved"],
  "likes": ["flowers", "nature", "quiet moments"],
  "dislikes": ["loud noises", "crowds", "rushed conversations"],
  "background": "Born and raised in Heartwood Valley...",
  "schedule": {
    "6:00": "wake up, tend to flowers",
    "8:00": "open shop, light forge",
    "12:00": "lunch break, garden time"
  }
}
```

### Agent State Management
- **Static Data**: Stored in `agents` table (personality, goals, constitution)
- **Dynamic Data**: Stored in `agent_states` table (position, current action, emotional state)
- **Memory Data**: Stored in `agent_memories` table (observations, reflections, plans)

---

## Memory Filtering and Efficiency

### 1. Importance-Based Filtering
```typescript
private shouldStoreMemory(importance: number): boolean {
  return importance >= 4; // Skip low-importance observations
}
```
- **Threshold**: Only memories with importance ≥ 4 are stored
- **Purpose**: Reduces storage and processing overhead
- **Impact**: Filters out trivial observations

### 2. Temporal Filtering
```typescript
private async shouldCreateMemoryTemporally(
  agent_id: string, 
  content: string, 
  memory_type: string
): Promise<boolean>
```
- **Movement Memories**: 5-minute cooldown between similar movement observations
- **General Memories**: Prevents 80%+ similar content within 1 hour
- **Purpose**: Reduces redundant memories

### 3. Semantic Similarity Filtering
```typescript
private async isMemoryTooSimilar(
  agent_id: string, 
  content: string, 
  embedding: number[]
): Promise<boolean>
```
- **Vector Comparison**: Uses cosine similarity on embeddings
- **Threshold**: Memories with similarity < 0.15 are considered too similar
- **Timeframe**: Checks against memories from last 6 hours
- **Purpose**: Prevents semantically duplicate memories

### 4. Movement Session Tracking
```typescript
interface MovementSession {
  player_id: string;
  start_time: Date;
  current_location: string;
  locations_visited: string[];
  move_count: number;
}
```
- **Session Duration**: 30-second timeout
- **Minimum Activity**: 3 moves required for session summary
- **Purpose**: Reduces individual movement observations into meaningful summaries

### 5. Caching System
- **Memory Cache**: Redis caching with 1-hour TTL
- **Query Cache**: Caches retrieval results based on options
- **Purpose**: Reduces database load and improves response times

---

## Data Flow Patterns

### 1. Observation Creation Flow
```
Player Action → AgentObservationSystem → Proximity Check → 
Observation Generation → Memory Filtering → Database Storage → 
Embedding Generation → Vector Index Update → Cache Update
```

### 2. Memory Retrieval Flow
```
Decision Request → Context Analysis → Embedding Generation → 
Cache Check → Database Query → Vector Similarity Search → 
Result Combination → Score Calculation → Response
```

### 3. Conversation Flow
```
Player Message → NPC Routes → Rate Limiting → Job Queue → 
LLM Worker → Memory Retrieval → Prompt Construction → 
OpenAI API → Response Processing → Database Logging → 
Client Response
```

### 4. Reflection Generation Flow
```
Memory Threshold → Reflection Queue → Memory Analysis → 
LLM Processing → Insight Generation → Reflection Storage → 
Behavior Influence
```

---

## Vector Embeddings and Semantic Search

### Embedding Generation
- **Model**: OpenAI `text-embedding-3-small`
- **Dimensions**: 1536-dimensional vectors
- **Storage**: PostgreSQL with pgvector extension
- **Purpose**: Semantic similarity search and memory relevance

### Similarity Search
```sql
SELECT content, importance_score, timestamp,
       (embedding <-> $2) as similarity
FROM agent_memories
WHERE agent_id = $1
ORDER BY embedding <-> $2
LIMIT 10;
```

### Memory Scoring Algorithm
```typescript
private calculateMemoryScore(memory: Memory): number {
  const recencyScore = Math.max(0, 10 - hoursOld / 24);      // 30% weight
  const importanceScore = memory.importance_score || 5;       // 40% weight
  const emotionalScore = memory.emotional_relevance || 5;     // 20% weight
  const similarityScore = (1 - similarity) * 10;             // 10% weight
  
  return (recencyScore * 0.3) + (importanceScore * 0.4) + 
         (emotionalScore * 0.2) + (similarityScore * 0.1);
}
```

---

## Reflection and Metacognition

### Reflection System
- **Trigger**: Every 20 memories in 24 hours
- **Process**: Analyze recent memories for patterns and insights
- **Storage**: Stored as reflection-type memories
- **Impact**: Influences future behavior and decision-making

### Metacognition System
- **Purpose**: Self-evaluation and strategy adjustment
- **Trigger**: When goals show little progress over time
- **Process**: 
  1. Retrieve agent's goals and recent plans
  2. Analyze outcomes and success rates
  3. Generate alternative strategies
  4. Update planning approach
- **Example**: "Am I succeeding at my goal? What should I change?"

### Database Tables
```sql
-- Agent Reflections
CREATE TABLE agent_reflections (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    reflection TEXT NOT NULL,
    trigger_memories BIGINT[],
    insights TEXT[],
    behavioral_changes TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Metacognitive Insights
CREATE TABLE agent_metacognition (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    performance_evaluation TEXT,
    strategy_adjustments TEXT[],
    goal_modifications TEXT[],
    self_awareness_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Integration Points

### 1. Game Client Integration
- **Location**: `client/src/game/scenes/GameScene.ts`
- **Purpose**: NPC interaction and dialogue display
- **Communication**: HTTP requests to web API endpoints

### 2. Game Server Integration
- **Location**: `game-server/src/rooms/HeartwoodRoom.ts`
- **Purpose**: Real-time NPC state updates and player tracking
- **Communication**: WebSocket messages and database updates

### 3. Web API Integration
- **Routes**: `web-api/src/routes/npcRoutes.ts` and `memoryRoutes.ts`
- **Purpose**: NPC conversation handling and memory management
- **Endpoints**:
  - `POST /npc/interact`: Main conversation endpoint
  - `GET /npc/conversation/:jobId`: Check conversation status
  - `POST /memory/test-observation`: Test memory storage

### 4. Database Integration
- **Connection**: PostgreSQL connection pool
- **Transactions**: Atomic operations for consistency
- **Migrations**: Schema updates and data evolution

---

## Performance Optimizations

### 1. Connection Pooling
```typescript
const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000, // Connection timeout
});
```

### 2. Redis Caching
- **Memory Cache**: 1-hour TTL for frequently accessed memories
- **Query Cache**: Caches complex retrieval results
- **Session Cache**: Temporary data for active sessions

### 3. Async Processing
- **Job Queues**: Bull queues for LLM processing
- **Background Tasks**: Reflection and metacognition processing
- **Rate Limiting**: Prevents system overload

### 4. Database Indexing
- **Primary Indexes**: On agent_id, timestamp, importance_score
- **Composite Indexes**: For complex queries
- **Vector Indexes**: IVFFlat for similarity search

### 5. Batch Operations
- **Memory Retrieval**: Batch queries for related memories
- **Embedding Generation**: Batch processing where possible
- **Reflection Processing**: Batch analysis of memory patterns

---

## Future Enhancements

### 1. Advanced Memory Types
- **Emotional Memories**: Memories with strong emotional significance
- **Episodic Memories**: Specific event sequences
- **Procedural Memories**: Learned skills and behaviors

### 2. Social Memory Features
- **Relationship Memories**: Specific memories about other agents
- **Reputation System**: Agent opinions and social standing
- **Collective Memory**: Shared town knowledge

### 3. Optimization Improvements
- **Lifestyle Policies**: Cache routine behaviors to reduce LLM calls
- **Social Memory Compression**: Compressed social context for conversations
- **Memory Consolidation**: Periodic memory summarization

### 4. Advanced Analytics
- **Memory Pattern Analysis**: Identify behavioral patterns
- **Relationship Tracking**: Monitor social network evolution
- **Performance Metrics**: System efficiency and agent effectiveness

---

## Conclusion

The NPC memory system in Heartwood Valley represents a sophisticated implementation of generative agent architecture, combining advanced AI research with practical game development constraints. The system successfully balances autonomy, efficiency, and emergent behavior to create truly intelligent NPCs that can form lasting relationships and evolve over time.

The multi-layered filtering system, semantic search capabilities, and reflection mechanisms work together to create agents that not only remember but also learn from their experiences, making each interaction meaningful and contributing to the overall narrative of the persistent game world. 