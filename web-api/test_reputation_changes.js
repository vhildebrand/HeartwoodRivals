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

async function testReputationChanges() {
  console.log('🧪 Testing Reputation Score Changes...\n');
  
  try {
    // Connect to Redis
    await redisClient.connect();
    
    // Import the services
    const { ReputationManager } = require('./src/services/ReputationManager');
    const reputationManager = new ReputationManager(pool, redisClient);
    
    // Test data
    const testPlayerId = '00000000-0000-0000-0000-000000000456';
    const testPlayerName = 'ReputationTestPlayer';
    
    // Setup: Create test player and character
    console.log('📋 Setting up test player...');
    await pool.query(`
      INSERT INTO users (id, username, password_hash) 
      VALUES ('00000000-0000-0000-0000-000000000002', 'reputation_test_user', 'hash')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await pool.query(`
      INSERT INTO characters (id, user_id, character_name) 
      VALUES ('${testPlayerId}', '00000000-0000-0000-0000-000000000002', '${testPlayerName}')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Initialize player reputation
    await reputationManager.initializePlayerReputation(testPlayerId);
    
    // Get initial reputation
    const initialReputation = await reputationManager.getPlayerReputation(testPlayerId);
    console.log(`📊 Initial reputation: ${initialReputation.reputation_score}/100`);
    
    // Test 1: Positive reputation changes
    console.log('\n📋 Test 1: Testing positive reputation changes...');
    
    const positiveTests = [
      { change: 2, reason: 'Helped another player', expected: 52 },
      { change: 3, reason: 'Generous gift giving', expected: 55 },
      { change: 1, reason: 'Polite behavior', expected: 56 },
      { change: 5, reason: 'Community service', expected: 61 }
    ];
    
    for (const test of positiveTests) {
      await reputationManager.updatePlayerReputation({
        character_id: testPlayerId,
        score_change: test.change,
        reason: test.reason
      });
      
      const currentReputation = await reputationManager.getPlayerReputation(testPlayerId);
      const success = currentReputation.reputation_score === test.expected;
      
      console.log(`   ${success ? '✅' : '❌'} ${test.reason}: ${currentReputation.reputation_score}/100 (expected: ${test.expected})`);
    }
    
    // Test 2: Negative reputation changes
    console.log('\n📋 Test 2: Testing negative reputation changes...');
    
    const negativeTests = [
      { change: -2, reason: 'Rude behavior', expected: 59 },
      { change: -3, reason: 'Aggressive actions', expected: 56 },
      { change: -1, reason: 'Minor disruption', expected: 55 },
      { change: -5, reason: 'Destructive behavior', expected: 50 }
    ];
    
    for (const test of negativeTests) {
      await reputationManager.updatePlayerReputation({
        character_id: testPlayerId,
        score_change: test.change,
        reason: test.reason
      });
      
      const currentReputation = await reputationManager.getPlayerReputation(testPlayerId);
      const success = currentReputation.reputation_score === test.expected;
      
      console.log(`   ${success ? '✅' : '❌'} ${test.reason}: ${currentReputation.reputation_score}/100 (expected: ${test.expected})`);
    }
    
    // Test 3: Boundary conditions
    console.log('\n📋 Test 3: Testing boundary conditions...');
    
    // Test maximum reputation (should cap at 100)
    await reputationManager.updatePlayerReputation({
      character_id: testPlayerId,
      score_change: 100,
      reason: 'Large positive change'
    });
    
    const maxReputation = await reputationManager.getPlayerReputation(testPlayerId);
    const maxSuccess = maxReputation.reputation_score === 100;
    console.log(`   ${maxSuccess ? '✅' : '❌'} Maximum reputation cap: ${maxReputation.reputation_score}/100 (expected: 100)`);
    
    // Test minimum reputation (should cap at 0)
    await reputationManager.updatePlayerReputation({
      character_id: testPlayerId,
      score_change: -200,
      reason: 'Large negative change'
    });
    
    const minReputation = await reputationManager.getPlayerReputation(testPlayerId);
    const minSuccess = minReputation.reputation_score === 0;
    console.log(`   ${minSuccess ? '✅' : '❌'} Minimum reputation cap: ${minReputation.reputation_score}/100 (expected: 0)`);
    
    // Test 4: Reputation statistics
    console.log('\n📋 Test 4: Testing reputation statistics...');
    
    const stats = await reputationManager.getReputationStats();
    console.log('   📊 Reputation Statistics:');
    console.log(`      Total players: ${stats.total_players}`);
    console.log(`      Average reputation: ${Math.round(stats.average_reputation)}/100`);
    console.log(`      Min reputation: ${stats.min_reputation}/100`);
    console.log(`      Max reputation: ${stats.max_reputation}/100`);
    console.log(`      High reputation (≥75): ${stats.high_reputation} players`);
    console.log(`      Low reputation (≤25): ${stats.low_reputation} players`);
    
    // Test 5: Multiple player reputation comparison
    console.log('\n📋 Test 5: Testing multiple player reputation tracking...');
    
    // Create a second test player
    const testPlayerId2 = '00000000-0000-0000-0000-000000000789';
    await pool.query(`
      INSERT INTO characters (id, user_id, character_name) 
      VALUES ('${testPlayerId2}', '00000000-0000-0000-0000-000000000002', 'SecondTestPlayer')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await reputationManager.initializePlayerReputation(testPlayerId2);
    
    // Set different reputation levels
    await reputationManager.updatePlayerReputation({
      character_id: testPlayerId2,
      score_change: 25,
      reason: 'Test positive behavior'
    });
    
    // Get all reputations
    const allReputations = await reputationManager.getAllReputations();
    console.log('   📊 All Player Reputations:');
    allReputations.forEach((rep, index) => {
      console.log(`      ${index + 1}. Player ${rep.character_id.substring(0, 8)}...: ${rep.reputation_score}/100`);
    });
    
    // Test 6: Reputation tiers
    console.log('\n📋 Test 6: Testing reputation tier classifications...');
    
    const reputationTiers = [
      { score: 90, tier: 'Excellent' },
      { score: 70, tier: 'Good' },
      { score: 50, tier: 'Neutral' },
      { score: 30, tier: 'Poor' },
      { score: 10, tier: 'Very Poor' }
    ];
    
    for (const tier of reputationTiers) {
      // Reset reputation to test value
      const currentRep = await reputationManager.getPlayerReputation(testPlayerId);
      const adjustment = tier.score - currentRep.reputation_score;
      
      await reputationManager.updatePlayerReputation({
        character_id: testPlayerId,
        score_change: adjustment,
        reason: `Setting to ${tier.tier} tier`
      });
      
      const newRep = await reputationManager.getPlayerReputation(testPlayerId);
      let tierDescription = '';
      
      if (newRep.reputation_score >= 75) {
        tierDescription = 'Excellent';
      } else if (newRep.reputation_score >= 60) {
        tierDescription = 'Good';
      } else if (newRep.reputation_score >= 40) {
        tierDescription = 'Neutral';
      } else if (newRep.reputation_score >= 25) {
        tierDescription = 'Poor';
      } else {
        tierDescription = 'Very Poor';
      }
      
      console.log(`   📊 Score ${newRep.reputation_score}/100 → ${tierDescription} tier`);
    }
    
    // Cleanup
    console.log('\n📋 Cleaning up test data...');
    await pool.query(`DELETE FROM player_reputations WHERE character_id IN ($1, $2)`, [testPlayerId, testPlayerId2]);
    await pool.query(`DELETE FROM characters WHERE id IN ($1, $2)`, [testPlayerId, testPlayerId2]);
    await pool.query(`DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000002'`);
    
    console.log('✅ Test cleanup completed');
    console.log('\n🎉 Reputation Changes Test Complete!');
    
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
  testReputationChanges();
}

module.exports = { testReputationChanges }; 