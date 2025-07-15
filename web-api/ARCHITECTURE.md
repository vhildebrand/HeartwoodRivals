# Web API Architecture

## Overview
The Web API is an **Express.js** server that handles HTTP requests, acts as a secure proxy for LLM API calls, and manages the agent interaction system. It serves as the bridge between the game client and the AI-powered generative agents, implementing job queues for efficient LLM processing.

## Technology Stack
- **Express.js**: Web application framework
- **TypeScript**: Type-safe development
- **PostgreSQL**: Primary database via `pg` client
- **Redis**: Caching and job queue management
- **Bull Queue**: Job queue processing for LLM calls
- **OpenAI API**: LLM service integration
- **CORS**: Cross-origin resource sharing
- **dotenv**: Environment variable management

## Core Components

### 1. Server Entry Point (`src/index.ts`)
```typescript
Main server initialization:
- Environment configuration loading
- Database connection pool setup
- Redis client initialization
- CORS middleware configuration
- Route registration
- LLM Worker initialization
- Agent data loading
- Graceful shutdown handling
```

### 2. NPC Routes (`src/routes/npcRoutes.ts`)
Handles all NPC-related API endpoints:

**Key Endpoints:**
- `POST /npc/interact`: Main conversation endpoint
- `GET /npc/:id/info`: NPC information retrieval
- `GET /npc/:id/memory`: Memory stream access (future)

**Features:**
- **Rate Limiting**: 1 message per 5 seconds per user
- **Request Validation**: Input sanitization and validation
- **Job Queuing**: Async LLM processing via Bull Queue
- **Error Handling**: Comprehensive error responses

### 3. LLM Worker (`src/services/LLMWorker.ts`)
Processes LLM requests asynchronously:

**Key Features:**
- **Job Queue Processing**: Handles conversation jobs from Redis queue
- **OpenAI Integration**: Manages API calls to GPT-4o-mini
- **Prompt Construction**: Builds contextual prompts for agents
- **Response Processing**: Handles LLM responses and errors
- **Conversation Logging**: Stores interactions in database

**Processing Flow:**
1. Job dequeued from Redis
2. Agent context retrieved from database
3. Prompt constructed with constitution and context
4. LLM API call executed
5. Response processed and stored
6. Job marked as completed

### 4. Agent Management (`src/utils/loadAgents.ts`)
Handles agent data initialization:

**Features:**
- **JSON Loading**: Reads agent configurations from files
- **Database Insertion**: Populates agent and agent_states tables
- **Upsert Operations**: Updates existing agents on restart
- **State Initialization**: Sets up initial agent states

## Data Flow Architecture

### NPC Interaction Flow
```
Client POST /npc/interact → Input Validation → Rate Limiting Check
↓
Job Creation → Redis Queue → LLM Worker Processing
↓
Database Query (Agent Context) → Prompt Construction → OpenAI API Call
↓
Response Processing → Database Storage → Job Completion
↓
Client Response (Job ID) → Future: WebSocket notification
```

### Agent Data Flow
```
Agent JSON Files → loadAgents() → PostgreSQL (agents table)
↓
Agent States → PostgreSQL (agent_states table)
↓
LLM Worker → Context Retrieval → Prompt Construction
↓
OpenAI Response → Conversation Logging → Database Storage
```

### Database Integration Flow
```
Connection Pool → PostgreSQL Queries → Agent Context
↓
Redis Cache → Job Queue → LLM Processing
↓
Conversation Logs → Database Storage → Future Retrieval
```

## Database Schema Integration

### Agent Data Management
```sql
Agents Table:
- Basic agent information (name, constitution, goals)
- Personality traits and preferences
- Current state and location
- Schedule and plans

Agent States Table:
- Real-time agent state (position, action, emotions)
- Physical and cognitive state
- Current interactions and targets

Conversation Logs Table:
- Player-agent interaction history
- Message content and responses
- Context and emotional tone
- Timestamps for analytics
```

### Query Patterns
- **Agent Retrieval**: Get agent context for LLM prompts
- **State Updates**: Update agent state after interactions
- **Conversation Logging**: Store interaction history
- **Memory Retrieval**: Future memory stream access

## Job Queue Architecture

### Bull Queue Implementation
```typescript
Queue Configuration:
- Queue Name: 'conversation'
- Redis Backend: Connected to shared Redis instance
- Job Types: 'processConversation'
- Retry Logic: Automatic retry on failure
- Job Tracking: Complete job lifecycle management
```

### Job Processing
```typescript
Job Data Structure:
{
  npcId: string,
  npcName: string,
  constitution: string,
  characterId: string,
  playerMessage: string,
  timestamp: Date
}
```

### Benefits
- **Async Processing**: Non-blocking API responses
- **Scalability**: Multiple workers can process jobs
- **Reliability**: Job persistence and retry mechanisms
- **Monitoring**: Job status tracking and metrics

## Security Architecture

### Input Validation
- **Request Sanitization**: Prevents injection attacks
- **Type Checking**: Validates data types and formats
- **Length Limits**: Prevents oversized requests
- **Content Filtering**: Future: inappropriate content detection

### Rate Limiting
- **Redis-based**: Distributed rate limiting
- **Per-user Limits**: Individual user rate limiting
- **Configurable**: Adjustable rate limits
- **Graceful Degradation**: Informative error messages

### API Security
- **CORS Configuration**: Cross-origin request handling
- **Environment Variables**: Secure configuration management
- **Error Handling**: Prevents information leakage
- **Future**: JWT authentication and authorization

## Performance Optimizations

### Database Performance
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Indexed queries for fast retrieval
- **Prepared Statements**: SQL injection prevention
- **Transaction Management**: Consistent data operations

### LLM Integration
- **Job Queuing**: Prevents API rate limit issues
- **Model Selection**: Cost-effective model choice (GPT-4o-mini)
- **Prompt Optimization**: Efficient prompt construction
- **Response Caching**: Future: Common response caching

### Memory Management
- **Redis Caching**: Fast data retrieval
- **Connection Reuse**: Efficient resource utilization
- **Garbage Collection**: Proper cleanup on shutdown

## Error Handling & Resilience

### Error Types
- **Validation Errors**: 400 Bad Request responses
- **Rate Limit Errors**: 429 Too Many Requests
- **Database Errors**: 500 Internal Server Error
- **LLM API Errors**: Graceful degradation

### Resilience Features
- **Graceful Shutdown**: Proper cleanup on termination
- **Connection Recovery**: Automatic reconnection logic
- **Job Retry Logic**: Failed job reprocessing
- **Circuit Breaker**: Future: LLM API circuit breaker

## Integration Points

### Game Server Integration
- **Future**: Real-time agent state synchronization
- **Agent Movement**: Coordinate agent actions with game world
- **Event Broadcasting**: Notify game server of agent actions

### Database Integration
- **Shared Database**: Common PostgreSQL instance
- **Agent Synchronization**: Consistent agent state
- **Memory Sharing**: Future: shared memory stream

### Client Integration
- **RESTful API**: Standard HTTP communication
- **Future WebSocket**: Real-time notifications
- **Error Responses**: Consistent error handling

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Server runs on localhost:3000
# Auto-restart on code changes (nodemon)
```

### Environment Configuration
```env
# Database
DB_HOST=postgres
DB_USER=heartwood_user
DB_PASSWORD=heartwood_password
DB_NAME=heartwood_db

# Redis
REDIS_URL=redis://redis:6379

# OpenAI
OPENAI_API_KEY=your-api-key-here
```

## Future Enhancements (Sprint 2+)

### Memory System Integration
- **Vector Database**: pgvector integration for semantic search
- **Memory Retrieval**: Context-aware memory access
- **Reflection System**: Automated insight generation
- **Memory Importance**: Weighted memory selection

### Advanced Features
- **Authentication**: JWT-based user authentication
- **WebSocket Support**: Real-time agent updates
- **Caching Layer**: LLM response caching
- **Analytics**: Conversation analytics and insights

### Performance Scaling
- **Horizontal Scaling**: Multiple API instances
- **Load Balancing**: Request distribution
- **Database Sharding**: Improved database performance
- **CDN Integration**: Static asset delivery

## Monitoring & Observability

### Logging
- **Request Logging**: All API requests tracked
- **Error Logging**: Comprehensive error tracking
- **Performance Metrics**: Response time monitoring
- **LLM Usage**: API call tracking and costs

### Health Checks
- **Database Health**: Connection status monitoring
- **Redis Health**: Cache system status
- **LLM API Health**: External service monitoring
- **Queue Health**: Job processing status

### Metrics
- **Request Volume**: API usage statistics
- **Response Times**: Performance monitoring
- **Error Rates**: System reliability metrics
- **Queue Metrics**: Job processing statistics

This architecture provides a robust foundation for NPC interactions, with efficient async processing, comprehensive error handling, and scalable job queue management. 