# Technical Design Document

## Project Overview

**Project Name**: Heartwood Valley  
**Status**: Production-Ready Prototype  
**Version**: 1.0 (Core AI Systems Complete)  
**Last Updated**: December 2024

Heartwood Valley is a revolutionary multiplayer life simulation game featuring 24 fully autonomous AI agents with sophisticated cognitive architectures. The system implements a complete Memory-Reflection-Planning-Metacognition loop, enabling emergent behaviors and meaningful social interactions in a persistent virtual world.

## System Architecture

### Microservices Architecture

The system is built using a microservices architecture orchestrated with Docker Compose:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Production Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────┐ │
│  │   Client        │  │   Game Server   │  │   Web API       │  │Database │ │
│  │   (Phaser 3)    │  │   (Colyseus)    │  │   (Express.js)  │  │Layer    │ │
│  │   TypeScript    │  │   TypeScript    │  │   TypeScript    │  │         │ │
│  │   Port: 5173    │  │   Port: 2567    │  │   Port: 3000    │  │         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │         │ │
│                                                                  │PostgreSQL│ │
│                                                                  │  + Redis │ │
│                                                                  │         │ │
│                                                                  └─────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Services

#### 1. Client Service (Phaser 3)
- **Technology**: Phaser 3, TypeScript, Vite
- **Purpose**: Game client with real-time multiplayer
- **Features**: 
  - 8-directional player movement
  - Real-time NPC interaction
  - Multiplayer synchronization
  - Dialogue system

#### 2. Game Server (Colyseus)
- **Technology**: Colyseus, Node.js, TypeScript
- **Purpose**: Real-time multiplayer game server
- **Features**:
  - 60 FPS server updates
  - 10 concurrent players
  - 24 autonomous AI agents
  - Real-time state synchronization

#### 3. Web API (Express.js)
- **Technology**: Express.js, Node.js, TypeScript
- **Purpose**: AI processing and HTTP endpoints
- **Features**:
  - NPC conversation processing
  - Memory management
  - Reflection & metacognition
  - Job queue processing

#### 4. Database Layer
- **Technology**: PostgreSQL 14 + pgvector, Redis 7
- **Purpose**: Persistent storage and caching
- **Features**:
  - Vector similarity search
  - Agent memory storage
  - Real-time data caching
  - Job queue management

## AI Architecture

### Cognitive Architecture Implementation

The system implements a complete cognitive architecture based on "Generative Agents" research:

#### 1. Memory System
- **Vector Embeddings**: 1536-dimensional OpenAI embeddings
- **Semantic Search**: pgvector cosine similarity search
- **Multi-layer Filtering**: 60% storage reduction
- **Memory Types**: observations, reflections, plans, metacognition

#### 2. Reflection System
- **Automatic Triggers**: Cumulative importance ≥150 points
- **Daily Limits**: 3 reflections per agent (cost optimization)
- **Insight Generation**: Pattern recognition and behavioral analysis
- **High-importance Storage**: Reflections stored as priority memories

#### 3. Metacognition System
- **Performance Evaluation**: Self-assessment capabilities
- **Strategy Adjustment**: Dynamic behavioral modification
- **Schedule Updates**: Real-time plan modifications
- **Daily Limits**: 1 metacognition per agent (cost optimization)

#### 4. Planning System
- **Daily Plan Generation**: LLM-based schedule creation
- **Context Integration**: Memory-informed planning
- **Emergency Response**: High-priority action interruption
- **Schedule Execution**: Time-based action triggering

### Activity System

#### Activity Management
- **61 Core Activities**: Comprehensive behavior set
- **200+ Aliases**: Natural language processing
- **52 Locations**: Complete world mapping
- **State Machine**: Planning → Movement → Execution

#### Movement Coordination
- **A* Pathfinding**: Optimal route calculation
- **Collision Detection**: Tile-based movement validation
- **Smooth Movement**: Velocity-based interpolation
- **Spatial Coordination**: Multi-agent coordination

## Data Architecture

### Database Schema

#### Core Tables
```sql
-- Agent management
agents (id, name, constitution, personality, goals, schedule)
agent_states (agent_id, position, current_activity, state)

-- Memory system
agent_memories (id, agent_id, content, importance, embedding[1536])
agent_reflections (id, agent_id, reflection, insights)
agent_metacognition (id, agent_id, evaluation, strategy_adjustments)

-- Planning system
agent_plans (id, agent_id, goal, plan_steps, status)
agent_schedules (id, agent_id, time, activity, priority)

-- Social system
agent_relationships (agent_id, other_agent_id, relationship_type, affection)
conversation_logs (id, initiator, recipient, message, response)
```

#### Performance Optimization
- **Vector Indexing**: IVFFlat indexes for embedding searches
- **Composite Indexes**: Optimized for common query patterns
- **Connection Pooling**: Efficient database connections
- **Redis Caching**: High-performance data caching

### Memory Management

#### Filtering Strategy
- **Importance Filter**: Only store memories with importance ≥4
- **Temporal Filter**: 5-minute cooldown for similar observations
- **Semantic Filter**: Prevent duplicate memories using embeddings
- **Result**: 60% reduction in storage while maintaining quality

#### Retrieval Algorithm
```
Contextual Memory Retrieval:
- Recent memories (33%): Last 24 hours
- Important memories (33%): Importance score ≥7
- Relevant memories (33%): Semantic similarity to context
```

## Real-time Multiplayer

### Colyseus Integration

#### State Synchronization
- **Schema-based**: Efficient binary serialization
- **60 FPS Updates**: Smooth real-time synchronization
- **Player Capacity**: 10 concurrent players
- **State Management**: Automatic state reconciliation

#### Networking Architecture
```typescript
// Client-server communication
WebSocket Connection → State Synchronization → Game Logic → State Updates
```

### Player Actions
- **Movement**: 8-directional WASD movement
- **Interaction**: NPC conversations and world interactions
- **Observation**: NPCs observe and remember player actions
- **Social**: Chat and social interaction systems

## External Integrations

### OpenAI API Integration
- **Models**: GPT-4o-mini (conversations), text-embedding-3-small (embeddings)
- **Cost Optimization**: Daily limits and efficient processing
- **Rate Limiting**: Job queue management
- **Error Handling**: Robust API error recovery

### Third-party Dependencies
- **Colyseus**: Real-time multiplayer framework
- **Phaser 3**: Game engine and rendering
- **pgvector**: Vector similarity search
- **Bull**: Redis job queue management
- **Docker**: Containerization and orchestration

## Performance Specifications

### System Performance
- **Concurrent Players**: 10 players at 60 FPS
- **AI Agents**: 24 autonomous agents
- **Memory Storage**: ~4-6 memories per agent per day
- **Response Times**: <2 seconds for conversations
- **Cost**: ~$2-3 per day for all agents

### Optimization Strategies
- **Memory Filtering**: 60% storage reduction
- **Job Queues**: Efficient LLM processing
- **Caching**: Redis for frequently accessed data
- **Connection Pooling**: Optimized database connections

## Security and Reliability

### Data Protection
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: API abuse prevention
- **Error Handling**: Graceful degradation
- **Database Integrity**: Foreign key constraints

### Monitoring
- **Logging**: Comprehensive system logging
- **Performance Metrics**: Response time tracking
- **Error Tracking**: Detailed error reporting
- **Resource Monitoring**: Memory and CPU tracking

## Development Infrastructure

### Docker Compose Stack
```yaml
services:
  client:      # Vite development server
  game-server: # Colyseus multiplayer server
  web-api:     # Express.js API server
  postgres:    # PostgreSQL with pgvector
  redis:       # Redis cache and queues
```

### Development Workflow
- **Hot Reload**: Instant code changes
- **Type Safety**: Full TypeScript coverage
- **Error Handling**: Comprehensive error management
- **Testing**: Unit and integration tests

## API Specifications

### Core Endpoints

#### NPC Interaction
```typescript
POST /npc/interact
{
  "npcId": "elara_blacksmith",
  "message": "How's business?",
  "characterId": "player_123"
}
```

#### Memory Management
```typescript
GET /memory/stats/:agentId
GET /memory/debug-memories/:agentId
POST /memory/test-observation
```

#### Reflection System
```typescript
POST /reflection/trigger
GET /reflection/history/:agentId
GET /reflection/queue-status
```

#### Metacognition System
```typescript
POST /metacognition/trigger
GET /metacognition/history/:agentId
GET /metacognition/schedule-modifications/:agentId
```

## Deployment Configuration

### Production Environment
- **Docker Compose**: Multi-container orchestration
- **Environment Variables**: Secure configuration management
- **Volume Management**: Persistent data storage
- **Network Configuration**: Service-to-service communication

### Scaling Considerations
- **Horizontal Scaling**: Multiple game server instances
- **Database Scaling**: Read replicas and connection pooling
- **Cache Scaling**: Redis cluster configuration
- **Load Balancing**: Nginx reverse proxy setup

## Quality Assurance

### Testing Strategy
- **Unit Tests**: Individual component testing
- **Integration Tests**: System integration validation
- **Load Testing**: Performance under load
- **AI Testing**: Conversation quality validation

### Code Quality
- **TypeScript**: Full type safety coverage
- **Linting**: ESLint and Prettier configuration
- **Code Reviews**: Peer review processes
- **Documentation**: Comprehensive inline documentation

## Future Enhancements

### Planned Features
1. **Enhanced Social Dynamics**: More complex NPC relationships
2. **Farming Mechanics**: Core gameplay loop implementation
3. **Player Progression**: Character development systems
4. **Extended World**: Additional locations and content

### Technical Roadmap
1. **Scalability**: Horizontal scaling preparation
2. **Performance**: Further optimization opportunities
3. **Advanced AI**: Enhanced cognitive capabilities
4. **Analytics**: Advanced metrics and monitoring

## Risk Assessment

### Technical Risks
- **API Costs**: OpenAI usage costs managed through limits
- **Performance**: Scaling challenges with more agents
- **Reliability**: Dependency on external services
- **Data Loss**: Comprehensive backup strategies

### Mitigation Strategies
- **Cost Controls**: Daily limits and efficient processing
- **Performance Monitoring**: Real-time metrics and alerts
- **Redundancy**: Multiple service instances
- **Backup Systems**: Automated data backup and recovery

## Conclusion

Heartwood Valley represents a significant technical achievement in autonomous AI agent development. The system successfully implements a complete cognitive architecture with sophisticated memory, reflection, and social capabilities. The production-ready codebase demonstrates the potential for truly autonomous NPCs that can engage in meaningful, contextual interactions with players.

The modular architecture enables easy extension and modification, while the cost-optimized design ensures sustainable operation. This technical foundation provides a robust platform for future enhancements and scaling to larger player populations.

**Key Achievements:**
- ✅ Complete cognitive architecture implementation
- ✅ Cost-optimized AI processing ($2-3/day for 24 agents)
- ✅ Real-time multiplayer with 60 FPS performance
- ✅ Sophisticated memory and reflection systems
- ✅ Production-ready deployment with Docker
- ✅ Comprehensive API and testing infrastructure

The system is ready for production deployment and represents a new standard for autonomous AI agents in multiplayer gaming environments. 