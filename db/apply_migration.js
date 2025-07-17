const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'heartwood_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'heartwood_db',
  password: process.env.DB_PASSWORD || 'heartwood_password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function applyMigration() {
  console.log('🔄 Applying Relationship System Migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_relationship_system_foundation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📂 Loaded migration file: 001_relationship_system_foundation.sql');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the changes
    console.log('\n🔍 Verifying migration...');
    
    // Check new columns
    const columnsQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'agent_player_relationships'
      AND column_name IN ('contention_state', 'relationship_status')
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    console.log(`✅ Added ${columnsResult.rows.length} new columns to agent_player_relationships`);
    
    // Check new tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('player_reputations', 'gossip_logs')
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    console.log(`✅ Created ${tablesResult.rows.length} new tables`);
    
    // Check indexes
    const indexQuery = `
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (
        indexname LIKE '%gossip_logs%'
        OR indexname LIKE '%player_reputations%'
        OR indexname LIKE '%agent_player_relationships%'
      )
    `;
    
    const indexResult = await pool.query(indexQuery);
    console.log(`✅ Created ${indexResult.rows[0].count} new indexes`);
    
    console.log('\n🎉 Relationship System migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  applyMigration();
}

module.exports = { applyMigration }; 