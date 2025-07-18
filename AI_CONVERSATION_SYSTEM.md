# AI Conversation System Documentation

## Overview

The AI Conversation System enables meaningful, contextual interactions between players and NPCs in Heartwood Valley. It leverages advanced memory retrieval, personality-driven responses, and sophisticated natural language processing to create believable conversations that feel personal and contextually relevant.

**Status**: ✅ Fully Operational with memory-informed responses

## Architecture

### Core Components

#### 1. NPC Routes
**Location**: `web-api/src/routes/npcRoutes.ts`  
**Purpose**: HTTP endpoints for player-NPC interactions

**Key Features**:
- **Rate Limiting**: 1 message per 5 seconds per player
- **Job Queuing**: Async LLM processing via Bull Queue
- **Conversation Tracking**: Session management and history
- **Emergency Response**: Urgent scenario handling

#### 2. LLM Worker
**Location**: `web-api/src/services/LLMWorker.ts`  
**Purpose**: Processes conversation jobs and generates responses

**Key Features**:
- **Memory Integration**: Contextual memory retrieval
- **Prompt Construction**: Personality-driven prompt building
- **Response Generation**: GPT-4o-mini powered responses
- **Conversation Storage**: Memory system integration

#### 3. Memory Integration
**Integration**: AgentMemoryManager + AgentObservationSystem  
**Purpose**: Provides conversational context and stores interactions

**Key Features**:
- **Contextual Retrieval**: Semantic memory search
- **Conversation History**: Player-specific memory recall
- **Fact Extraction**: Key information identification
- **Reflection Triggers**: Post-conversation insight generation

## Conversation Flow

### 1. Player Request Processing
```typescript
// Request validation and rate limiting
POST /npc/interact
{
  "npcId": "elara_blacksmith",
  "message": "How's the metalworking business?",
  "characterId": "player_123"
}

// Rate limiting check (1 message per 5 seconds)
const rateLimitKey = `ratelimit:interact:${characterId}`;
const rateLimitCheck = await redisClient.get(rateLimitKey);
```

### 2. Job Queue Processing
```typescript
// Create conversation job
const jobData = {
  npcId: "elara_blacksmith",
  npcName: "Elara",
  constitution: "A skilled blacksmith who takes pride in her craft...",
  characterId: "player_123",
  playerMessage: "How's the metalworking business?",
  timestamp: Date.now()
};

const job = await conversationQueue.add('processConversation', jobData);
```

### 3. Memory Retrieval
```typescript
// Retrieve contextual memories
const contextualMemories = await memoryManager.getContextualMemories(
  npcId, 
  playerMessage, 
  10 // limit
);

// Get conversation-specific memories
const conversationMemories = await memoryManager.getConversationMemories(
  npcId, 
  characterId, 
  8 // limit
);

// Combine and organize memories
const allMemories = [...contextualMemories, ...conversationMemories];
```

### 4. Prompt Construction
```typescript
// Build contextual prompt
const prompt = `You are ${npcName}, a character in Heartwood Valley.

${constitution}

=== YOUR REFLECTIONS AND INSIGHTS ===
${reflections.map(r => `- ${r.content}`).join('\n')}

=== YOUR RECENT EXPERIENCES AND CONVERSATIONS ===
${observations.map(o => `- ${o.content}`).join('\n')}

Current situation: ${currentTime}, ${currentLocation}
Player says: "${playerMessage}"

Respond naturally as ${npcName}. Keep responses conversational and in character.`;
```

### 5. Response Generation
```typescript
// Generate response using GPT-4o-mini
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: prompt }],
  max_tokens: 200,
  temperature: 0.7
});

const npcResponse = response.choices[0].message.content;
```

### 6. Memory Storage
```typescript
// Store player's message
await memoryManager.storeObservation(
  npcId,
  `${playerName} said to me: "${playerMessage}"`,
  'conversation',
  [], // related_agents
  [characterId], // related_players
  8 // importance
);

// Store NPC's response
await memoryManager.storeObservation(
  npcId,
  `I responded to ${playerName}: "${npcResponse}"`,
  'conversation',
  [], // related_agents
  [characterId], // related_players
  7 // importance
);
```

## Memory-Informed Responses

### Contextual Memory Assembly
The system creates rich conversational context by combining multiple memory types:

#### 1. Reflections and Insights
High-level thoughts and patterns recognized by the NPC:
```typescript
// Example reflections in conversation context
"=== YOUR REFLECTIONS AND INSIGHTS ===
- I've noticed that I've been spending more time at the blacksmith shop lately
- My conversations with the townspeople suggest they're interested in my metalwork
- I seem to be developing a reputation for quality craftsmanship"
```

#### 2. Recent Experiences
Specific observations and interactions:
```typescript
// Example experiences in conversation context
"=== YOUR RECENT EXPERIENCES AND CONVERSATIONS ===
- Player_123 asked about my metalworking techniques (importance: 8)
- I completed a complex repair on a fishing boat (importance: 7)
- Mayor Henderson commissioned a new weather vane (importance: 6)"
```

#### 3. Conversation History
Previous interactions with the specific player:
```typescript
// Player-specific conversation memories
const conversationMemories = await memoryManager.getConversationMemories(
  npcId, 
  characterId, 
  8
);
// Results in personalized context about past interactions
```

### Response Personalization
NPCs provide different responses based on:
- **Relationship History**: Previous interactions influence tone
- **Personality Traits**: Core personality affects response style
- **Current Context**: Time, location, and recent events
- **Memory Relevance**: Relevant past experiences shape responses

## Rate Limiting and Quality Control

### Rate Limiting
- **Player Limit**: 1 message per 5 seconds per player
- **Global Limits**: Managed through Redis
- **Queue Management**: Bull Queue handles overflow
- **Error Handling**: Graceful degradation on rate limit exceeded

### Quality Control
```typescript
// Input validation
if (!npcId || !message || typeof message !== 'string') {
  return res.status(400).json({ error: 'Invalid input' });
}

// Message length and content validation
if (message.trim().length === 0) {
  return res.status(400).json({ error: 'Empty message' });
}
```

## Conversation Job Processing

### Job Queue Architecture
```typescript
// Redis queue configuration
const conversationQueue = new Queue('conversation', {
  redis: {
    host: 'redis',
    port: 6379,
  },
});

// Job processing
conversationQueue.process('processConversation', async (job) => {
  const { npcId, playerMessage, characterId } = job.data;
  return await llmWorker.processConversation(job.data);
});
```

### Job Status Tracking
```typescript
// Check job status
GET /npc/conversation/:jobId

// Response examples
{
  "status": "processing",
  "message": "Job is still processing"
}

{
  "status": "completed",
  "response": "That's a great question! The metalworking business..."
}
```

## Emergency Response System

### Urgency Detection
The system can detect urgent scenarios in conversations and trigger immediate responses:

```typescript
// Emergency scenario detection
const urgentScenarios = {
  'medical_emergency': {
    urgencyLevel: 9,
    reason: 'Medical emergency requiring immediate attention'
  },
  'fire_emergency': {
    urgencyLevel: 9,
    reason: 'Fire emergency requiring immediate response'
  },
  'police_emergency': {
    urgencyLevel: 8,
    reason: 'Criminal emergency requiring police response'
  }
};
```

### Emergency Response Flow
1. **Urgency Analysis**: System analyzes conversation for emergency keywords
2. **Priority Assessment**: Assigns urgency level (1-10)
3. **Schedule Interruption**: High-priority events interrupt current activities
4. **Emergency Actions**: NPCs perform appropriate emergency responses
5. **Memory Storage**: Emergency interactions stored with high importance

## Post-Conversation Processing

### Conversation End Handling
```typescript
POST /npc/conversation-end
{
  "npcId": "elara_blacksmith",
  "characterId": "player_123",
  "conversationHistory": [
    {
      "message": "How's the metalworking business?",
      "sender": "player",
      "timestamp": 1234567890
    },
    {
      "message": "Business is good! I've been...",
      "sender": "npc",
      "timestamp": 1234567891
    }
  ],
  "duration": 30000
}
```

### Reflection Opportunities
Extended conversations can trigger reflection generation:
- **Conversation Length**: Longer conversations more likely to trigger reflection
- **Importance Scores**: High-importance interactions accumulate
- **Relationship Development**: Meaningful exchanges tracked
- **Insight Generation**: Patterns in player behavior recognized

## Performance Optimization

### Response Time Optimization
- **Memory Caching**: Frequently accessed memories cached in Redis
- **Parallel Processing**: Multiple conversation jobs processed simultaneously
- **Connection Pooling**: Efficient database connection management
- **Prompt Optimization**: Streamlined prompt construction

### Cost Management
- **Model Selection**: GPT-4o-mini for cost-effective responses
- **Token Limits**: 200 token limit for responses
- **Memory Limits**: Contextual memory limited to 15 most relevant
- **Daily Limits**: Per-agent conversation limits

## Integration Points

### Game Client Integration
```typescript
// Client-side conversation initiation
const response = await fetch('/npc/interact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    npcId: 'elara_blacksmith',
    message: playerMessage,
    characterId: currentPlayer.id
  })
});

// Poll for response
const jobId = response.jobId;
const result = await pollJobStatus(jobId);
```

### Activity System Integration
- **Conversation Interruption**: Conversations can interrupt current activities
- **Post-Conversation Activities**: NPCs may change activities based on conversations
- **Activity-Informed Responses**: Current activity influences conversation tone

### Planning System Integration
- **Schedule Modifications**: Important conversations can trigger plan changes
- **Goal Updates**: Conversations may influence NPC goals
- **Emergency Planning**: Urgent conversations trigger immediate planning

## Development Tools

### Testing Endpoints
```typescript
// Test urgent scenarios
POST /npc/test-urgent-scenario
{
  "npcId": "dr_helena",
  "scenario": "medical_emergency"
}

// List available scenarios
GET /npc/test-scenarios

// Generate test plans
POST /npc/generate-plan
{
  "npcId": "elara_blacksmith",
  "forceRegenerate": true
}
```

### Debug Interfaces
- **Conversation History**: View past interactions
- **Memory Context**: See what memories inform responses
- **Job Queue Status**: Monitor conversation processing
- **Response Quality**: Evaluate response appropriateness

### Analytics
- **Conversation Metrics**: Track conversation frequency and duration
- **Response Quality**: Monitor response appropriateness
- **Memory Usage**: Analyze memory integration effectiveness
- **Performance Metrics**: Track response times and costs

## Configuration

### System Configuration
```typescript
const conversationConfig = {
  rateLimitSeconds: 5,
  maxTokens: 200,
  temperature: 0.7,
  maxMemoryContext: 15,
  maxConversationHistory: 8,
  emergencyUrgencyThreshold: 7
};
```

### NPC Configuration
Each NPC has specific conversation traits:
- **Constitution**: Core personality and behavioral patterns
- **Conversation Style**: Formal, casual, technical, etc.
- **Memory Preferences**: What types of memories to prioritize
- **Response Patterns**: Common phrases and expressions

## Future Enhancements

### Planned Improvements
1. **Multi-turn Conversations**: Extended dialogue sessions
2. **Conversation Branching**: Multiple response options
3. **Emotional Context**: Mood-based response modification
4. **Group Conversations**: Multiple NPCs in single conversation

### Technical Enhancements
1. **Advanced Memory**: More sophisticated memory retrieval
2. **Response Caching**: Cache similar responses for efficiency
3. **Conversation Analytics**: Advanced conversation pattern analysis
4. **Real-time Updates**: Live conversation stream for debugging

## Conclusion

The AI Conversation System creates meaningful, contextual interactions between players and NPCs through sophisticated memory integration, personality-driven responses, and intelligent processing. The system's ability to recall past interactions, integrate current context, and generate appropriate responses makes each conversation feel personal and engaging.

The modular architecture enables easy extension and modification, while the cost-optimized design ensures sustainable operation. This system demonstrates how advanced AI can be effectively integrated into game environments to create truly engaging NPC interactions. 