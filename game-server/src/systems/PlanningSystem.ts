/**
 * Planning System
 * Handles LLM-based daily plan generation for agents
 * Based on the Generative Agents research paper approach
 */

import { Pool } from 'pg';
import { createClient } from 'redis';
import { SpawnedAgent } from './AgentSpawner';
import { GameTime } from './GameTime';

// Type-only import for OpenAI to avoid runtime dependency in game-server
interface OpenAICompletion {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface OpenAIClient {
  chat: {
    completions: {
      create(options: any): Promise<any>;
    };
  };
}

export interface GeneratedPlan {
  agent_id: string;
  plan_date: string;
  daily_goal: string;
  schedule: { [time: string]: string };
  reasoning: string;
  priority: number;
  created_at: Date;
}

export interface PlanningContext {
  agent: SpawnedAgent;
  current_time: string;
  current_day: number;
  recent_memories: any[];
  constitution: string;
  current_plans: string[];
  goals: string[];
}

export class PlanningSystem {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private openai: OpenAIClient;
  private gameTime: GameTime;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    this.gameTime = GameTime.getInstance();
    
    // Initialize OpenAI client
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('❌ [PLANNING] OPENAI_API_KEY not found in environment variables');
      throw new Error('OPENAI_API_KEY is required for planning system');
    }
    
    this.openai = {
      chat: {
        completions: {
          create: async (options: any) => {
            try {
              console.log('🤖 [PLANNING] Making OpenAI API call for plan generation...');
              
              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiApiKey}`
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: options.messages,
                  temperature: 0.7,
                  max_tokens: 1500
                })
              });
              
              if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
              }
              
              const result = await response.json();
              console.log('✅ [PLANNING] OpenAI API call successful');
              return result;
              
            } catch (error) {
              console.error('❌ [PLANNING] OpenAI API call failed:', error);
              // Fallback to mock response
                              return {
                  choices: [
                    {
                      message: {
                        content: JSON.stringify({
                          daily_goal: "Continue daily routine and serve the community",
                          schedule: {
                            "6:00": {
                              "activity": "wake_up",
                              "description": "wake up and morning routine"
                            },
                            "7:00": {
                              "activity": "work",
                              "description": "equipment check and preparation"
                            },
                            "8:00": {
                              "activity": "patrol",
                              "description": "begin morning patrol"
                            },
                            "9:00": {
                              "activity": "patrol",
                              "description": "continue patrol and community check"
                            },
                            "10:00": {
                              "activity": "patrol",
                              "description": "patrol and investigate any issues"
                            },
                            "11:00": {
                              "activity": "administration",
                              "description": "administrative work and reports"
                            },
                            "12:00": {
                              "activity": "lunch",
                              "description": "lunch break"
                            },
                            "13:00": {
                              "activity": "patrol",
                              "description": "afternoon patrol"
                            },
                            "14:00": {
                              "activity": "social",
                              "description": "community engagement and problem solving"
                            },
                            "15:00": {
                              "activity": "work",
                              "description": "paperwork and incident reports"
                            },
                            "16:00": {
                              "activity": "meetings",
                              "description": "coordinate with other departments"
                            },
                            "17:00": {
                              "activity": "work",
                              "description": "end-of-shift duties"
                            },
                            "18:00": {
                              "activity": "dinner",
                              "description": "dinner"
                            },
                            "19:00": {
                              "activity": "personal_time",
                              "description": "personal time and community engagement"
                            },
                            "20:00": {
                              "activity": "social",
                              "description": "evening social time"
                            },
                            "21:00": {
                              "activity": "relaxation",
                              "description": "relax and prepare for tomorrow"
                            },
                            "22:00": {
                              "activity": "prepare_for_bed",
                              "description": "prepare for bed"
                            }
                          },
                          reasoning: "Maintaining regular patrol schedule while engaging with community and handling administrative duties",
                          priority: 7
                        })
                      }
                    }
                  ]
                };
            }
          }
        }
      }
    };
  }

  /**
   * Generate a daily plan for an agent using LLM
   */
  async generateDailyPlan(agent: SpawnedAgent): Promise<GeneratedPlan | null> {
    try {
      console.log(`📋 [PLANNING] Generating daily plan for ${agent.data.name}`);
      
      // Get planning context
      const context = await this.getPlanningContext(agent);
      
      // Construct planning prompt
      const prompt = this.constructPlanningPrompt(context);
      
      // Call LLM to generate plan
      const planResponse = await this.callLLMForPlanning(prompt);
      
      // Parse and validate the response
      const generatedPlan = this.parsePlanResponse(agent.data.id, planResponse);
      
      if (generatedPlan) {
        // Store the plan in the database
        await this.storeDailyPlan(generatedPlan);
        
        // Store plan as agent memory
        await this.storePlanMemory(agent.data.id, generatedPlan);
        
        console.log(`✅ [PLANNING] Generated daily plan for ${agent.data.name}: ${generatedPlan.daily_goal}`);
        console.log(`📋 [PLANNING] Full plan for ${agent.data.name}:`);
        console.log(`   🎯 Goal: ${generatedPlan.daily_goal}`);
        console.log(`   📅 Schedule:`);
        Object.entries(generatedPlan.schedule).forEach(([time, activityData]) => {
          if (typeof activityData === 'string') {
            console.log(`     ${time}: ${activityData}`);
          } else {
            const activity = activityData as { activity: string; description: string };
            console.log(`     ${time}: ${activity.activity} - ${activity.description}`);
          }
        });
        console.log(`   💭 Reasoning: ${generatedPlan.reasoning}`);
        console.log(`   📊 Priority: ${generatedPlan.priority}`);
        
        return generatedPlan;
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ [PLANNING] Error generating daily plan for ${agent.data.name}:`, error);
      return null;
    }
  }

  /**
   * Force regenerate plan for an agent (useful for debugging and testing)
   */
  async forceRegeneratePlan(agent: SpawnedAgent): Promise<GeneratedPlan | null> {
    try {
      console.log(`🔄 [PLANNING] Force regenerating plan for ${agent.data.name}`);
      
      // Mark all existing plans as abandoned first
      const currentDay = this.gameTime.getCurrentDay();
      const updateResult = await this.pool.query(
        `UPDATE agent_plans 
         SET status = 'abandoned', updated_at = NOW()
         WHERE agent_id = $1 
         AND status = 'active'`,
        [agent.data.id]
      );
      
      if (updateResult.rowCount && updateResult.rowCount > 0) {
        console.log(`📋 [PLANNING] Marked ${updateResult.rowCount} existing plans as abandoned for ${agent.data.name}`);
      }
      
      // Generate a new plan
      const newPlan = await this.generateDailyPlan(agent);
      
      if (newPlan) {
        console.log(`✅ [PLANNING] Successfully force-regenerated plan for ${agent.data.name}: ${newPlan.daily_goal}`);
      } else {
        console.log(`❌ [PLANNING] Failed to force-regenerate plan for ${agent.data.name}`);
      }
      
      return newPlan;
      
    } catch (error) {
      console.error(`❌ [PLANNING] Error force-regenerating plan for ${agent.data.name}:`, error);
      return null;
    }
  }

  /**
   * Get planning context for an agent
   */
  private async getPlanningContext(agent: SpawnedAgent): Promise<PlanningContext> {
    // Get recent memories from database
    const recentMemories = await this.getRecentMemories(agent.data.id);
    
    return {
      agent,
      current_time: this.gameTime.getCurrentTimeString(),
      current_day: this.gameTime.getCurrentDay(),
      recent_memories: recentMemories,
      constitution: agent.data.constitution,
      current_plans: agent.data.current_plans,
      goals: [agent.data.primary_goal, ...agent.data.secondary_goals]
    };
  }

  /**
   * Construct LLM prompt for planning
   */
  private constructPlanningPrompt(context: PlanningContext): string {
    const { agent, current_time, current_day, recent_memories, constitution, goals } = context;
    
    const memoriesText = recent_memories.length > 0 
      ? recent_memories.map(mem => `- ${mem.content}`).join('\n')
      : 'No recent memories.';
    
    // Get character traits and preferences
    const personality = agent.data.personality_traits || [];
    const likes = agent.data.likes || [];
    const dislikes = agent.data.dislikes || [];
    const background = agent.data.background || '';
    
    // Create example schedule based on agent's existing schedule
    const existingSchedule = agent.data.schedule || {};
    const scheduleExample = this.generateScheduleExample(existingSchedule);
    
    const prompt = `${constitution}

CHARACTER DETAILS:
- Name: ${agent.data.name}
- Personality traits: ${personality.join(', ')}
- Likes: ${likes.join(', ')}
- Dislikes: ${dislikes.join(', ')}
- Background: ${background}

CURRENT SITUATION:
- Current time: ${current_time}
- Current day: ${current_day}
- Current location: ${agent.data.current_location}
- Current activity: ${agent.data.current_activity}
- Energy level: ${agent.data.energy_level}
- Mood: ${agent.data.mood}

GOALS:
- Primary goal: ${goals[0]}
- Secondary goals: ${goals.slice(1).join(', ')}

RECENT MEMORIES:
${memoriesText}

TASK: Generate a detailed daily plan for today that reflects your character, profession, and personality. Base your activities on your typical routine but adapt based on your current situation and goals.

Your existing schedule template for reference:
${scheduleExample}

    Respond in the following JSON format:
    {
      "daily_goal": "Brief description of today's main objective based on your character and goals",
      "schedule": {
        "6:00": {
          "activity": "wake_up",
          "description": "wake up and morning routine"
        },
        "7:00": {
          "activity": "work",
          "description": "specific description of morning work activity"
        },
        "8:00": {
          "activity": "work",
          "description": "specific description of work activity"
        },
        "9:00": {
          "activity": "work",
          "description": "specific description of work activity"
        },
        "10:00": {
          "activity": "work",
          "description": "specific description of work activity"
        },
        "11:00": {
          "activity": "work",
          "description": "specific description of work activity"
        },
        "12:00": {
          "activity": "lunch",
          "description": "lunch break"
        },
        "13:00": {
          "activity": "work",
          "description": "specific description of afternoon work activity"
        },
        "14:00": {
          "activity": "work",
          "description": "specific description of work activity"
        },
        "15:00": {
          "activity": "work",
          "description": "specific description of work activity"
        },
        "16:00": {
          "activity": "work",
          "description": "specific description of work activity"
        },
        "17:00": {
          "activity": "work",
          "description": "specific description of end-of-day work activity"
        },
        "18:00": {
          "activity": "dinner",
          "description": "dinner time"
        },
        "19:00": {
          "activity": "personal_time",
          "description": "specific description of personal activity"
        },
        "20:00": {
          "activity": "social",
          "description": "specific description of social activity"
        },
        "21:00": {
          "activity": "personal_time",
          "description": "specific description of relaxation activity"
        },
        "22:00": {
          "activity": "prepare_for_bed",
          "description": "evening routine and sleep preparation"
        }
      },
      "reasoning": "Brief explanation of why this plan makes sense given your character, situation, and goals",
      "priority": 7
    }

    IMPORTANT ACTIVITY TYPES:
    Use these activity types in the "activity" field:
    - WORK: "work", "crafting", "smithing", "baking", "farming", "teaching", "medical_work", "library_work", "patrol", "dj_work", "lighthouse_keeping", "boat_work", "apothecary_work", "tavern_work", "store_work", "legal_work", "administration"
    - MEALS: "breakfast", "lunch", "dinner", "lunch_at_tavern", "dinner_at_tavern"
    - PERSONAL: "personal_time", "relaxation", "exercise", "gardening", "fishing", "morning_walk", "morning_meditation", "morning_prayers"
    - SOCIAL: "social", "meetings", "counseling", "religious_service"
    - DAILY: "wake_up", "prepare_for_bed"
    - MAINTENANCE: "equipment_maintenance", "forge_maintenance", "tool_maintenance", "shop_cleaning"
    
    DESCRIPTION GUIDELINES:
    - Make descriptions specific to your character's profession and current situation
    - Include relevant details about what you're actually doing
    - Keep descriptions concise but informative
    - Examples: "patrol the harbor and check on boats", "craft fishing equipment and ship fittings", "organize books and help library visitors"
    
    TIME FORMATTING:
    - Use times like "6:00", "7:30", "12:00" (not "06:00" format)
    - Times can be variable (not just on the hour)
    - Consider realistic scheduling for your character's profession
    
    Respond with ONLY the JSON object, no additional text.`;

    return prompt;
  }

  /**
   * Generate schedule example from agent's existing schedule
   */
  private generateScheduleExample(existingSchedule: any): string {
    if (!existingSchedule || Object.keys(existingSchedule).length === 0) {
      return 'No existing schedule available.';
    }
    
    const scheduleEntries = Object.entries(existingSchedule)
      .map(([time, activity]: [string, any]) => {
        const description = activity.description || activity;
        return `${time}: ${description}`;
      })
      .slice(0, 5) // Show first 5 entries as examples
      .join('\n');
    
    return scheduleEntries + '\n... (continue with similar character-appropriate activities)';
  }

  /**
   * Call LLM for planning
   */
  private async callLLMForPlanning(prompt: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates daily plans for game characters. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  }

  /**
   * Parse and validate plan response
   */
  private parsePlanResponse(agentId: string, response: string): GeneratedPlan | null {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.daily_goal || !parsed.schedule || !parsed.reasoning) {
        console.error('❌ [PLANNING] Invalid plan response format');
        return null;
      }
      
      return {
        agent_id: agentId,
        plan_date: `day_${this.gameTime.getCurrentDay()}`,
        daily_goal: parsed.daily_goal,
        schedule: parsed.schedule,
        reasoning: parsed.reasoning,
        priority: parsed.priority || 5,
        created_at: new Date()
      };
      
    } catch (error) {
      console.error('❌ [PLANNING] Error parsing plan response:', error);
      return null;
    }
  }

  /**
   * Store daily plan in database
   */
  private async storeDailyPlan(plan: GeneratedPlan): Promise<void> {
    try {
      // Start a transaction to ensure atomicity
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // First, mark any existing active plans for this agent and day as abandoned
        const currentDay = this.gameTime.getCurrentDay();
        const updateResult = await client.query(
          `UPDATE agent_plans 
           SET status = 'abandoned', updated_at = NOW()
           WHERE agent_id = $1 
           AND plan_steps::text LIKE '%day_${currentDay}%'
           AND status = 'active'`,
          [plan.agent_id]
        );
        
        if (updateResult.rowCount && updateResult.rowCount > 0) {
          console.log(`📋 [PLANNING] Marked ${updateResult.rowCount} existing plans as abandoned for ${plan.agent_id} on day ${currentDay}`);
        }
        
        // Store the new plan data
        const planData = {
          plan_date: plan.plan_date,
          schedule: plan.schedule,
          reasoning: plan.reasoning
        };
        
        await client.query(
          `INSERT INTO agent_plans (agent_id, goal, plan_steps, status, priority, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            plan.agent_id,
            plan.daily_goal,
            [JSON.stringify(planData)],
            'active',
            plan.priority,
            plan.created_at
          ]
        );
        
        await client.query('COMMIT');
        console.log(`✅ [PLANNING] Successfully stored new daily plan for ${plan.agent_id}, replacing any existing plans`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ [PLANNING] Error storing daily plan:', error);
      throw error;
    }
  }

  /**
   * Store plan as agent memory
   */
  private async storePlanMemory(agentId: string, plan: GeneratedPlan): Promise<void> {
    try {
      const memoryContent = `I planned my day: ${plan.daily_goal}. ${plan.reasoning}`;
      
      await this.pool.query(
        `INSERT INTO agent_memories (agent_id, memory_type, content, importance_score, tags, location) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          agentId,
          'plan',
          memoryContent,
          plan.priority,
          ['planning', 'daily_plan'],
          'internal'
        ]
      );
    } catch (error) {
      console.error('❌ [PLANNING] Error storing plan memory:', error);
      // Don't throw - memory storage failure shouldn't break planning
    }
  }

  /**
   * Get recent memories for planning context
   */
  private async getRecentMemories(agentId: string): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT content, importance_score, timestamp, memory_type
         FROM agent_memories 
         WHERE agent_id = $1 
         AND timestamp >= NOW() - INTERVAL '24 hours'
         ORDER BY importance_score DESC, timestamp DESC
         LIMIT 10`,
        [agentId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('❌ [PLANNING] Error getting recent memories:', error);
      return [];
    }
  }

  /**
   * Check if agent needs a new daily plan
   */
  async needsDailyPlan(agent: SpawnedAgent): Promise<boolean> {
    try {
      const currentDay = this.gameTime.getCurrentDay();
      
      // Check if there's already an active plan for today
      const result = await this.pool.query(
        `SELECT COUNT(*), MAX(created_at) as latest_plan_time
         FROM agent_plans 
         WHERE agent_id = $1 
         AND plan_steps::text LIKE '%day_${currentDay}%'
         AND status = 'active'`,
        [agent.data.id]
      );
      
      const planCount = parseInt(result.rows[0].count);
      const latestPlanTime = result.rows[0].latest_plan_time;
      
      if (planCount === 0) {
        console.log(`📋 [PLANNING] ${agent.data.name} needs a plan - no active plan found for day ${currentDay}`);
        return true;
      }
      
      // Check if the existing plan is too old (more than 4 hours ago)
      if (latestPlanTime) {
        const planAge = Date.now() - new Date(latestPlanTime).getTime();
        const fourHoursInMs = 4 * 60 * 60 * 1000;
        
        if (planAge > fourHoursInMs) {
          console.log(`📋 [PLANNING] ${agent.data.name} needs a new plan - existing plan is ${Math.round(planAge / (60 * 60 * 1000))} hours old`);
          return true;
        }
      }
      
      console.log(`📋 [PLANNING] ${agent.data.name} has a recent active plan for day ${currentDay}`);
      return false;
      
    } catch (error) {
      console.error('❌ [PLANNING] Error checking plan needs:', error);
      return true; // Default to needing a plan
    }
  }

  /**
   * Get active daily plan for agent
   */
  async getActiveDailyPlan(agentId: string): Promise<GeneratedPlan | null> {
    try {
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
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      const planData = JSON.parse(row.plan_steps[0]);
      
      // Handle both old format (just schedule) and new format (with plan_date)
      const schedule = planData.schedule || planData;
      const planDate = planData.plan_date || `day_${currentDay}`;
      const reasoning = planData.reasoning || '';
      
      return {
        agent_id: row.agent_id,
        plan_date: planDate,
        daily_goal: row.daily_goal,
        schedule: schedule,
        reasoning: reasoning,
        priority: row.priority,
        created_at: row.created_at
      };
      
    } catch (error) {
      console.error('❌ [PLANNING] Error getting active plan:', error);
      return null;
    }
  }
} 