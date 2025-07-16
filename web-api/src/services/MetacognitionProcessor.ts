import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from './AgentMemoryManager';
import OpenAI from 'openai';

interface MetacognitionResult {
  agent_id: string;
  performance_evaluation: string;
  strategy_adjustments: string[];
  goal_modifications: string[];
  schedule_modifications: ScheduleModification[];
  self_awareness_notes: string;
  importance_score: number;
}

interface ScheduleModification {
  time: string;
  activity: string;
  description: string;
  reason: string;
  priority: number;
}

export class MetacognitionProcessor {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private memoryManager: AgentMemoryManager;
  private openai: OpenAI;
  private isProcessing: boolean = false;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.memoryManager = new AgentMemoryManager(pool, redisClient);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Start continuous metacognitive processing
   */
  public async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      console.log('🧠 [METACOGNITION] Already processing');
      return;
    }

    this.isProcessing = true;
    console.log('🧠 [METACOGNITION] Starting metacognitive processing');

    // Process metacognitive queue every 30 seconds
    setInterval(async () => {
      try {
        await this.processNextMetacognition();
      } catch (error) {
        console.error('❌ [METACOGNITION] Error in processing loop:', error);
      }
    }, 30000);
  }

  /**
   * Process the next metacognitive evaluation from the queue
   */
  private async processNextMetacognition(): Promise<void> {
    try {
      const queuedItem = await this.redisClient.brPop('metacognition_queue', 1);
      if (!queuedItem) {
        return; // No items in queue
      }

      const { agent_id, trigger_reason, importance_score } = JSON.parse(queuedItem.element);
      console.log(`🧠 [METACOGNITION] Processing metacognitive evaluation for ${agent_id} (trigger: ${trigger_reason}, importance: ${importance_score || 'N/A'})`);

      await this.evaluateAgentPerformance(agent_id, trigger_reason, importance_score);
    } catch (error) {
      console.error('❌ [METACOGNITION] Error processing metacognitive evaluation:', error);
    }
  }

  /**
   * Manually trigger metacognitive evaluation for an agent
   */
  public async triggerMetacognition(agent_id: string, trigger_reason: string = 'manual'): Promise<void> {
    const queueItem = JSON.stringify({
      agent_id,
      trigger_reason,
      timestamp: Date.now()
    });

    await this.redisClient.lPush('metacognition_queue', queueItem);
    console.log(`🧠 [METACOGNITION] Queued metacognitive evaluation for ${agent_id}`);
  }

  /**
   * Evaluate agent performance and generate metacognitive insights
   */
  public async evaluateAgentPerformance(agent_id: string, trigger_reason: string, importance_score?: number): Promise<void> {
    try {
      console.log(`🧠 [METACOGNITION] Evaluating performance for ${agent_id}`);

      // Get agent information
      const agentResult = await this.pool.query(
        'SELECT id, name, constitution, primary_goal, secondary_goals, schedule, current_plans FROM agents WHERE id = $1',
        [agent_id]
      );

      if (agentResult.rows.length === 0) {
        console.error(`❌ [METACOGNITION] Agent ${agent_id} not found`);
        return;
      }

      const agent = agentResult.rows[0];

      // Get recent performance data
      const performanceData = await this.getPerformanceData(agent_id);

      // Generate metacognitive evaluation
      const metacognitionResult = await this.generateMetacognition(agent, performanceData, trigger_reason);

      if (metacognitionResult) {
        // Store metacognitive insights
        await this.storeMetacognition(metacognitionResult);

        // Apply schedule modifications if any
        if (metacognitionResult.schedule_modifications.length > 0) {
          await this.applyScheduleModifications(agent_id, metacognitionResult.schedule_modifications);
        }

        // Note: Metacognitive insights are stored in agent_metacognition table, not as memories
        // This avoids cluttering the memory stream with artificial self-evaluation memories

        console.log(`✅ [METACOGNITION] Generated metacognitive insights for ${agent.name} (trigger: ${trigger_reason}, importance: ${importance_score || 'N/A'})`);
      }
    } catch (error) {
      console.error(`❌ [METACOGNITION] Error evaluating performance for ${agent_id}:`, error);
    }
  }

  /**
   * Get performance data for an agent
   */
  private async getPerformanceData(agent_id: string): Promise<any> {
    // Get recent memories to understand agent's activities
    const recentMemories = await this.memoryManager.retrieveMemories({
      agent_id,
      limit: 20,
      memory_types: ['observation', 'reflection', 'plan'],
      recent_hours: 72 // Last 3 days
    });

    // Get recent plans and their status
    const recentPlans = await this.pool.query(
      `SELECT id, goal, plan_steps, current_step, status, priority, created_at, updated_at
       FROM agent_plans
       WHERE agent_id = $1
       AND created_at >= NOW() - INTERVAL '72 hours'
       ORDER BY created_at DESC`,
      [agent_id]
    );

    // Get recent reflections
    const recentReflections = await this.pool.query(
      `SELECT id, content, importance_score, timestamp
       FROM agent_memories
       WHERE agent_id = $1 AND memory_type = 'reflection'
       AND timestamp >= NOW() - INTERVAL '72 hours'
       ORDER BY timestamp DESC`,
      [agent_id]
    );

    return {
      memories: recentMemories,
      plans: recentPlans.rows,
      reflections: recentReflections.rows,
      performance_indicators: {
        memory_count: recentMemories.length,
        plan_count: recentPlans.rows.length,
        reflection_count: recentReflections.rows.length,
        completed_plans: recentPlans.rows.filter(p => p.status === 'completed').length,
        failed_plans: recentPlans.rows.filter(p => p.status === 'abandoned').length
      }
    };
  }

  /**
   * Generate metacognitive evaluation using LLM
   */
  private async generateMetacognition(agent: any, performanceData: any, trigger_reason: string): Promise<MetacognitionResult | null> {
    try {
      const prompt = this.constructMetacognitionPrompt(agent, performanceData, trigger_reason);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        console.error('❌ [METACOGNITION] Empty response from OpenAI');
        return null;
      }

      return this.parseMetacognitionResponse(agent.id, response);
    } catch (error) {
      console.error('❌ [METACOGNITION] Error generating metacognitive evaluation:', error);
      return null;
    }
  }

  /**
   * Construct metacognitive evaluation prompt
   */
  private constructMetacognitionPrompt(agent: any, performanceData: any, trigger_reason: string): string {
    const memoryTexts = performanceData.memories.map((m: any) => `- ${m.content}`).join('\n');
    const planTexts = performanceData.plans.map((p: any) => `- Goal: ${p.goal} (Status: ${p.status})`).join('\n');
    const reflectionTexts = performanceData.reflections.map((r: any) => `- ${r.content}`).join('\n');

    return `You are ${agent.name}, performing a deep metacognitive evaluation of your recent performance and behavior. 

YOUR IDENTITY:
${agent.constitution}

YOUR GOALS:
Primary Goal: ${agent.primary_goal}
Secondary Goals: ${agent.secondary_goals ? agent.secondary_goals.join(', ') : 'None'}

CURRENT SCHEDULE:
${JSON.stringify(agent.schedule, null, 2)}

TRIGGER REASON: ${trigger_reason}

RECENT PERFORMANCE DATA:
=== RECENT MEMORIES ===
${memoryTexts}

=== RECENT PLANS ===
${planTexts}

=== RECENT REFLECTIONS ===
${reflectionTexts}

PERFORMANCE INDICATORS:
- Total memories: ${performanceData.performance_indicators.memory_count}
- Total plans: ${performanceData.performance_indicators.plan_count}
- Completed plans: ${performanceData.performance_indicators.completed_plans}
- Failed plans: ${performanceData.performance_indicators.failed_plans}
- Reflections: ${performanceData.performance_indicators.reflection_count}

METACOGNITIVE EVALUATION TASK:
Evaluate your performance over the last 3 days. Ask yourself:
1. Am I making progress toward my primary goal?
2. Are my current strategies working effectively?
3. Should I adjust my daily schedule to better achieve my goals?
4. What patterns do I notice in my recent activities and interactions?
5. Are there opportunities I'm missing that I should pursue?

If you identify areas for improvement, suggest specific schedule modifications that would help you achieve your goals better.

IMPORTANT: Only suggest schedule modifications if you have compelling evidence from your recent memories and experiences. Base suggestions strictly on what you've actually observed or learned.

Respond in the following JSON format:
{
  "performance_evaluation": "Detailed self-assessment of your recent performance",
  "strategy_adjustments": ["Specific strategy changes you should make"],
  "goal_modifications": ["Any modifications to your goals based on new insights"],
  "schedule_modifications": [
    {
      "time": "HH:MM",
      "activity": "activity_type",
      "description": "specific task description",
      "reason": "compelling reason based on recent experiences",
      "priority": 1-10
    }
  ],
  "self_awareness_notes": "Key insights about your patterns and behaviors",
  "importance_score": 8
}

Only suggest schedule modifications if you have compelling reasons based on your recent experiences. Each modification should directly support your goals.

Respond with ONLY the JSON object, no additional text.`;
  }

  /**
   * Parse metacognitive response from LLM
   */
  private parseMetacognitionResponse(agent_id: string, response: string): MetacognitionResult | null {
    try {
      const parsed = JSON.parse(response);

      return {
        agent_id,
        performance_evaluation: parsed.performance_evaluation || '',
        strategy_adjustments: parsed.strategy_adjustments || [],
        goal_modifications: parsed.goal_modifications || [],
        schedule_modifications: parsed.schedule_modifications || [],
        self_awareness_notes: parsed.self_awareness_notes || '',
        importance_score: parsed.importance_score || 7
      };
    } catch (error) {
      console.error('❌ [METACOGNITION] Error parsing metacognitive response:', error);
      return null;
    }
  }

  /**
   * Store metacognitive insights in database
   */
  private async storeMetacognition(result: MetacognitionResult): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO agent_metacognition (
          agent_id, performance_evaluation, strategy_adjustments, goal_modifications, self_awareness_notes
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          result.agent_id,
          result.performance_evaluation,
          result.strategy_adjustments,
          result.goal_modifications,
          result.self_awareness_notes
        ]
      );

      console.log(`✅ [METACOGNITION] Stored metacognitive insights for ${result.agent_id}`);
    } catch (error) {
      console.error('❌ [METACOGNITION] Error storing metacognitive insights:', error);
    }
  }

  /**
   * Apply schedule modifications to agent
   */
  private async applyScheduleModifications(agent_id: string, modifications: ScheduleModification[]): Promise<void> {
    try {
      console.log(`🔄 [SCHEDULE] Applying ${modifications.length} schedule modifications for ${agent_id}`);

      for (const modification of modifications) {
        console.log(`📅 [SCHEDULE] ${agent_id} - ${modification.time}: ${modification.activity} - ${modification.description}`);
        console.log(`💭 [SCHEDULE] Reason: ${modification.reason}`);

        // Create a dynamic plan that overrides the schedule
        const planData = {
          plan_date: `day_${new Date().getDate()}`,
          schedule: {
            [modification.time]: {
              activity: modification.activity,
              description: modification.description
            }
          },
          reasoning: modification.reason,
          modification_type: 'metacognitive'
        };

        // Format as PostgreSQL array (array of strings)
        const planSteps = [JSON.stringify(planData)];

        await this.pool.query(
          `INSERT INTO agent_plans (
            agent_id, goal, plan_steps, status, priority, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            agent_id,
            `Metacognitive schedule modification: ${modification.description}`,
            planSteps, // Pass as array directly
            'active',
            modification.priority
          ]
        );
      }

      console.log(`✅ [SCHEDULE] Applied schedule modifications for ${agent_id}`);
    } catch (error) {
      console.error('❌ [SCHEDULE] Error applying schedule modifications:', error);
    }
  }

  /**
   * Store metacognitive insight as agent memory - REMOVED
   * This was creating artificial memories that cluttered the memory stream
   * Metacognitive insights are now stored only in the agent_metacognition table
   */
  // Method removed to prevent automatic memory generation

  /**
   * Check if agent needs metacognitive evaluation
   * LIMITED TO 1 PER DAY to optimize API costs
   */
  public async checkMetacognitionTrigger(agent_id: string): Promise<void> {
    try {
      // Check daily metacognition count first (cost optimization)
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const todayMetacognitionResult = await this.pool.query(
        `SELECT COUNT(*) as metacognition_count
         FROM agent_metacognition 
         WHERE agent_id = $1 
         AND created_at >= $2`,
        [agent_id, todayStart]
      );
      
      const todayMetacognitionCount = parseInt(todayMetacognitionResult.rows[0]?.metacognition_count || '0');
      const MAX_METACOGNITION_PER_DAY = 1;
      
      if (todayMetacognitionCount >= MAX_METACOGNITION_PER_DAY) {
        console.log(`⏰ [METACOGNITION] ${agent_id} - Daily metacognition limit reached (${todayMetacognitionCount}/${MAX_METACOGNITION_PER_DAY}), skipping scheduled check`);
        return; // Skip metacognition to save API costs
      }

      // Get time since last metacognitive evaluation
      const lastMetacognitionResult = await this.pool.query(
        'SELECT MAX(created_at) as last_metacognition FROM agent_metacognition WHERE agent_id = $1',
        [agent_id]
      );

      const lastMetacognition = lastMetacognitionResult.rows[0]?.last_metacognition;
      const now = new Date();
      const timeSinceLastMetacognition = lastMetacognition ? 
        (now.getTime() - new Date(lastMetacognition).getTime()) / (1000 * 60 * 60) : 
        Infinity;

      // Trigger metacognition if:
      // 1. No previous metacognition OR
      // 2. More than 24 hours since last metacognition OR
      // 3. Agent has failed multiple plans recently
      const shouldTrigger = timeSinceLastMetacognition > 24 || 
                           timeSinceLastMetacognition === Infinity ||
                           await this.hasRecentFailures(agent_id);

      if (shouldTrigger) {
        await this.triggerMetacognition(agent_id, 'performance_check');
      }
    } catch (error) {
      console.error(`❌ [METACOGNITION] Error checking metacognition trigger for ${agent_id}:`, error);
    }
  }

  /**
   * Check if agent has recent failures that should trigger metacognition
   */
  private async hasRecentFailures(agent_id: string): Promise<boolean> {
    const failedPlans = await this.pool.query(
      `SELECT COUNT(*) as failed_count
       FROM agent_plans
       WHERE agent_id = $1 
       AND status = 'abandoned'
       AND updated_at >= NOW() - INTERVAL '48 hours'`,
      [agent_id]
    );

    return parseInt(failedPlans.rows[0]?.failed_count || '0') >= 2;
  }

  /**
   * Get metacognitive queue status
   */
  public async getQueueStatus(): Promise<any> {
    try {
      const queueLength = await this.redisClient.lLen('metacognition_queue');
      
      return {
        queue_length: queueLength,
        is_processing: this.isProcessing
      };
    } catch (error) {
      console.error('❌ [METACOGNITION] Error getting queue status:', error);
      return { queue_length: 0, is_processing: false };
    }
  }
} 