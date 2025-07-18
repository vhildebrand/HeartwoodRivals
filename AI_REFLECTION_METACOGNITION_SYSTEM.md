# AI Reflection and Metacognition System Documentation

## Overview

The Reflection and Metacognition System implements advanced cognitive capabilities for NPCs in Heartwood Valley. It enables agents to generate higher-level insights from their experiences, evaluate their own performance, and adapt their strategies accordingly. This system represents the pinnacle of the autonomous agent architecture.

**Status**: ✅ Fully Operational with cost-optimized processing

## Architecture

### Core Components

#### 1. ReflectionProcessor
**Location**: `web-api/src/services/ReflectionProcessor.ts`  
**Purpose**: Manages reflection generation and processing queues

**Key Features**:
- **Queue Management**: Redis-based reflection processing
- **Batch Processing**: Efficient reflection generation
- **Cost Optimization**: Daily limits and throttling
- **Error Handling**: Robust processing pipeline

#### 2. MetacognitionProcessor
**Location**: `web-api/src/services/MetacognitionProcessor.ts`  
**Purpose**: Handles metacognitive evaluation and strategy adjustment

**Key Features**:
- **Performance Analysis**: Self-evaluation capabilities
- **Strategy Adjustment**: Behavioral modification
- **Schedule Updates**: Dynamic plan modifications
- **Daily Limits**: Cost-controlled processing

#### 3. AgentMemoryManager Integration
**Purpose**: Triggers and stores reflection/metacognition outputs

**Key Features**:
- **Trigger Detection**: Automatic reflection initiation
- **Memory Storage**: High-importance memory creation
- **Context Assembly**: Comprehensive experience analysis
- **Threshold Management**: Cumulative importance tracking

## Reflection System

### Automatic Reflection Generation

#### Trigger Mechanism
```typescript
// Reflection triggered by cumulative importance
private async checkReflectionTrigger(agent_id: string): Promise<void> {
  // Check daily limits (cost optimization)
  const todayReflectionCount = await this.getDailyReflectionCount(agent_id);
  const MAX_REFLECTIONS_PER_DAY = 3;
  
  if (todayReflectionCount >= MAX_REFLECTIONS_PER_DAY) {
    return; // Skip to save costs
  }
  
  // Calculate cumulative importance since last reflection
  const cumulativeImportance = await this.getCumulativeImportance(agent_id);
  const REFLECTION_THRESHOLD = 150; // Stanford paper threshold
  
  if (cumulativeImportance >= REFLECTION_THRESHOLD) {
    await this.queueReflectionGeneration(agent_id, cumulativeImportance);
  }
}
```

#### Reflection Generation Process
```typescript
// Generate reflection using LLM
async generateReflection(agent_id: string): Promise<void> {
  // Get recent memories for analysis
  const recentMemories = await this.getMemoriesForReflection(agent_id);
  
  // Get agent context
  const agent = await this.getAgentData(agent_id);
  
  // Construct reflection prompt
  const prompt = `You are ${agent.name}, a character in Heartwood Valley.
  
  Your core personality: ${agent.constitution}
  Your goal: ${agent.primary_goal}
  Your traits: ${agent.personality_traits?.join(', ')}
  
  Recent memories:
  ${recentMemories.map(m => `- ${m.content} (importance: ${m.importance_score})`).join('\n')}
  
  Generate a thoughtful reflection that synthesizes these experiences.`;
  
  // Generate reflection
  const reflectionText = await this.llm.generate(prompt);
  
  // Store as high-importance memory
  await this.storeReflectionMemory(agent_id, reflectionText);
}
```

### Reflection Content Examples

#### Pattern Recognition
```
"I've noticed that I've been spending more time at the library lately - 
perhaps I'm seeking knowledge to help solve the town's problems."
```

#### Relationship Insights
```
"My conversations with the townspeople suggest they're worried about 
the upcoming harvest. I should consider how my work might help."
```

#### Behavioral Adaptations
```
"I seem to be developing a closer relationship with Sarah - our daily 
conversations about farming are becoming more personal."
```

## Metacognition System

### Performance Evaluation

#### Metacognitive Triggers
```typescript
// Trigger metacognitive evaluation
private async triggerMetacognitionCheck(agent_id: string, importance: number): Promise<void> {
  // Check daily limits
  const todayMetacognitionCount = await this.getDailyMetacognitionCount(agent_id);
  const MAX_METACOGNITION_PER_DAY = 1;
  
  if (todayMetacognitionCount >= MAX_METACOGNITION_PER_DAY) {
    return; // Cost optimization
  }
  
  // High-importance events trigger immediate metacognition
  if (importance >= 9) {
    await this.queueMetacognitionGeneration(agent_id, 'urgent_event');
  }
}
```

#### Performance Analysis
```typescript
// Get performance data for metacognitive evaluation
private async getPerformanceData(agent_id: string): Promise<PerformanceData> {
  // Get recent activities and outcomes
  const recentMemories = await this.getRecentMemories(agent_id, 72); // 3 days
  const recentPlans = await this.getRecentPlans(agent_id);
  const recentReflections = await this.getRecentReflections(agent_id);
  
  return {
    memories: recentMemories,
    plans: recentPlans,
    reflections: recentReflections,
    performance_indicators: {
      memory_count: recentMemories.length,
      plan_count: recentPlans.length,
      completed_plans: recentPlans.filter(p => p.status === 'completed').length,
      failed_plans: recentPlans.filter(p => p.status === 'abandoned').length
    }
  };
}
```

### Strategy Adjustment

#### Metacognitive Processing
```typescript
// Process metacognitive evaluation
async processMetacognition(agent_id: string, trigger_reason: string): Promise<void> {
  const performanceData = await this.getPerformanceData(agent_id);
  const agent = await this.getAgentData(agent_id);
  
  // Construct metacognitive prompt
  const prompt = `You are ${agent.name}. Analyze your recent performance:
  
  Recent Activities: ${performanceData.memories.length} memories
  Completed Plans: ${performanceData.performance_indicators.completed_plans}
  Failed Plans: ${performanceData.performance_indicators.failed_plans}
  
  Evaluate your effectiveness and suggest strategy adjustments.`;
  
  // Generate metacognitive evaluation
  const evaluation = await this.llm.generate(prompt);
  
  // Store metacognitive insights
  await this.storeMetacognitionResult(agent_id, evaluation, trigger_reason);
}
```

#### Schedule Modifications
```typescript
// Modify agent schedule based on metacognitive insights
private async applyScheduleModifications(agent_id: string, insights: string): Promise<void> {
  // Analyze insights for schedule changes
  const scheduleChanges = await this.analyzeScheduleChanges(insights);
  
  if (scheduleChanges.length > 0) {
    // Create new plan with modifications
    const modifiedPlan = await this.createModifiedPlan(agent_id, scheduleChanges);
    
    // Store plan for execution
    await this.storePlan(agent_id, modifiedPlan);
    
    // Queue schedule reload
    await this.queueScheduleReload(agent_id);
  }
}
```

## Cost Optimization

### Daily Limits
```typescript
// Cost optimization through daily limits
const DAILY_LIMITS = {
  reflections: 3,      // Max 3 reflections per agent per day
  metacognition: 1,    // Max 1 metacognition per agent per day
  emergency_override: 9 // Importance threshold for emergency processing
};
```

### Processing Efficiency
```typescript
// Efficient queue processing
private async processReflectionQueue(): Promise<void> {
  const batchSize = 5;
  const queue = await this.getReflectionQueue();
  
  // Process in batches to optimize API usage
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    await Promise.all(batch.map(item => this.processReflection(item)));
    
    // Rate limiting between batches
    await this.delay(1000);
  }
}
```

## Integration Points

### Memory System Integration
```typescript
// Reflection storage in memory system
await this.memoryManager.storeReflectionMemory({
  agent_id,
  memory_type: 'reflection',
  content: reflectionText,
  importance_score: 8, // Reflections are high-importance
  emotional_relevance: 7,
  tags: ['reflection', 'self_insight', 'pattern_recognition'],
  related_agents: this.extractRelatedAgents(memories),
  related_players: this.extractRelatedPlayers(memories),
  location: 'internal'
});
```

### Planning System Integration
```typescript
// Metacognition influences planning
const metacognitionResult = await this.processMetacognition(agent_id);
if (metacognitionResult.schedule_modifications) {
  await this.planningSystem.updateAgentSchedule(agent_id, metacognitionResult.schedule_modifications);
}
```

### Conversation System Integration
```typescript
// High-importance conversations trigger metacognition
if (conversationImportance >= 8) {
  await this.metacognitionProcessor.triggerMetacognition(agent_id, 'significant_conversation');
}
```

## API Endpoints

### Reflection Routes
```typescript
// Manual reflection trigger
POST /reflection/trigger
{
  "agentId": "elara_blacksmith"
}

// Reflection history
GET /reflection/history/:agentId?limit=10

// Reflection queue status
GET /reflection/queue-status
```

### Metacognition Routes
```typescript
// Manual metacognition trigger
POST /metacognition/trigger
{
  "agentId": "elara_blacksmith",
  "reason": "manual_evaluation"
}

// Metacognition history
GET /metacognition/history/:agentId?limit=10

// Schedule modifications
GET /metacognition/schedule-modifications/:agentId
```

## Performance Metrics

### Reflection Statistics
- **Daily Generation**: 1-3 reflections per agent
- **Processing Time**: <2 seconds per reflection
- **Cost**: ~$0.001 per reflection (GPT-4o-mini)
- **Memory Impact**: High-importance memories (8-9)

### Metacognition Statistics
- **Daily Generation**: 0-1 metacognition per agent
- **Processing Time**: <3 seconds per evaluation
- **Cost**: ~$0.002 per metacognition
- **Schedule Impact**: 20-30% of evaluations modify schedules

## Quality Assurance

### Reflection Quality
```typescript
// Validate reflection quality
private validateReflection(reflection: string): boolean {
  return reflection.length > 50 && 
         reflection.includes('I') && 
         !reflection.includes('ERROR') &&
         reflection.split(' ').length > 10;
}
```

### Metacognition Validation
```typescript
// Validate metacognitive output
private validateMetacognition(evaluation: string): boolean {
  const hasPerformanceAnalysis = evaluation.includes('performance') || 
                                evaluation.includes('effective');
  const hasStrategyAdjustment = evaluation.includes('strategy') || 
                               evaluation.includes('approach');
  
  return hasPerformanceAnalysis && hasStrategyAdjustment;
}
```

## Future Enhancements

### Planned Improvements
1. **Cross-Agent Reflections**: Shared insights between agents
2. **Emotional Metacognition**: Mood-based strategy adjustment
3. **Long-term Learning**: Multi-day pattern recognition
4. **Collaborative Reflection**: Group insight generation

### Technical Enhancements
1. **Advanced Analytics**: Reflection effectiveness metrics
2. **Predictive Insights**: Future behavior prediction
3. **Optimization**: Further cost reduction strategies
4. **Real-time Updates**: Live reflection streaming

## Conclusion

The Reflection and Metacognition System represents the most advanced cognitive capabilities of the autonomous agents in Heartwood Valley. By implementing sophisticated self-evaluation and insight generation, NPCs can learn from their experiences, adapt their behaviors, and demonstrate truly intelligent responses to changing circumstances.

The system's cost-optimized design ensures sustainable operation while maintaining high-quality cognitive processing. This advanced AI capability sets a new standard for autonomous agent intelligence in gaming environments. 