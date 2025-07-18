# AI Memory System Documentation

## Overview

The AI Memory System is the foundation of autonomous NPC intelligence in Heartwood Valley. It implements a sophisticated generative agent architecture that enables NPCs to form lasting memories, generate insights, and adapt their behavior based on experiences.

**Status**: ✅ Fully Operational with 24 autonomous agents

## Architecture

### Core Components

#### 1. AgentMemoryManager
**Location**: `web-api/src/services/AgentMemoryManager.ts`  
**Purpose**: Central hub for all memory operations

**Key Features**:
- Vector-based memory storage with semantic search
- Multi-layer filtering for efficiency (60% storage reduction)
- Contextual memory retrieval for decision-making
- Automated reflection triggering
- Memory consolidation and caching

#### 2. AgentObservationSystem
**Location**: `web-api/src/services/AgentObservationSystem.ts`  
**Purpose**: Real-time game event monitoring and observation creation

**Key Features**:
- Player action monitoring within proximity (10 tiles)
- Movement session tracking to reduce noise
- Contextual observation generation
- Witness system for social events
- Batch processing for efficiency

#### 3. Vector Database Integration
**Technology**: PostgreSQL 14 with pgvector extension  
**Purpose**: Semantic memory storage and retrieval

**Features**:
- 1536-dimensional vector embeddings (OpenAI text-embedding-3-small)
- Cosine similarity search for semantic matching
- Efficient IVFFlat indexing for fast queries
- Hybrid search combining semantic and temporal factors

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
  embedding?: number[];          // 1536-dimensional vector
}
```

### Memory Type Definitions

#### 1. Observations
**Purpose**: Direct perceptions of the game world  
**Examples**: 
- Player conversations and actions
- Environmental changes
- NPC interactions
- Current activity observations

**Storage Process**:
1. Event detection via AgentObservationSystem
2. Proximity filtering (10-tile radius)
3. Importance scoring (1-10 scale)
4. Multi-layer filtering application
5. Vector embedding generation
6. Database storage with indexing

#### 2. Reflections
**Purpose**: Higher-level insights synthesized from observations  
**Examples**:
- Pattern recognition in player behavior
- Relationship insights
- Goal reassessment
- Behavioral adaptations

**Generation Process**:
1. Cumulative importance threshold (≥150 points)
2. Recent memory analysis (since last reflection)
3. LLM-based insight generation
4. High-importance storage (typically 8-9)
5. Daily limits (3 reflections max)

#### 3. Plans
**Purpose**: Goal-oriented action sequences  
**Examples**:
- Daily schedules and activities
- Long-term goal planning
- Strategy adjustments
- Emergency response plans

#### 4. Metacognition
**Purpose**: Self-evaluation and strategy adjustment  
**Examples**:
- Performance analysis
- Behavioral effectiveness assessment
- Strategy modifications
- Goal prioritization changes

## Memory Filtering System

### Multi-Layer Filtering
**Purpose**: Reduce memory storage by 60% while maintaining quality

#### 1. Importance-Based Filtering
```typescript
// Only store memories with importance ≥ 4
private shouldStoreMemory(importanceScore: number): boolean {
  return importanceScore >= 4;
}
```

#### 2. Temporal Filtering
- **Movement Cooldown**: 5-minute cooldown for redundant movement observations
- **Session Tracking**: Groups related actions into sessions
- **Duplicate Prevention**: Prevents storing identical recent observations

#### 3. Semantic Similarity Filtering
```typescript
// Prevents storing memories too similar to recent ones
private async isMemoryTooSimilar(
  agent_id: string, 
  content: string, 
  embedding: number[]
): Promise<boolean> {
  const threshold = await this.getDynamicSimilarityThreshold(agent_id);
  // Check similarity with recent memories (6 hours)
  return similarity < threshold;
}
```

## Memory Retrieval System

### Contextual Memory Retrieval
**Purpose**: Provide relevant memories for agent decision-making

#### Retrieval Algorithm
```typescript
async getContextualMemories(
  agent_id: string, 
  context: string, 
  limit: number = 15
): Promise<Memory[]> {
  // Generate embedding for context
  const contextEmbedding = await this.generateEmbedding(context);
  
  // Get three types of memories
  const recentMemories = await this.getRecentMemories(agent_id, limit/3);
  const importantMemories = await this.getImportantMemories(agent_id, limit/3);
  const relevantMemories = await this.getSemanticMemories(agent_id, contextEmbedding, limit/3);
  
  // Combine and deduplicate
  const allMemories = [...recentMemories, ...importantMemories, ...relevantMemories];
  return this.deduplicateAndScore(allMemories, context, limit);
}
```

#### Scoring Algorithm
Memory relevance is calculated using multiple factors:
- **Recency**: More recent memories scored higher
- **Importance**: High-importance memories prioritized
- **Similarity**: Semantic similarity to current context
- **Emotional Relevance**: Emotional connection to current situation

### Conversation Memory Retrieval
**Purpose**: Specialized retrieval for NPC conversations

#### Process
1. **General Context**: Retrieve memories based on player message semantics
2. **Conversation History**: Get previous interactions with specific player
3. **Memory Segregation**: Separate reflections from observations
4. **Contextual Assembly**: Create comprehensive memory context

```typescript
// Example conversation memory context
const memoryContext = `
=== YOUR REFLECTIONS AND INSIGHTS ===
- I've noticed that I've been spending more time at the library lately
- My conversations with Sarah suggest she's worried about the harvest

=== YOUR RECENT EXPERIENCES AND CONVERSATIONS ===
- Player_123 said to me: "How's the farming going?"
- I responded to Player_123: "The crops are looking good this season"
- I saw Player_123 working in the fields near the farmhouse
`;
```

## Reflection System

### Automatic Reflection Generation
**Purpose**: Generate higher-level insights from accumulated experiences

#### Trigger Conditions
- **Cumulative Importance**: ≥150 points since last reflection
- **Minimum Memories**: ≥5 memories for adequate data
- **Daily Limits**: Maximum 3 reflections per day
- **Time Spacing**: Minimum time between reflections

#### Generation Process
1. **Memory Collection**: Gather memories since last reflection
2. **Context Assembly**: Include agent constitution and goals
3. **LLM Processing**: Generate insights using GPT-4o-mini
4. **Quality Validation**: Ensure reflection quality and relevance
5. **Storage**: Store as high-importance memory

#### Example Reflection Prompt
```typescript
const prompt = `You are ${agent.name}, a character in Heartwood Valley. 

Your core personality: ${agent.constitution}
Your goal: ${agent.primary_goal}
Your traits: ${agent.personality_traits?.join(', ')}

Based on your recent experiences, reflect on patterns, relationships, and insights.

Recent memories:
- Player_123 asked about the harvest (importance: 6)
- I spent time organizing the library (importance: 5)
- Sarah mentioned concerns about the weather (importance: 7)

Generate a thoughtful reflection that synthesizes these experiences.
`;
```

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
    embedding vector(1536) -- pgvector extension
);
```

#### Performance Indexes
```sql
-- Primary indexes for efficient querying
CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_timestamp ON agent_memories(timestamp);
CREATE INDEX idx_agent_memories_importance ON agent_memories(importance_score);
CREATE INDEX idx_agent_memories_type ON agent_memories(memory_type);

-- Vector similarity index
CREATE INDEX idx_agent_memories_embedding ON agent_memories 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Composite indexes for complex queries
CREATE INDEX idx_agent_memories_agent_time ON agent_memories(agent_id, timestamp DESC);
CREATE INDEX idx_agent_memories_agent_importance ON agent_memories(agent_id, importance_score DESC);
```

## Performance Optimization

### Caching Strategy
**Redis Integration**: Frequently accessed memories cached in Redis

```typescript
// Cache memory retrieval results
const cacheKey = `agent_memories:${agent_id}:${JSON.stringify(options)}`;
const cachedResult = await this.redisClient.get(cacheKey);
if (cachedResult) {
  return JSON.parse(cachedResult);
}
```

### Memory Consolidation
**Purpose**: Reduce storage overhead for related memories

#### Conversation Consolidation
- Groups conversation memories by session (1-hour windows)
- Creates summary memories for extended interactions
- Marks original memories as consolidated
- Maintains conversation quality while reducing storage

### Connection Pooling
**Database Efficiency**: Optimized connection management

```typescript
const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Integration Points

### Game Server Integration
- **Player Action Monitoring**: Real-time action detection
- **Proximity Detection**: Efficient spatial queries
- **Event Publishing**: Redis pub/sub for action distribution

### LLM Integration
- **Conversation Context**: Memory-informed responses
- **Planning Context**: Memory-based daily planning
- **Reflection Generation**: Insight synthesis from memories

### UI Integration
- **Memory Visualization**: Development tools for memory inspection
- **Conversation History**: Player-NPC interaction tracking
- **Debug Interfaces**: Memory system monitoring

## Cost Optimization

### OpenAI API Usage
- **Embedding Generation**: ~$0.0001 per memory
- **Reflection Generation**: ~$0.001 per reflection
- **Daily Limits**: Controlled API usage

### Storage Optimization
- **Filtering Efficiency**: 60% storage reduction
- **Vector Compression**: Optimized embedding storage
- **Indexing Strategy**: Balanced query performance vs. storage

## Memory Statistics

### Typical Memory Generation
- **Observations**: 4-6 per agent per day
- **Reflections**: 1-3 per agent per day
- **Plans**: 1-2 per agent per day
- **Metacognition**: 0-1 per agent per day

### Performance Metrics
- **Memory Retrieval**: <100ms for contextual queries
- **Semantic Search**: <200ms for similarity queries
- **Storage Operations**: <50ms for memory creation
- **Filtering Efficiency**: 60% reduction in stored memories

## Development Tools

### Memory Testing Endpoints
- `GET /memory/debug-memories/:agent_id` - Debug memory retrieval
- `GET /memory/stats/:agent_id` - Memory statistics
- `POST /memory/test-observation` - Test observation storage
- `POST /memory/test-semantic-search` - Test semantic search

### Monitoring and Analytics
- **Memory Volume**: Track memories per agent
- **Reflection Frequency**: Monitor reflection generation
- **Retrieval Performance**: Query timing analysis
- **Storage Efficiency**: Filtering effectiveness

## Future Enhancements

### Planned Improvements
1. **Enhanced Consolidation**: More sophisticated memory summarization
2. **Emotional Context**: Deeper emotional memory integration
3. **Cross-Agent Memories**: Shared memory experiences
4. **Long-term Memory**: Archival and retrieval strategies

### Technical Enhancements
1. **Performance Optimization**: Further query optimization
2. **Scalability**: Horizontal scaling preparation
3. **Advanced Analytics**: Memory pattern analysis
4. **Real-time Updates**: Live memory stream updates

## Conclusion

The AI Memory System represents a significant advancement in autonomous agent capabilities. By implementing sophisticated memory storage, retrieval, and reflection mechanisms, NPCs can maintain persistent personalities, learn from experiences, and engage in meaningful interactions.

The system's multi-layer filtering and cost optimization ensure sustainable operation while maintaining high-quality memory experiences. The modular architecture enables easy extension and modification for future enhancements.

This memory system forms the foundation for truly autonomous NPCs that can remember, learn, and adapt in a persistent virtual world. 