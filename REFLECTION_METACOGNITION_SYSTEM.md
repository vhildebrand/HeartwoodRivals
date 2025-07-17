# Reflection and Metacognition System Documentation

## Overview

The Reflection and Metacognition System implements advanced cognitive capabilities for NPCs in Heartwood Valley, based on cutting-edge AI research. This system enables NPCs to analyze their experiences, form higher-level insights, evaluate their own performance, and strategically adjust their behavior to achieve their goals more effectively.

## Architecture

### Core Components

#### 1. ReflectionProcessor (`web-api/src/services/ReflectionProcessor.ts`)
- **Purpose**: Manages reflection generation and processing
- **Features**:
  - Automatic reflection triggering based on memory thresholds
  - Background queue processing for reflections
  - Memory pattern analysis
  - Integration with agent memory system

#### 2. MetacognitionProcessor (`web-api/src/services/MetacognitionProcessor.ts`)
- **Purpose**: Handles metacognitive evaluation and strategy adjustment
- **Features**:
  - Performance evaluation and self-assessment
  - Strategy modification based on outcomes
  - Dynamic schedule adjustment
  - Goal modification and adaptation

#### 3. AgentMemoryManager Integration
- **Purpose**: Provides memory context for cognitive processes
- **Features**:
  - Reflection trigger monitoring
  - Memory retrieval for analysis
  - Storage of reflections and metacognitive insights
  - Importance scoring for cognitive triggers

## Reflection System

### Automatic Reflection Triggering

#### Trigger Conditions
```typescript
// Reflection triggered when cumulative importance exceeds threshold
private async checkReflectionTrigger(agent_id: string): Promise<void> {
  const cumulativeImportance = await this.getCumulativeImportance(agent_id);
  const REFLECTION_THRESHOLD = 150;
  
  if (cumulativeImportance >= REFLECTION_THRESHOLD) {
    await this.queueReflectionGeneration(agent_id);
  }
}
```

#### Key Parameters
- **Threshold**: 150 cumulative importance points
- **Frequency**: 2-3 reflections per day for active agents
- **Minimum Memories**: At least 5 memories required
- **Cost Optimization**: Limited to 3 reflections per day

### Reflection Generation Process

#### 1. Memory Analysis
```typescript
private async getMemoriesForReflection(agent_id: string): Promise<Memory[]> {
  const lastReflectionTime = await this.getLastReflectionTime(agent_id);
  const memories = await this.memoryManager.retrieveMemories({
    agent_id,
    since: lastReflectionTime,
    limit: 50,
    orderBy: 'importance_score DESC'
  });
  
  return memories;
}
```

#### 2. LLM-Based Insight Generation
```typescript
private async generateReflectionText(agent_id: string, memories: Memory[]): Promise<string> {
  const agent = await this.getAgentInfo(agent_id);
  const memoryTexts = memories.map(m => `- ${m.content} (importance: ${m.importance_score})`);
  
  const prompt = `You are ${agent.name}, reflecting on your recent experiences.
  
  Your personality: ${agent.constitution}
  Your goals: ${agent.primary_goal}
  
  Recent memories:
  ${memoryTexts.join('\n')}
  
  Generate a thoughtful reflection that synthesizes these experiences into a deeper insight.
  Focus on patterns, relationships, and realizations about your situation.`;
  
  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.7
  });
  
  return response.choices[0]?.message?.content?.trim() || '';
}
```

#### 3. Reflection Storage
```typescript
private async storeReflectionMemory(memory: Memory): Promise<void> {
  // Generate embedding for semantic search
  const embedding = await this.generateEmbedding(memory.content);
  
  // Store with high importance score
  await this.pool.query(
    `INSERT INTO agent_memories (
      agent_id, memory_type, content, importance_score, 
      emotional_relevance, tags, location, embedding
    ) VALUES ($1, 'reflection', $2, $3, $4, $5, 'internal', $6)`,
    [memory.agent_id, memory.content, 8, 7, 
     ['reflection', 'self_insight'], `[${embedding.join(',')}]`]
  );
}
```

### Reflection Examples

#### Input Memory Pattern
```
- "Player_John asked me about my blacksmithing work (importance: 8)"
- "I completed crafting a horseshoe for the town (importance: 7)"
- "Player_Sarah complimented my craftsmanship (importance: 8)"
- "I had a meaningful conversation about my flower garden (importance: 7)"
- "Multiple players have visited my shop today (importance: 6)"
```

#### Generated Reflection
```
"I've noticed that players are showing genuine interest in both my blacksmithing work and my personal interests like gardening - perhaps I'm becoming more integrated into the community than I initially thought."
```

## Metacognition System

### Performance Evaluation

#### Trigger Conditions
```typescript
// Metacognition triggered by various conditions
private async shouldTriggerMetacognition(agent_id: string): Promise<boolean> {
  const highImportanceMemories = await this.getHighImportanceMemories(agent_id);
  const timeSinceLastEvaluation = await this.getTimeSinceLastMetacognition(agent_id);
  const goalProgress = await this.evaluateGoalProgress(agent_id);
  
  return highImportanceMemories.length > 0 || 
         timeSinceLastEvaluation > 24 * 60 * 60 * 1000 || // 24 hours
         goalProgress < 0.3; // Low progress threshold
}
```

#### Performance Data Collection
```typescript
private async getPerformanceData(agent_id: string): Promise<PerformanceData> {
  const recentMemories = await this.getRecentMemories(agent_id, 72); // 3 days
  const recentPlans = await this.getRecentPlans(agent_id);
  const recentReflections = await this.getRecentReflections(agent_id);
  
  return {
    memories: recentMemories,
    plans: recentPlans,
    reflections: recentReflections,
    performance_indicators: {
      memory_count: recentMemories.length,
      completed_plans: recentPlans.filter(p => p.status === 'completed').length,
      failed_plans: recentPlans.filter(p => p.status === 'abandoned').length
    }
  };
}
```

### Strategic Evaluation Process

#### 1. Self-Assessment Generation
```typescript
private async generateMetacognition(agent: AgentData, performanceData: PerformanceData): Promise<MetacognitionResult> {
  const prompt = `You are ${agent.name}, performing a deep metacognitive evaluation.
  
  YOUR IDENTITY: ${agent.constitution}
  YOUR GOALS: 
  - Primary: ${agent.primary_goal}
  - Secondary: ${agent.secondary_goals.join(', ')}
  
  RECENT PERFORMANCE:
  - Memories: ${performanceData.memories.length}
  - Completed Plans: ${performanceData.performance_indicators.completed_plans}
  - Failed Plans: ${performanceData.performance_indicators.failed_plans}
  
  RECENT MEMORIES:
  ${performanceData.memories.map(m => `- ${m.content}`).join('\n')}
  
  METACOGNITIVE EVALUATION:
  1. Am I making progress toward my primary goal?
  2. Are my current strategies working effectively?
  3. Should I adjust my daily schedule to better achieve my goals?
  4. What patterns do I notice in my recent activities?
  
  Respond with a JSON object containing your evaluation and any schedule modifications.`;
  
  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.7
  });
  
  return this.parseMetacognitionResponse(response.choices[0]?.message?.content);
}
```

#### 2. Schedule Modification
```typescript
interface ScheduleModification {
  time: string;
  activity: string;
  description: string;
  reason: string;
  priority: number;
}

private async applyScheduleModifications(agent_id: string, modifications: ScheduleModification[]): Promise<void> {
  for (const modification of modifications) {
    // Store high-priority scheduled action
    await this.pool.query(
      `INSERT INTO agent_plans (agent_id, goal, plan_steps, status, priority, created_at)
       VALUES ($1, $2, $3, 'active', $4, NOW())`,
      [
        agent_id,
        `Metacognitive Schedule Modification: ${modification.reason}`,
        [JSON.stringify(modification)],
        modification.priority
      ]
    );
    
    console.log(`📅 [METACOGNITION] Schedule modification for ${agent_id}: ${modification.time} - ${modification.activity}`);
    console.log(`💭 [METACOGNITION] Reason: ${modification.reason}`);
  }
}
```

### Conversation-Driven Metacognition

#### Opportunity Detection
```typescript
// Example: Sarah's Seeds Scenario
private async handleConversationTrigger(agent_id: string, playerMessage: string): Promise<void> {
  const urgencyLevel = this.assessUrgency(playerMessage);
  
  if (urgencyLevel >= 6) {
    console.log(`🚨 HIGH URGENCY DETECTED: ${agent_id} - Level ${urgencyLevel}`);
    await this.triggerUrgentMetacognition(agent_id, urgencyLevel, playerMessage);
  }
}

private async triggerUrgentMetacognition(agent_id: string, urgencyLevel: number, playerMessage: string): Promise<void> {
  const agent = await this.getAgentInfo(agent_id);
  const performanceData = await this.getPerformanceData(agent_id);
  
  const metacognitionResult = await this.generateUrgentMetacognition(
    agent, performanceData, urgencyLevel, playerMessage
  );
  
  if (metacognitionResult && metacognitionResult.schedule_modifications.length > 0) {
    await this.applyScheduleModifications(agent_id, metacognitionResult.schedule_modifications);
  }
}
```

## Integration Points

### Memory System Integration

#### Trigger Monitoring
```typescript
// Memory storage triggers reflection/metacognition checks
if (memory.importance_score >= 8) {
  await this.triggerMetacognitionCheck(memory.agent_id, memory.importance_score);
}

if (cumulativeImportance >= 150) {
  await this.queueReflectionGeneration(memory.agent_id);
}
```

#### Context Retrieval
```typescript
// Reflections and metacognition use memory context
const contextualMemories = await this.memoryManager.getContextualMemories(
  agent_id, 
  'performance_evaluation', 
  15
);
```

### Planning System Integration

#### Schedule Modifications
```typescript
// Metacognitive insights can override planned schedules
const scheduledAction: ScheduledAction = {
  agentId: agent_id,
  time: modification.time,
  action: modification.activity,
  location: modification.location,
  priority: modification.priority
};

await this.planExecutor.addScheduledAction(scheduledAction);
```

### Conversation System Integration

#### Enhanced Responses
```typescript
// Reflections influence conversation quality
const conversationContext = await this.memoryManager.getContextualMemories(
  agent_id,
  playerMessage,
  15 // Include reflections in context
);

// Metacognitive insights affect agent responses
const recentMetacognition = await this.getRecentMetacognition(agent_id);
if (recentMetacognition) {
  prompt += `\nRecent self-reflection: ${recentMetacognition.self_awareness_notes}`;
}
```

## Performance Optimizations

### Cost Management

#### Reflection Limits
```typescript
// Cost optimization: Limited reflections per day
const MAX_REFLECTIONS_PER_DAY = 3;
const todayReflectionCount = await this.getTodayReflectionCount(agent_id);

if (todayReflectionCount >= MAX_REFLECTIONS_PER_DAY) {
  console.log(`⏰ [REFLECTION] Daily limit reached for ${agent_id}`);
  return;
}
```

#### Metacognition Limits
```typescript
// Cost optimization: Limited metacognitive evaluations
const MAX_METACOGNITION_PER_DAY = 1;
const todayMetacognitionCount = await this.getTodayMetacognitionCount(agent_id);

if (todayMetacognitionCount >= MAX_METACOGNITION_PER_DAY && urgencyLevel < 6) {
  console.log(`⏰ [METACOGNITION] Daily limit reached for ${agent_id}`);
  return;
}
```

### Queue Management

#### Background Processing
```typescript
// Reflection processor runs continuously
public async startProcessing(): Promise<void> {
  console.log('🔄 [REFLECTION] Starting reflection processor');
  
  this.isProcessing = true;
  while (this.isProcessing) {
    await this.processNextReflection();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Metacognition processor handles urgent evaluations
public async startProcessing(): Promise<void> {
  console.log('🧠 [METACOGNITION] Starting metacognition processor');
  
  this.isProcessing = true;
  while (this.isProcessing) {
    await this.processNextMetacognition();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
```

## Database Schema

### Storage Tables

#### Agent Reflections
```sql
CREATE TABLE agent_reflections (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    reflection TEXT NOT NULL,
    trigger_memories BIGINT[],
    insights TEXT[],
    behavioral_changes TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Agent Metacognition
```sql
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

#### Memory Integration
```sql
-- Reflections stored as special memory type
INSERT INTO agent_memories (
    agent_id, memory_type, content, importance_score, 
    emotional_relevance, tags, location, embedding
) VALUES (
    $1, 'reflection', $2, 8, 7, 
    ['reflection', 'self_insight'], 'internal', $3
);
```

## API Endpoints

### Reflection System
- **POST /reflection/trigger**: Manually trigger reflection
- **GET /reflection/queue-status**: Monitor processing queue
- **GET /reflection/history/{agentId}**: Get reflection history
- **GET /reflection/stats**: Overall reflection statistics

### Metacognition System
- **POST /metacognition/trigger**: Manually trigger metacognitive evaluation
- **GET /metacognition/queue-status**: Monitor metacognition queue
- **GET /metacognition/history/{agentId}**: Get metacognitive history
- **GET /metacognition/schedule-modifications/{agentId}**: Get schedule changes

### Testing Endpoints
- **POST /metacognition/conversation-trigger**: Test conversation-based triggers
- **POST /metacognition/sarah-seeds-example**: Test specific scenario

## Real-World Examples

### Sarah's Seeds Scenario

#### Input
```
Player tells Sarah: "I heard there are some really good seeds available at the mansion that could help with your salt-resistant crops!"
```

#### Metacognitive Process
1. **Urgency Assessment**: High importance due to goal relevance
2. **Performance Analysis**: Recent crop failures noted
3. **Opportunity Recognition**: Mansion seeds identified as solution
4. **Schedule Modification**: Visit mansion prioritized

#### Output
```json
{
  "performance_evaluation": "I've been struggling with salt-resistant crop development. A player mentioned excellent seeds at the mansion that could solve this problem.",
  "schedule_modifications": [
    {
      "time": "14:00",
      "activity": "travel",
      "description": "visit mansion to investigate seed varieties",
      "reason": "Player mentioned excellent seeds for salt-resistant crops",
      "priority": 9
    }
  ]
}
```

### Elara's Community Integration

#### Reflection Process
Input memories about player interactions lead to reflection:
```
"I've noticed that players are showing genuine interest in both my blacksmithing work and my personal interests like gardening - perhaps I'm becoming more integrated into the community than I initially thought."
```

#### Impact on Behavior
- **Conversation Quality**: More community-focused responses
- **Social Confidence**: Increased willingness to engage
- **Goal Adjustment**: Emphasis on community relationships

## Monitoring and Analytics

### Performance Metrics

#### Reflection Statistics
```typescript
interface ReflectionStats {
  total_reflections: number;
  reflections_per_day: number;
  average_importance: number;
  memory_to_reflection_ratio: number;
  processing_time: number;
}
```

#### Metacognition Statistics
```typescript
interface MetacognitionStats {
  total_evaluations: number;
  schedule_modifications: number;
  goal_modifications: number;
  success_rate: number;
  processing_time: number;
}
```

### Debug Logging

#### Reflection Logging
```typescript
console.log(`💭 [REFLECTION] Generated reflection for ${agent_id}`);
console.log(`📊 [REFLECTION] Trigger: ${cumulativeImportance} importance points`);
console.log(`💡 [REFLECTION] Insight: "${reflectionText.substring(0, 100)}..."`);
```

#### Metacognition Logging
```typescript
console.log(`🧠 [METACOGNITION] Processing evaluation for ${agent_id}`);
console.log(`📅 [METACOGNITION] Schedule modifications: ${modifications.length}`);
console.log(`💭 [METACOGNITION] Self-awareness: ${selfAwarenessNotes}`);
```

## Error Handling

### Graceful Degradation
```typescript
// Handle LLM failures gracefully
try {
  const reflection = await this.generateReflection(agent_id);
  await this.storeReflection(reflection);
} catch (error) {
  console.error(`❌ [REFLECTION] Failed for ${agent_id}:`, error);
  // Continue without reflection rather than crashing
}
```

### Validation
```typescript
// Validate metacognitive outputs
private validateMetacognitionResult(result: any): MetacognitionResult | null {
  if (!result.performance_evaluation || !result.schedule_modifications) {
    console.error('❌ [METACOGNITION] Invalid result format');
    return null;
  }
  
  if (!Array.isArray(result.schedule_modifications)) {
    console.error('❌ [METACOGNITION] Invalid schedule modifications');
    return null;
  }
  
  return result;
}
```

## Future Enhancements

### Advanced Cognitive Features

#### Emotional Reflection
- **Emotional Pattern Recognition**: Identify emotional trends
- **Mood-Based Insights**: Reflections influenced by emotional state
- **Emotional Regulation**: Metacognitive emotional management

#### Social Metacognition
- **Relationship Evaluation**: Assess social relationship progress
- **Social Strategy Adjustment**: Modify social behavior based on outcomes
- **Group Dynamics**: Consider community-wide social patterns

### Learning and Adaptation

#### Experience Learning
- **Outcome Tracking**: Monitor results of metacognitive changes
- **Strategy Refinement**: Improve metacognitive strategies over time
- **Pattern Recognition**: Identify successful cognitive patterns

#### Collaborative Cognition
- **Shared Insights**: Agents share reflections and strategies
- **Collective Intelligence**: Community-wide cognitive patterns
- **Cultural Learning**: Learn from community experiences

## Conclusion

The Reflection and Metacognition System represents the highest level of cognitive sophistication in Heartwood Valley's NPCs. By implementing research-based cognitive architectures, the system creates agents that can:

- **Form Deep Insights**: Generate meaningful reflections from experience patterns
- **Evaluate Performance**: Assess their own progress toward goals
- **Adapt Strategies**: Modify behavior based on self-evaluation
- **Respond to Opportunities**: Dynamically adjust schedules based on new information

This system transforms NPCs from simple rule-following entities into truly intelligent agents capable of growth, adaptation, and strategic thinking. The integration with memory, planning, and activity systems creates a cohesive cognitive architecture that enables emergent behaviors and meaningful player interactions.

The careful balance of research-based techniques with practical performance optimizations ensures that the system provides advanced AI capabilities while remaining cost-effective and scalable for a persistent multiplayer environment. 