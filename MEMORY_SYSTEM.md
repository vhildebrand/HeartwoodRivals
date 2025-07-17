# Memory System Documentation

## Overview

The Memory System is the core of the autonomous NPC intelligence in Heartwood Valley. It implements a sophisticated generative agent architecture based on research from "Generative Agents: Interactive Simulacra of Human Behavior" that enables NPCs to form lasting memories, generate insights, and adapt their behavior based on experiences.

## Architecture

### Core Components

#### 1. AgentMemoryManager (`web-api/src/services/AgentMemoryManager.ts`)
- **Purpose**: Central hub for all memory operations
- **Features**:
  - Memory storage with intelligent filtering
  - Semantic similarity search using vector embeddings
  - Contextual memory retrieval for decision-making
  - Automated reflection trigger system
  - Memory statistics and analytics

#### 2. AgentObservationSystem (`web-api/src/services/AgentObservationSystem.ts`)
- **Purpose**: Monitors game events and creates observations
- **Features**:
  - Real-time player action monitoring
  - Proximity-based observation filtering
  - Movement session tracking
  - Contextual observation generation
  - Batch processing for efficiency

#### 3. Vector Database Integration (PostgreSQL + pgvector)
- **Purpose**: Semantic memory storage and retrieval
- **Features**:
  - 1536-dimensional vector embeddings
  - Cosine similarity search
  - Efficient indexing with IVFFlat
  - Hybrid search capabilities

## Memory Types

### Core Memory Structure
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
- **Generation**: Automatic via AgentObservationSystem
- **Filtering**: Subject to importance, temporal, and semantic filtering

#### 2. Reflections
- **Purpose**: High-level insights from observation patterns
- **Examples**:
  - "Alice seems worried about the harvest this year"
  - "Bob has been visiting me more often lately"
  - "The town feels more tense since the merchant shortage"
- **Generation**: Periodic LLM analysis of memory patterns
- **Trigger**: Cumulative importance score exceeds 150 points

#### 3. Plans
- **Purpose**: Goal-oriented action sequences
- **Examples**:
  - "I should finish this horseshoe before dinner"
  - "I want to ask Bob about his mining concerns"
  - "I need to restock iron before the festival"
- **Generation**: LLM-based daily planning
- **Storage**: Integrated with planning system

#### 4. Metacognition
- **Purpose**: Self-evaluation and strategy adjustment
- **Examples**:
  - "My current strategy isn't helping me understand the town's problems"
  - "I should be more social to help the town's economy"
- **Generation**: Triggered by goal progress evaluation
- **Impact**: Influences future planning and behavior

## Memory Filtering System

### 1. Importance-Based Filtering
```typescript
private shouldStoreMemory(importance: number): boolean {
  return importance >= 4; // Only store memories with importance ≥ 4
}
```
- **Purpose**: Reduces storage of trivial observations
- **Threshold**: Importance score ≥ 4
- **Impact**: Significantly reduces database load

### 2. Temporal Filtering
- **Movement Memories**: 5-minute cooldown between similar observations
- **General Memories**: Prevents 80%+ similar content within 1 hour
- **Purpose**: Reduces redundant memories
- **Implementation**: Content similarity checking with time constraints

### 3. Semantic Similarity Filtering
```typescript
private async isMemoryTooSimilar(
  agent_id: string, 
  content: string, 
  embedding: number[]
): Promise<boolean>
```
- **Method**: Cosine similarity on vector embeddings
- **Threshold**: Similarity > 0.85 considered too similar
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

## Memory Retrieval System

### Contextual Memory Retrieval
```typescript
async getContextualMemories(
  agent_id: string, 
  context: string, 
  limit: number = 15
): Promise<Memory[]>
```

### Retrieval Factors
1. **Recency**: Recent memories weighted higher
2. **Importance**: High importance scores prioritized
3. **Relevance**: Vector similarity to current context
4. **Emotional**: Emotional connection to current state

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

## Reflection System

### Automatic Reflection Triggering
- **Threshold**: Cumulative importance score exceeds 150 points
- **Frequency**: 2-3 times per day for active agents
- **Minimum Memories**: At least 5 memories required
- **Cost Optimization**: Limited to 3 reflections per day

### Reflection Generation Process
1. **Memory Analysis**: Retrieve memories since last reflection
2. **Pattern Recognition**: Identify relationships and trends
3. **Insight Generation**: LLM creates higher-level understanding
4. **Storage**: Reflection stored as special memory type

### Example Reflection Process
**Input Memories**:
- "Player_John asked me about blacksmithing work (importance: 8)"
- "I completed crafting a horseshoe (importance: 7)"
- "Player_Sarah complimented my craftsmanship (importance: 8)"

**Generated Reflection**:
> "I've noticed that players are showing genuine interest in my work - perhaps I'm becoming more integrated into the community than I initially thought."

## Vector Embeddings & Semantic Search

### Embedding Generation
- **Model**: OpenAI `text-embedding-3-small`
- **Dimensions**: 1536-dimensional vectors
- **Storage**: PostgreSQL with pgvector extension
- **Purpose**: Semantic similarity search and relevance matching

### Similarity Search
```sql
SELECT content, importance_score, timestamp,
       (embedding <-> $2) as similarity
FROM agent_memories
WHERE agent_id = $1
ORDER BY embedding <-> $2
LIMIT 10;
```

### Hybrid Search Capabilities
- **Vector Search**: Semantic similarity
- **Text Search**: Keyword matching
- **Combined Scoring**: Weighted combination of both approaches

## Database Schema

### Core Tables

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
    embedding vector(1536)
);
```

#### Performance Indexes
```sql
-- Memory retrieval optimization
CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_timestamp ON agent_memories(timestamp);
CREATE INDEX idx_agent_memories_importance ON agent_memories(importance_score);

-- Vector similarity search
CREATE INDEX idx_agent_memories_embedding ON agent_memories 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

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

### 3. Reflection Generation Flow
```
Memory Threshold → Reflection Queue → Memory Analysis → 
LLM Processing → Insight Generation → Reflection Storage → 
Behavior Influence
```

## Performance Optimizations

### 1. Caching System
- **Memory Cache**: Redis with 1-hour TTL
- **Query Cache**: Complex retrieval results cached
- **Embedding Cache**: Frequently accessed embeddings cached

### 2. Batch Processing
- **Observation Batching**: Multiple observations processed together
- **Embedding Generation**: Batch API calls to reduce latency
- **Reflection Processing**: Background queue system

### 3. Database Optimizations
- **Connection Pooling**: Efficient database connections
- **Index Optimization**: Specialized indexes for common queries
- **Query Optimization**: Efficient SQL patterns

## Integration Points

### Game Server Integration
- **Real-time Observation**: Player actions trigger memory creation
- **State Synchronization**: Memory system reflects game state
- **Agent Coordination**: Memory influences agent behavior

### Web API Integration
- **Conversation System**: Memories inform NPC responses
- **HTTP Endpoints**: RESTful API for memory operations
- **Background Processing**: Asynchronous memory operations

### LLM Integration
- **OpenAI API**: Embedding generation and reflection processing
- **Prompt Construction**: Memory-informed prompts
- **Response Processing**: LLM outputs stored as memories

## API Endpoints

### Memory Management
- **POST /memory/test-observation**: Store test observations
- **GET /memory/debug-memories/{agentId}**: Debug memory retrieval
- **GET /memory/stats/{agentId}**: Memory statistics
- **POST /memory/test-semantic-search**: Test semantic search

### Reflection System
- **POST /reflection/trigger**: Manually trigger reflection
- **GET /reflection/queue-status**: Monitor reflection queue
- **GET /reflection/history/{agentId}**: Get reflection history
- **GET /reflection/stats**: Overall reflection statistics

## Monitoring & Analytics

### Memory Statistics
- **Memory Count**: Total memories per agent
- **Memory Types**: Distribution of memory types
- **Average Importance**: Mean importance scores
- **Reflection Rate**: Reflection generation frequency

### Performance Metrics
- **Query Latency**: Memory retrieval speed
- **Cache Hit Rate**: Caching efficiency
- **Database Load**: Query volume and complexity
- **LLM Usage**: API call frequency and costs

## Error Handling

### Graceful Degradation
- **LLM Failures**: Fallback to cached responses
- **Database Errors**: Retry mechanisms and error logging
- **Memory Overflow**: Automatic cleanup of old memories
- **Network Issues**: Offline mode capabilities

### Data Integrity
- **Transaction Management**: Atomic memory operations
- **Constraint Validation**: Data quality checks
- **Backup Systems**: Regular data backups
- **Recovery Procedures**: Disaster recovery plans

## Future Enhancements

### Advanced Memory Types
- **Emotional Memories**: Memories with strong emotional significance
- **Episodic Memories**: Specific event sequences
- **Procedural Memories**: Learned skills and behaviors
- **Collective Memories**: Shared community knowledge

### Enhanced Retrieval
- **Contextual Embeddings**: Dynamic context-aware embeddings
- **Multi-modal Memory**: Support for images and audio
- **Temporal Reasoning**: Time-aware memory connections
- **Causal Relationships**: Cause-and-effect memory links

### Social Memory Features
- **Relationship Memories**: Specific agent-to-agent memories
- **Reputation System**: Community-wide opinion tracking
- **Gossip Propagation**: Information spread through social networks
- **Collective Decision Making**: Group memory consensus

## Conclusion

The Memory System provides the foundation for truly autonomous NPCs in Heartwood Valley. By combining sophisticated filtering, semantic search, and reflection capabilities, it creates agents that can form lasting memories, generate insights, and adapt their behavior based on experiences.

The system's multi-layered architecture ensures both performance and intelligence, enabling NPCs to engage in meaningful conversations, form relationships, and contribute to the emergent storytelling that makes Heartwood Valley a living, breathing world.

The implementation successfully balances research-based AI techniques with practical game development constraints, creating a system that is both scientifically sound and performance-optimized for real-world deployment. 