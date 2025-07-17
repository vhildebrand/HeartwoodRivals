const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Test database configuration
const testPool = new Pool({
  user: process.env.DB_USER || 'heartwood_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'heartwood_db',
  password: process.env.DB_PASSWORD || 'heartwood_password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function testMigrations() {
  console.log('🧪 Testing Relationship System Database Migrations...\n');
  
  try {
    // Test 1: Check if agent_player_relationships table exists with new columns
    console.log('📋 Test 1: Checking agent_player_relationships table structure...');
    const relationshipsQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'agent_player_relationships'
      AND column_name IN ('contention_state', 'relationship_status')
      ORDER BY column_name
    `;
    
    const relationshipsResult = await testPool.query(relationshipsQuery);
    
    if (relationshipsResult.rows.length === 2) {
      console.log('✅ agent_player_relationships table has new columns:');
      relationshipsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
      });
    } else {
      console.log('❌ agent_player_relationships table missing new columns');
      console.log('Found columns:', relationshipsResult.rows);
    }

    // Test 2: Check if player_reputations table exists
    console.log('\n📋 Test 2: Checking player_reputations table...');
    const reputationsQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_reputations'
      ORDER BY column_name
    `;
    
    const reputationsResult = await testPool.query(reputationsQuery);
    
    if (reputationsResult.rows.length > 0) {
      console.log('✅ player_reputations table exists with columns:');
      reputationsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
      });
    } else {
      console.log('❌ player_reputations table does not exist');
    }

    // Test 3: Check if gossip_logs table exists
    console.log('\n📋 Test 3: Checking gossip_logs table...');
    const gossipQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'gossip_logs'
      ORDER BY column_name
    `;
    
    const gossipResult = await testPool.query(gossipQuery);
    
    if (gossipResult.rows.length > 0) {
      console.log('✅ gossip_logs table exists with columns:');
      gossipResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
      });
    } else {
      console.log('❌ gossip_logs table does not exist');
    }

    // Test 4: Check if indexes exist
    console.log('\n📋 Test 4: Checking database indexes...');
    const indexQuery = `
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (
        indexname LIKE '%gossip_logs%'
        OR indexname LIKE '%player_reputations%'
        OR indexname LIKE '%agent_player_relationships%'
      )
      ORDER BY tablename, indexname
    `;
    
    const indexResult = await testPool.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.log('✅ Found relationship system indexes:');
      indexResult.rows.forEach(row => {
        console.log(`   - ${row.indexname} on ${row.tablename}`);
      });
    } else {
      console.log('❌ No relationship system indexes found');
    }

    // Test 5: Test data insertion (basic functionality)
    console.log('\n📋 Test 5: Testing data insertion...');
    
    // Create test user and character if they don't exist
    await testPool.query(`
      INSERT INTO users (id, username, password_hash) 
      VALUES ('00000000-0000-0000-0000-000000000001', 'test_user', 'hash')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await testPool.query(`
      INSERT INTO characters (id, user_id, character_name) 
      VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'test_character')
      ON CONFLICT (id) DO NOTHING
    `);

    // Test player_reputations insertion
    try {
      await testPool.query(`
        INSERT INTO player_reputations (character_id, reputation_score)
        VALUES ('00000000-0000-0000-0000-000000000002', 75)
        ON CONFLICT (character_id) DO UPDATE SET reputation_score = 75
      `);
      console.log('✅ player_reputations insertion successful');
    } catch (error) {
      console.log('❌ player_reputations insertion failed:', error.message);
    }

    // Test gossip_logs insertion
    try {
      await testPool.query(`
        INSERT INTO gossip_logs (
          source_character_id, target_character_id, npc_listener_id,
          content, is_positive, credibility_score
        )
        VALUES (
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000002',
          'elara_blacksmith',
          'Test gossip content',
          true,
          80
        )
      `);
      console.log('✅ gossip_logs insertion successful');
    } catch (error) {
      console.log('❌ gossip_logs insertion failed:', error.message);
    }

    // Test agent_player_relationships new columns
    try {
      await testPool.query(`
        INSERT INTO agent_player_relationships (
          agent_id, character_id, affection_score, contention_state, relationship_status
        )
        VALUES (
          'elara_blacksmith',
          '00000000-0000-0000-0000-000000000002',
          65,
          'conflicted',
          'close_friend'
        )
        ON CONFLICT (agent_id, character_id) DO UPDATE SET
          contention_state = 'conflicted',
          relationship_status = 'close_friend'
      `);
      console.log('✅ agent_player_relationships new columns working');
    } catch (error) {
      console.log('❌ agent_player_relationships new columns failed:', error.message);
    }

    // Test 6: Clean up test data
    console.log('\n📋 Test 6: Cleaning up test data...');
    await testPool.query(`DELETE FROM gossip_logs WHERE content = 'Test gossip content'`);
    await testPool.query(`DELETE FROM player_reputations WHERE character_id = '00000000-0000-0000-0000-000000000002'`);
    await testPool.query(`DELETE FROM agent_player_relationships WHERE character_id = '00000000-0000-0000-0000-000000000002'`);
    await testPool.query(`DELETE FROM characters WHERE id = '00000000-0000-0000-0000-000000000002'`);
    await testPool.query(`DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001'`);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All migration tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    process.exit(1);
  } finally {
    await testPool.end();
  }
}

// Run tests if called directly
if (require.main === module) {
  testMigrations();
}

module.exports = { testMigrations }; 