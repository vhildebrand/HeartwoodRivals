# Planning System Documentation

## Overview

The Planning System is a sophisticated AI-driven framework that generates and manages daily plans for NPCs in Heartwood Valley. It combines LLM-based planning with practical schedule execution to create believable, goal-oriented NPC behavior that adapts to changing circumstances and player interactions.

## Architecture

### Core Components

#### 1. PlanningSystem (`game-server/src/systems/PlanningSystem.ts`)
- **Purpose**: Generates LLM-based daily plans for agents
- **Features**:
  - Daily plan generation using GPT-4o-mini
  - Context-aware planning with agent memory
  - Goal-oriented schedule creation
  - Plan storage and retrieval
  - Integration with agent constitution and personality

#### 2. PlanExecutor (`game-server/src/systems/PlanExecutor.ts`)
- **Purpose**: Executes scheduled actions at correct times
- **Features**:
  - Time-based action triggering
  - Activity system integration
  - Emergency action handling
  - Schedule conflict resolution
  - Action result tracking

#### 3. GameTime (`game-server/src/systems/GameTime.ts`)
- **Purpose**: Manages accelerated game time
- **Features**:
  - Time acceleration (30x real-time)
  - Day/night cycle simulation
  - Event scheduling
  - Time-based triggers

## Planning Process

### Daily Plan Generation

#### 1. Planning Context Assembly
```typescript
interface PlanningContext {
  agent: AgentData;
  current_time: string;
  current_day: number;
  recent_memories: Memory[];
  goals: string[];
  personality: string[];
  likes: string[];
  dislikes: string[];
  background: string;
  schedule_template: any;
}
```

#### 2. LLM Prompt Construction
The system creates detailed prompts that include:
- **Agent Constitution**: Core personality and behavioral patterns
- **Current Situation**: Time, location, energy, mood
- **Goals**: Primary and secondary objectives
- **Recent Memories**: Contextual information from memory system
- **Schedule Template**: Existing schedule as reference

#### 3. Plan Generation
```typescript
async generateDailyPlan(agent: SpawnedAgent): Promise<GeneratedPlan | null> {
  const context = await this.getPlanningContext(agent);
  const prompt = this.constructPlanningPrompt(context);
  const planResponse = await this.callLLMForPlanning(prompt);
  const generatedPlan = this.parsePlanResponse(agent.data.id, planResponse);
  
  if (generatedPlan) {
    await this.storeDailyPlan(generatedPlan);
    await this.storePlanMemory(agent.data.id, generatedPlan);
    return generatedPlan;
  }
  
  return null;
}
```

### Generated Plan Structure

#### Plan Format
```typescript
interface GeneratedPlan {
  agent_id: string;
  plan_date: string;
  daily_goal: string;
  schedule: { [time: string]: ScheduleEntry };
  reasoning: string;
  priority: number;
  created_at: Date;
}

interface ScheduleEntry {
  activity: string;
  description: string;
}
```

#### Example Generated Plan
```json
{
  "agent_id": "elara_blacksmith",
  "plan_date": "day_3",
  "daily_goal": "Focus on completing the custom horseshoe order while maintaining my flower garden",
  "schedule": {
    "6:00": {
      "activity": "wake_up",
      "description": "wake up and tend to morning flowers"
    },
    "8:00": {
      "activity": "smithing",
      "description": "work on the custom horseshoe order"
    },
    "12:00": {
      "activity": "lunch",
      "description": "lunch break and check on garden"
    },
    "14:00": {
      "activity": "smithing",
      "description": "continue horseshoe work and prepare for evening"
    },
    "18:00": {
      "activity": "dinner",
      "description": "evening meal and personal time"
    },
    "20:00": {
      "activity": "personal_time",
      "description": "tend to evening garden and relax"
    }
  },
  "reasoning": "Today I want to focus on the custom horseshoe order while ensuring I maintain my flower garden which brings me peace",
  "priority": 7
}
```

## Plan Execution

### Schedule Processing

#### 1. Action Triggering
```typescript
public async processScheduledActions(agents: Map<string, SpawnedAgent>): Promise<void> {
  for (const [agentId, actions] of this.scheduledActions) {
    const agent = agents.get(agentId);
    if (!agent) continue;
    
    const actionsToExecute = actions.filter(action => 
      this.gameTime.isTime(action.time) && 
      !this.wasActionExecutedToday(agentId, action)
    );
    
    if (actionsToExecute.length > 0) {
      const actionToExecute = actionsToExecute[0];
      await this.executeAction(agent, actionToExecute);
    }
  }
}
```

#### 2. Activity System Integration
```typescript
public async executeAction(agent: SpawnedAgent, action: ScheduledAction): Promise<ActionResult> {
  const activityResult = agent.activityManager.handleScheduledActivity(action.action, action.time);
  
  if (activityResult.success) {
    this.recordActionExecution(agent.data.id, action);
    return { success: true, message: `Scheduled activity started: ${action.action}` };
  }
  
  return activityResult;
}
```

### Emergency Actions

#### High-Priority Action Processing
```typescript
public async executeEmergencyAction(agent: SpawnedAgent, action: ScheduledAction): Promise<ActionResult> {
  // Force interruption of current activity
  if (agent.activityManager.getCurrentActivity()) {
    agent.activityManager.completeCurrentActivity();
  }
  
  // Execute with emergency parameters
  const activityResult = agent.activityManager.requestActivity({
    activityName: action.action,
    priority: action.priority,
    interruptCurrent: true,
    parameters: { 
      emergency: true,
      emergencyLocation: action.location
    }
  });
  
  return activityResult;
}
```

## Plan Storage and Retrieval

### Database Integration

#### Plan Storage
```sql
-- Store plans in agent_plans table
INSERT INTO agent_plans (agent_id, goal, plan_steps, status, priority, created_at) 
VALUES ($1, $2, $3, $4, $5, $6)
```

#### Plan Retrieval
```typescript
async getActiveDailyPlan(agentId: string): Promise<GeneratedPlan | null> {
  const currentDay = this.gameTime.getCurrentDay();
  
  const result = await this.pool.query(
    `SELECT agent_id, goal as daily_goal, plan_steps, priority, created_at
     FROM agent_plans 
     WHERE agent_id = $1 
     AND plan_steps::text LIKE '%day_${currentDay}%'
     AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [agentId]
  );
  
  // Parse and return plan
}
```

### Memory Integration

#### Plan Memory Storage
```typescript
private async storePlanMemory(agent_id: string, plan: GeneratedPlan): Promise<void> {
  const memoryContent = `I planned my day: ${plan.daily_goal}. My schedule includes: ${this.summarizeSchedule(plan.schedule)}`;
  
  await this.memoryManager.storeMemory({
    agent_id,
    memory_type: 'plan',
    content: memoryContent,
    importance_score: 6,
    emotional_relevance: 5,
    tags: ['planning', 'daily_goal', 'schedule'],
    related_agents: [],
    related_players: [],
    location: 'internal'
  });
}
```

## Context-Aware Planning

### Memory Integration

#### Recent Memory Analysis
```typescript
private async getRecentMemories(agent_id: string): Promise<Memory[]> {
  return await this.memoryManager.retrieveMemories({
    agent_id,
    limit: 10,
    recent_hours: 24,
    memory_types: ['observation', 'reflection']
  });
}
```

#### Memory-Informed Planning
The planning system uses recent memories to:
- **Adapt to Recent Events**: Plans consider what has happened recently
- **Account for Player Interactions**: Plans reflect recent player conversations
- **Incorporate Reflections**: Plans use agent insights and reflections
- **Consider Relationships**: Plans account for social dynamics

### Goal-Oriented Planning

#### Goal Integration
```typescript
private constructPlanningPrompt(context: PlanningContext): string {
  const goals = [context.agent.primary_goal, ...context.agent.secondary_goals];
  
  return `${context.agent.constitution}

GOALS:
- Primary goal: ${goals[0]}
- Secondary goals: ${goals.slice(1).join(', ')}

TASK: Generate a detailed daily plan that reflects your character and advances your goals.
Base your activities on your typical routine but adapt based on recent experiences.`;
}
```

## Performance Optimizations

### LLM Cost Management

#### Plan Caching
- **Daily Plans**: Cache generated plans to avoid regeneration
- **Template Reuse**: Use existing plans as templates
- **Conditional Generation**: Only generate new plans when needed

#### Efficient API Usage
```typescript
private async callLLMForPlanning(prompt: string): Promise<string> {
  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',  // Cost-effective model
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,       // Limit response length
    temperature: 0.7,      // Balanced creativity
  });
  
  return response.choices[0]?.message?.content?.trim() || '';
}
```

### Database Performance

#### Efficient Queries
```sql
-- Optimized plan retrieval with indexes
CREATE INDEX idx_agent_plans_agent_status ON agent_plans(agent_id, status);
CREATE INDEX idx_agent_plans_date ON agent_plans(created_at);
```

#### Transaction Management
```typescript
private async storeDailyPlan(plan: GeneratedPlan): Promise<void> {
  const client = await this.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Mark existing plans as abandoned
    await client.query(
      `UPDATE agent_plans 
       SET status = 'abandoned' 
       WHERE agent_id = $1 AND status = 'active'`,
      [plan.agent_id]
    );
    
    // Store new plan
    await client.query(
      `INSERT INTO agent_plans (agent_id, goal, plan_steps, status, priority) 
       VALUES ($1, $2, $3, $4, $5)`,
      [plan.agent_id, plan.daily_goal, [JSON.stringify(plan)], 'active', plan.priority]
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Integration Points

### Activity System Integration

#### Activity Resolution
```typescript
// Plans specify activities that are resolved by the Activity System
const activityResult = agent.activityManager.handleScheduledActivity(
  action.action,    // Activity name (e.g., "smithing")
  action.time       // Scheduled time
);
```

### Memory System Integration

#### Memory-Informed Planning
- **Context Retrieval**: Recent memories inform planning decisions
- **Plan Storage**: Generated plans are stored as memories
- **Reflection Integration**: Reflections influence future planning

### Game Server Integration

#### Real-time Execution
```typescript
// Game server calls plan executor every frame
private updateAgentSystems(deltaTime: number) {
  this.planExecutor.processScheduledActions(this.agents);
}
```

## Error Handling

### Planning Failures

#### LLM Failures
```typescript
private async handlePlanningFailure(agent: SpawnedAgent, error: Error): Promise<void> {
  console.error(`Planning failed for ${agent.data.name}:`, error);
  
  // Fall back to default schedule
  const defaultPlan = this.createDefaultPlan(agent);
  await this.storeDailyPlan(defaultPlan);
}
```

#### Invalid Plan Responses
```typescript
private parsePlanResponse(agentId: string, response: string): GeneratedPlan | null {
  try {
    const parsed = JSON.parse(response);
    
    // Validate required fields
    if (!parsed.daily_goal || !parsed.schedule) {
      throw new Error('Invalid plan format');
    }
    
    return this.validateAndNormalizePlan(parsed);
  } catch (error) {
    console.error('Plan parsing failed:', error);
    return null;
  }
}
```

### Execution Failures

#### Action Failures
```typescript
private async handleActionFailure(agent: SpawnedAgent, action: ScheduledAction, error: Error): Promise<void> {
  console.error(`Action failed for ${agent.data.name}:`, error);
  
  // Try fallback action
  const fallbackAction = this.createFallbackAction(action);
  await this.executeAction(agent, fallbackAction);
}
```

## Monitoring and Analytics

### Planning Metrics

#### Success Rates
```typescript
interface PlanningMetrics {
  plansGenerated: number;
  plansFailed: number;
  averageGenerationTime: number;
  llmApiCalls: number;
  successRate: number;
}
```

#### Agent Performance
```typescript
private async trackAgentPlanningPerformance(agentId: string): Promise<AgentPlanningStats> {
  const stats = await this.pool.query(
    `SELECT COUNT(*) as total_plans,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_plans,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
     FROM agent_plans 
     WHERE agent_id = $1 
     AND created_at >= NOW() - INTERVAL '7 days'`,
    [agentId]
  );
  
  return this.formatPlanningStats(stats.rows[0]);
}
```

### Logging and Debugging

#### Plan Generation Logging
```typescript
console.log(`📋 [PLANNING] Generated daily plan for ${agent.data.name}: ${plan.daily_goal}`);
console.log(`📋 [PLANNING] Schedule:`);
Object.entries(plan.schedule).forEach(([time, activity]) => {
  console.log(`     ${time}: ${activity.activity} - ${activity.description}`);
});
```

## API Endpoints

### Planning Management
- **POST /npc/generate-plan**: Manually trigger plan generation
- **GET /npc/list**: Get all NPCs with current activities
- **GET /planning/active-plans**: Get all active plans
- **GET /planning/agent/{agentId}/plan**: Get specific agent's plan

### Monitoring
- **GET /planning/stats**: Overall planning system statistics
- **GET /planning/metrics**: Performance metrics
- **GET /planning/failures**: Recent planning failures

## Configuration

### Planning Settings
```typescript
interface PlanningConfig {
  maxPlanningAttempts: number;
  planCacheTimeout: number;
  llmModel: string;
  maxTokens: number;
  temperature: number;
  planValidationTimeout: number;
}
```

### Time Management
```typescript
interface TimeConfig {
  gameSpeedMultiplier: number;
  dayDurationMs: number;
  planningInterval: number;
  emergencyActionTimeout: number;
}
```

## Future Enhancements

### Advanced Planning Features

#### Multi-Day Planning
- **Long-term Goals**: Plans that span multiple days
- **Seasonal Planning**: Adapt plans to seasonal changes
- **Event Planning**: Special planning for town events

#### Collaborative Planning
- **Group Activities**: Plans that coordinate multiple agents
- **Resource Sharing**: Plans that consider shared resources
- **Social Events**: Plans that organize social gatherings

### AI Improvements

#### Learning from Experience
- **Outcome Tracking**: Track success/failure of planned activities
- **Adaptive Planning**: Adjust planning based on outcomes
- **Preference Learning**: Learn agent preferences over time

#### Enhanced Context
- **Environmental Factors**: Consider weather, season, events
- **Social Context**: Account for relationships and social dynamics
- **Economic Factors**: Consider resource availability

### Performance Optimizations

#### Caching Strategies
- **Plan Templates**: Cache common plan patterns
- **Partial Plans**: Reuse parts of successful plans
- **Conditional Generation**: Only generate when necessary

#### Batch Processing
- **Multi-Agent Planning**: Plan for multiple agents simultaneously
- **Parallel Processing**: Parallelize plan generation
- **Queue Management**: Efficient planning queue management

## Conclusion

The Planning System provides the cognitive foundation for autonomous NPC behavior in Heartwood Valley. By combining LLM-based intelligence with practical execution systems, it creates NPCs that can generate meaningful, goal-oriented plans that adapt to their environment and experiences.

The system's integration with the memory, activity, and coordination systems ensures that planning is contextual and actionable, while performance optimizations keep LLM costs manageable. The result is a planning system that creates believable, adaptive NPCs that contribute to the living world of Heartwood Valley.

Future enhancements will focus on more sophisticated planning capabilities, learning from experience, and better integration with the social and economic systems of the game world. 