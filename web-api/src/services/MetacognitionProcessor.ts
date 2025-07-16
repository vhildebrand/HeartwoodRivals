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
  location?: string; // Add location field
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

    // Process urgent queue immediately every 5 seconds
    setInterval(async () => {
      try {
        await this.processNextUrgentMetacognition();
      } catch (error) {
        console.error('❌ [METACOGNITION] Error in urgent processing loop:', error);
      }
    }, 5000);

    // Process regular metacognitive queue every 30 seconds
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
   * Process the next urgent metacognitive evaluation from the urgent queue
   */
  private async processNextUrgentMetacognition(): Promise<void> {
    try {
      const queuedItem = await this.redisClient.brPop('metacognition_urgent_queue', 0.1);
      if (!queuedItem) {
        return; // No items in urgent queue
      }

      const { agent_id, trigger_reason, urgency_level, urgency_reason, player_message, immediate } = JSON.parse(queuedItem.element);
      console.log(`🚨 [URGENT METACOGNITION] Processing urgent evaluation for ${agent_id} (urgency: ${urgency_level}, reason: ${urgency_reason})`);

      await this.evaluateUrgentSituation(agent_id, trigger_reason, urgency_level, urgency_reason, player_message);
    } catch (error) {
      console.error('❌ [METACOGNITION] Error processing urgent metacognitive evaluation:', error);
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
   * Evaluate urgent situation and generate immediate response
   */
  public async evaluateUrgentSituation(agent_id: string, trigger_reason: string, urgency_level: number, urgency_reason: string, player_message: string): Promise<void> {
    try {
      console.log(`🚨 [URGENT METACOGNITION] Evaluating urgent situation for ${agent_id} (urgency: ${urgency_level})`);

      // Get agent information
      const agentResult = await this.pool.query(
        'SELECT id, name, constitution, primary_goal, secondary_goals, schedule, current_plans FROM agents WHERE id = $1',
        [agent_id]
      );

      if (agentResult.rows.length === 0) {
        console.error(`❌ [URGENT METACOGNITION] Agent ${agent_id} not found`);
        return;
      }

      const agent = agentResult.rows[0];

      // Get recent performance data
      const performanceData = await this.getPerformanceData(agent_id);

      // Generate urgent metacognitive evaluation
      const metacognitionResult = await this.generateUrgentMetacognition(agent, performanceData, urgency_level, urgency_reason, player_message);

      if (metacognitionResult) {
        // Store metacognitive insights
        await this.storeMetacognition(metacognitionResult);

        // Apply schedule modifications with emergency priority
        if (metacognitionResult.schedule_modifications.length > 0) {
          await this.applyEmergencyScheduleModifications(agent_id, metacognitionResult.schedule_modifications);
        }

        console.log(`✅ [URGENT METACOGNITION] Generated urgent metacognitive response for ${agent.name} (urgency: ${urgency_level})`);
      }
    } catch (error) {
      console.error(`❌ [URGENT METACOGNITION] Error evaluating urgent situation for ${agent_id}:`, error);
    }
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

      // Parse and validate the response
      const metacognitionResult = this.parseMetacognitionResponse(response);
      
      if (metacognitionResult) {
        metacognitionResult.agent_id = agent.id;
        return metacognitionResult;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [METACOGNITION] Error generating metacognitive evaluation:', error);
      return null;
    }
  }

  /**
   * Generate urgent metacognitive evaluation using LLM
   */
  private async generateUrgentMetacognition(agent: any, performanceData: any, urgency_level: number, urgency_reason: string, player_message: string): Promise<MetacognitionResult | null> {
    try {
      const prompt = this.constructUrgentMetacognitionPrompt(agent, performanceData, urgency_level, urgency_reason, player_message);

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
        console.error('❌ [URGENT METACOGNITION] Empty response from OpenAI');
        return null;
      }

      const metacognitionResult = this.parseMetacognitionResponse(response);
      
      if (metacognitionResult) {
        metacognitionResult.agent_id = agent.id;
        return metacognitionResult;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [URGENT METACOGNITION] Error generating urgent metacognitive evaluation:', error);
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
   * Construct urgent metacognitive evaluation prompt
   */
  private constructUrgentMetacognitionPrompt(agent: any, performanceData: any, urgency_level: number, urgency_reason: string, player_message: string): string {
    const memoryTexts = performanceData.memories.map((m: any) => `- ${m.content}`).join('\n');
    const planTexts = performanceData.plans.map((p: any) => `- Goal: ${p.goal} (Status: ${p.status})`).join('\n');
    const reflectionTexts = performanceData.reflections.map((r: any) => `- ${r.content}`).join('\n');

    return `You are ${agent.name}, facing a HIGH PRIORITY SITUATION that requires immediate metacognitive evaluation and potential schedule changes.

YOUR IDENTITY:
${agent.constitution}

YOUR GOALS:
Primary Goal: ${agent.primary_goal}
Secondary Goals: ${agent.secondary_goals ? agent.secondary_goals.join(', ') : 'None'}

CURRENT SCHEDULE:
${JSON.stringify(agent.schedule, null, 2)}

🚨 HIGH PRIORITY SITUATION 🚨
- URGENCY LEVEL: ${urgency_level}/10
- REASON: ${urgency_reason}
- PLAYER MESSAGE: "${player_message}"

RECENT PERFORMANCE DATA:
=== RECENT MEMORIES ===
${memoryTexts}

=== RECENT PLANS ===
${planTexts}

=== RECENT REFLECTIONS ===
${reflectionTexts}

IMMEDIATE ACTION EVALUATION TASK:
This is a high priority situation requiring immediate attention. Based on your role, responsibilities, personality, and interests:

1. Does this situation require you to drop your current activities and respond immediately?
2. What specific actions should you take RIGHT NOW?
3. How should you modify your schedule to address this urgent situation?
4. What are the immediate next steps you need to take?

CRITICAL: If this situation is truly urgent/exciting and relevant to your role, interests, or desires, you MUST suggest immediate schedule modifications. Examples:
- A doctor hearing about a medical emergency should immediately go to help
- A fire chief hearing about a fire should immediately respond
- A police officer hearing about a crime should immediately investigate
- Someone hearing their favorite performer is nearby should immediately go see them
- Someone hearing an old friend is in town should immediately go visit them
- Someone hearing about a special opportunity should immediately pursue it

Focus on IMMEDIATE ACTION based on your professional duties AND personal interests/desires.

AVAILABLE ACTIVITIES:
- "emergency_response" - For medical emergencies (doctors, nurses, medical staff)
- "fire_response" - For fire emergencies (fire chief, firefighters)
- "police_response" - For criminal emergencies (police officers)
- "social" - For meeting friends, attending performances, social gatherings
- "visit" - For visiting specific people or places
- "patrol" - For general security/safety concerns
- "medical_work" - For medical situations at your workplace
- "entertainment" - For attending performances, shows, events
- "personal_time" - For pursuing personal interests and hobbies

Choose the appropriate activity based on your profession and the type of situation. Use "social", "visit", or "entertainment" for non-emergency situations you're excited about.

Respond in the following JSON format:
{
  "performance_evaluation": "Assessment of how this situation relates to your role, interests, and desires",
  "strategy_adjustments": ["Immediate strategy changes needed for this situation"],
  "goal_modifications": ["Any goal modifications needed"],
  "schedule_modifications": [
    {
      "time": "NOW",
      "activity": "appropriate_activity",
      "description": "specific immediate action to take",
      "reason": "urgent/exciting situation requiring immediate response",
      "priority": 10
    }
  ],
  "self_awareness_notes": "Recognition of the urgency/excitement and your response to it",
  "importance_score": 10
}

IMPORTANT: If this situation is urgent/exciting and relevant to your role OR personal interests, you MUST include schedule modifications with high priority (6-10) and immediate timing.`;
  }

  /**
   * Parse and validate metacognitive response
   */
  private parseMetacognitionResponse(response: string): MetacognitionResult | null {
    try {
      // Clean up the response by removing markdown code blocks
      let cleanResponse = response.trim();
      
      // Remove ```json and ``` markers if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '');
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      // Validate required fields
      if (!parsed.performance_evaluation || !parsed.strategy_adjustments || !parsed.schedule_modifications) {
        console.error('❌ [METACOGNITION] Invalid metacognitive response format - missing required fields');
        return null;
      }
      
      // Ensure schedule_modifications is an array
      if (!Array.isArray(parsed.schedule_modifications)) {
        console.error('❌ [METACOGNITION] Invalid schedule_modifications format - expected array');
        return null;
      }
      
      return {
        agent_id: '', // Will be set by caller
        performance_evaluation: parsed.performance_evaluation,
        strategy_adjustments: parsed.strategy_adjustments || [],
        goal_modifications: parsed.goal_modifications || [],
        schedule_modifications: parsed.schedule_modifications || [],
        self_awareness_notes: parsed.self_awareness_notes || '',
        importance_score: parsed.importance_score || 8
      };
      
    } catch (error) {
      console.error('❌ [METACOGNITION] Error parsing metacognitive response:', error);
      console.error('❌ [METACOGNITION] Raw response:', response);
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
   * Parse emergency location from description
   */
  private parseEmergencyLocation(description: string): string | null {
    const locationPatterns = [
      /at the (.+?)(?:\s|$)/i,
      /at (.+?)(?:\s|$)/i,
      /in the (.+?)(?:\s|$)/i,
      /in (.+?)(?:\s|$)/i,
      /near the (.+?)(?:\s|$)/i,
      /near (.+?)(?:\s|$)/i,
      /by the (.+?)(?:\s|$)/i,
      /by (.+?)(?:\s|$)/i
    ];

    for (const pattern of locationPatterns) {
      const match = description.match(pattern);
      if (match) {
        let locationName = match[1].trim();
        
        // Clean up common suffixes and convert to location ID format
        locationName = locationName.replace(/\s+/g, '_').toLowerCase();
        
        // Handle common location mappings
        const locationMappings: { [key: string]: string } = {
          'dj_stage': 'dj_stage',
          'dj': 'dj_stage',
          'stage': 'dj_stage',
          'hospital': 'hospital',
          'fire_station': 'fire_station',
          'police_station': 'police_station',
          'town_hall': 'town_hall',
          'school': 'school',
          'church': 'church',
          'tavern': 'tavern',
          'blacksmith': 'blacksmith_shop',
          'bakery': 'bakery',
          'lighthouse': 'lighthouse',
          'harbor': 'fishing_dock',
          'dock': 'fishing_dock',
          'market': 'farmers_market',
          'gym': 'gym',
          'library': 'library',
          'cafe': 'cafe',
          'beach': 'beach',
          'barn': 'barn',
          'windmill': 'windmill',
          'mansion': 'mansion'
        };
        
        return locationMappings[locationName] || locationName;
      }
    }
    
    return null;
  }

  /**
   * Apply emergency schedule modifications with highest priority
   */
  private async applyEmergencyScheduleModifications(agent_id: string, modifications: ScheduleModification[]): Promise<void> {
    try {
      console.log(`🚨 [EMERGENCY SCHEDULE] Applying ${modifications.length} emergency schedule modifications for ${agent_id}`);

      for (const modification of modifications) {
        console.log(`🚨 [EMERGENCY SCHEDULE] ${agent_id} - ${modification.time}: ${modification.activity} - ${modification.description}`);
        console.log(`🚨 [EMERGENCY REASON] ${modification.reason}`);

        // Parse location from description
        const emergencyLocation = this.parseEmergencyLocation(modification.description);
        if (emergencyLocation) {
          console.log(`🚨 [EMERGENCY LOCATION] Parsed location: ${emergencyLocation}`);
          modification.location = emergencyLocation;
        }

        // Create emergency plan with maximum priority
        const planData = {
          plan_date: `day_${new Date().getDate()}`,
          schedule: {
            [modification.time]: {
              activity: modification.activity,
              description: modification.description,
              location: modification.location // Include location in plan data
            }
          },
          reasoning: modification.reason,
          modification_type: 'emergency',
          urgency_level: 'maximum'
        };

        // Format as PostgreSQL array (array of strings)
        const planSteps = [JSON.stringify(planData)];

        await this.pool.query(
          `INSERT INTO agent_plans (
            agent_id, goal, plan_steps, status, priority, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            agent_id,
            `EMERGENCY: ${modification.description}`,
            planSteps, // Pass as array directly
            'active',
            Math.max(10, modification.priority) // Ensure at least priority 10 for emergencies
          ]
        );
      }

      console.log(`✅ [EMERGENCY SCHEDULE] Applied emergency schedule modifications for ${agent_id}`);
      
      // Trigger immediate schedule reload for the agent
      await this.triggerScheduleReload(agent_id);
    } catch (error) {
      console.error('❌ [EMERGENCY SCHEDULE] Error applying emergency schedule modifications:', error);
    }
  }

  /**
   * Trigger immediate schedule reload for an agent (notifies game server)
   */
  private async triggerScheduleReload(agent_id: string): Promise<void> {
    try {
      // Queue a schedule reload notification
      const reloadNotification = JSON.stringify({
        type: 'emergency_schedule_reload',
        agent_id,
        timestamp: Date.now()
      });

      await this.redisClient.lPush('schedule_reload_queue', reloadNotification);
      console.log(`📅 [SCHEDULE RELOAD] Queued emergency schedule reload for ${agent_id}`);
    } catch (error) {
      console.error('❌ [SCHEDULE RELOAD] Error triggering schedule reload:', error);
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