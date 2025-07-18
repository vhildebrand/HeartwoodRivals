import { Pool } from 'pg';
import { createClient } from 'redis';
import { AgentMemoryManager } from './AgentMemoryManager';

export class ReflectionProcessor {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private queueClient: ReturnType<typeof createClient>;
  private memoryManager: AgentMemoryManager;
  private isProcessing: boolean = false;

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    // Create separate client for queue operations
    this.queueClient = redisClient.duplicate();
    this.memoryManager = new AgentMemoryManager(pool, redisClient);
    
    // Connect the queue client
    this.initializeQueueClient();
  }

  private async initializeQueueClient(): Promise<void> {
    try {
      await this.queueClient.connect();
      console.log('✅ [REFLECTION PROCESSOR] Queue client connected');
    } catch (error) {
      console.error('❌ [REFLECTION PROCESSOR] Error connecting queue client:', error);
    }
  }

  /**
   * Start processing reflections from the queue
   */
  public async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      console.log('🔄 [REFLECTION PROCESSOR] Already processing reflections');
      return;
    }

    this.isProcessing = true;
    console.log('🚀 [REFLECTION PROCESSOR] Starting reflection processing');

    // Process reflections continuously
    while (this.isProcessing) {
      try {
        await this.processNextReflection();
        
        // Wait a bit before checking for next reflection
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('❌ [REFLECTION PROCESSOR] Error in processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer on error
      }
    }
  }

  /**
   * Stop processing reflections
   */
  public stopProcessing(): void {
    console.log('🛑 [REFLECTION PROCESSOR] Stopping reflection processing');
    this.isProcessing = false;
  }

  /**
   * Process the next reflection in the queue
   */
  private async processNextReflection(): Promise<void> {
    try {
      // Get next reflection from global queue using separate queue client
      const queueItem = await this.queueClient.rPop('global_reflection_queue');
      
      if (!queueItem) {
        return; // No reflections to process
      }

      const reflectionData = JSON.parse(queueItem);
      const { agent_id, cumulative_importance, trigger_time } = reflectionData;

      console.log(`🔄 [REFLECTION PROCESSOR] Processing reflection for ${agent_id} (importance: ${cumulative_importance})`);

      // Generate the reflection
      await this.memoryManager.generateReflection(agent_id);

      // Clean up agent-specific queue using separate queue client
      await this.queueClient.del(`reflection_queue:${agent_id}`);

      console.log(`✅ [REFLECTION PROCESSOR] Completed reflection for ${agent_id}`);

    } catch (error) {
      console.error('❌ [REFLECTION PROCESSOR] Error processing reflection:', error);
    }
  }

  /**
   * Manually trigger reflection for an agent (for testing)
   */
  public async triggerReflection(agent_id: string): Promise<void> {
    try {
      console.log(`🎯 [REFLECTION PROCESSOR] Manually triggering reflection for ${agent_id}`);
      await this.memoryManager.generateReflection(agent_id);
    } catch (error) {
      console.error(`❌ [REFLECTION PROCESSOR] Error in manual reflection trigger:`, error);
    }
  }

  /**
   * Get reflection queue status
   */
  public async getQueueStatus(): Promise<{
    global_queue_length: number;
    agent_queues: { agent_id: string; queue_length: number }[];
  }> {
    try {
      const globalQueueLength = await this.queueClient.lLen('global_reflection_queue');
      
      // Get all agent-specific queues
      const keys = await this.queueClient.keys('reflection_queue:*');
      const agentQueues = [];
      
      for (const key of keys) {
        const agentId = key.replace('reflection_queue:', '');
        const queueLength = await this.queueClient.lLen(key);
        agentQueues.push({ agent_id: agentId, queue_length: queueLength });
      }

      return {
        global_queue_length: globalQueueLength,
        agent_queues: agentQueues
      };
    } catch (error) {
      console.error('❌ [REFLECTION PROCESSOR] Error getting queue status:', error);
      return { global_queue_length: 0, agent_queues: [] };
    }
  }
} 