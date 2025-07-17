const { Pool } = require('pg');
const { createClient } = require('redis');

// Test database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'heartwood_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'heartwood_db',
  password: process.env.DB_PASSWORD || 'heartwood_password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Redis client for testing
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

async function testWitnessSystem() {
  console.log('🧪 Testing Witness System Integration...\n');
  
  try {
    // Connect to Redis
    await redisClient.connect();
    
    // Import the services (this would normally be done in a proper test setup)
    const { AgentMemoryManager } = require('./src/services/AgentMemoryManager');
    const { ReputationManager } = require('./src/services/ReputationManager');
    const { AgentObservationSystem } = require('./src/services/AgentObservationSystem');
    
    // Initialize services
    const memoryManager = new AgentMemoryManager(pool, redisClient);
    const reputationManager = new ReputationManager(pool, redisClient);
    const observationSystem = new AgentObservationSystem(pool, redisClient, memoryManager, reputationManager);
    
    // Test data
    const testPlayerId = '00000000-0000-0000-0000-000000000123';
    const testPlayerName = 'TestPlayer';
    const witnessAgentId = 'elara_blacksmith';
    const location = 'blacksmith_shop';
    
    // Setup: Create test player and character
    console.log('📋 Setting up test player...');
    await pool.query(`
      INSERT INTO users (id, username, password_hash) 
      VALUES ('00000000-0000-0000-0000-000000000001', 'test_user', 'hash')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await pool.query(`
      INSERT INTO characters (id, user_id, character_name) 
      VALUES ('${testPlayerId}', '00000000-0000-0000-0000-000000000001', '${testPlayerName}')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Initialize player reputation
    await reputationManager.initializePlayerReputation(testPlayerId);
    
    // Get initial reputation
    const initialReputation = await reputationManager.getPlayerReputation(testPlayerId);
    console.log(`📊 Initial reputation: ${initialReputation?.reputation_score || 'N/A'}`);
    
    // Test 1: Record a positive gift giving event
    console.log('\n📋 Test 1: Recording gift giving event...');
    await observationSystem.recordWitnessableEvent(
      testPlayerId,
      'gift_giving',
      location,
      {
        name: testPlayerName,
        gift: 'beautiful flowers',
        recipient: 'Elara',
        related_agents: [witnessAgentId]
      }
    );
    
    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if memory was created
    console.log('\n📋 Test 2: Checking witness memory...');
    const witnessMemories = await pool.query(`
      SELECT content, importance_score, tags, related_players
      FROM agent_memories
      WHERE agent_id = $1
      AND content LIKE '%${testPlayerName}%'
      AND content LIKE '%gift%'
      ORDER BY timestamp DESC
      LIMIT 1
    `, [witnessAgentId]);
    
    if (witnessMemories.rows.length > 0) {
      const memory = witnessMemories.rows[0];
      console.log(`✅ Witness memory created: "${memory.content.substring(0, 80)}..."`);
      console.log(`📊 Importance score: ${memory.importance_score}`);
      console.log(`🏷️  Tags: ${memory.tags}`);
      
      // Check if it's marked as witnessable
      const isWitnessable = memory.tags && memory.tags.includes('witnessable_social_event');
      console.log(`👁️  Is witnessable: ${isWitnessable ? 'YES' : 'NO'}`);
    } else {
      console.log('❌ No witness memory found');
    }
    
    // Test 3: Check reputation update
    console.log('\n📋 Test 3: Checking reputation update...');
    const updatedReputation = await reputationManager.getPlayerReputation(testPlayerId);
    const reputationChange = updatedReputation.reputation_score - initialReputation.reputation_score;
    
    console.log(`📊 Updated reputation: ${updatedReputation.reputation_score}`);
    console.log(`📈 Reputation change: ${reputationChange > 0 ? '+' : ''}${reputationChange}`);
    
    if (reputationChange > 0) {
      console.log('✅ Reputation increased correctly');
    } else {
      console.log('❌ Reputation did not increase');
    }
    
    // Test 4: Test negative behavior
    console.log('\n📋 Test 4: Recording negative behavior...');
    await observationSystem.recordWitnessableEvent(
      testPlayerId,
      'player_pushing',
      location,
      {
        name: testPlayerName,
        target: 'Marcus the merchant',
        related_agents: [witnessAgentId]
      }
    );
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check negative reputation change
    const finalReputation = await reputationManager.getPlayerReputation(testPlayerId);
    const negativeChange = finalReputation.reputation_score - updatedReputation.reputation_score;
    
    console.log(`📊 Final reputation: ${finalReputation.reputation_score}`);
    console.log(`📉 Negative change: ${negativeChange < 0 ? '' : '+'}${negativeChange}`);
    
    if (negativeChange < 0) {
      console.log('✅ Reputation decreased correctly for negative behavior');
    } else {
      console.log('❌ Reputation did not decrease for negative behavior');
    }
    
    // Test 5: Check gossip logs
    console.log('\n📋 Test 5: Checking gossip logs...');
    const gossipLogs = await pool.query(`
      SELECT content, is_positive, credibility_score
      FROM gossip_logs
      WHERE target_character_id = $1
      ORDER BY timestamp DESC
      LIMIT 5
    `, [testPlayerId]);
    
    if (gossipLogs.rows.length > 0) {
      console.log(`📝 Found ${gossipLogs.rows.length} gossip entries:`);
      gossipLogs.rows.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.is_positive ? 'Positive' : 'Negative'} (credibility: ${log.credibility_score}): ${log.content.substring(0, 60)}...`);
      });
    } else {
      console.log('📝 No gossip entries found');
    }
    
    // Cleanup
    console.log('\n📋 Cleaning up test data...');
    await pool.query(`DELETE FROM gossip_logs WHERE target_character_id = $1`, [testPlayerId]);
    await pool.query(`DELETE FROM agent_memories WHERE related_players @> $1`, [`{${testPlayerId}}`]);
    await pool.query(`DELETE FROM player_reputations WHERE character_id = $1`, [testPlayerId]);
    await pool.query(`DELETE FROM characters WHERE id = $1`, [testPlayerId]);
    await pool.query(`DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001'`);
    
    console.log('✅ Test cleanup completed');
    console.log('\n🎉 Witness System Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await redisClient.disconnect();
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testWitnessSystem();
}

module.exports = { testWitnessSystem }; 