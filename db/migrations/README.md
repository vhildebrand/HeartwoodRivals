# Database Migrations - Relationship System

This directory contains database migrations for the Competitive Social & Relationship System.

## Migration Files

### 001_relationship_system_foundation.sql
This migration adds the foundational database schema changes for the relationship system:

- Adds `contention_state` and `relationship_status` columns to `agent_player_relationships`
- Creates new `player_reputations` table for tracking player reputation scores
- Creates new `gossip_logs` table for tracking social influence events
- Adds appropriate indexes for performance optimization

## Usage

### For New Databases
New databases will automatically include these changes when running `db/init.sql`.

### For Existing Databases
To apply the migration to an existing database:

```bash
# Navigate to the db directory
cd db

# Apply the migration
node apply_migration.js
```

### Testing Migrations
To verify that the migration was applied correctly:

```bash
# Navigate to the db directory
cd db

# Run migration tests
node test_migrations.js
```

## Migration Details

### New Columns in agent_player_relationships
- `contention_state`: VARCHAR(20) DEFAULT 'open'
  - Values: 'open', 'conflicted', 'focused', 'exclusive'
  - Tracks the NPC's romantic contention state
  
- `relationship_status`: VARCHAR(50) DEFAULT 'acquaintance'
  - Values: 'acquaintance', 'friend', 'close_friend', 'romantic_interest', 'dating', 'estranged'
  - Tracks the specific relationship tier

### New Tables

#### player_reputations
- `character_id`: UUID PRIMARY KEY
- `reputation_score`: INT DEFAULT 50 (0-100 scale)
- `last_updated`: TIMESTAMPTZ DEFAULT now()

#### gossip_logs
- `id`: BIGSERIAL PRIMARY KEY
- `source_character_id`: UUID (who is gossiping)
- `target_character_id`: UUID (who is being gossiped about)
- `npc_listener_id`: VARCHAR(50) (which NPC is hearing the gossip)
- `content`: TEXT (what was said)
- `is_positive`: BOOLEAN (positive or negative gossip)
- `credibility_score`: INT DEFAULT 50 (0-100, how much the NPC believes it)
- `timestamp`: TIMESTAMPTZ DEFAULT now()

## Environment Variables

The migration scripts use the same environment variables as the main application:

- `DB_HOST`: Database host (default: localhost)
- `DB_USER`: Database user (default: heartwood_user)
- `DB_PASSWORD`: Database password (default: heartwood_password)
- `DB_NAME`: Database name (default: heartwood_db)
- `DB_PORT`: Database port (default: 5432)

## Notes

- All migrations use `IF NOT EXISTS` clauses to be safely re-runnable
- The migration system is designed to be compatible with the existing Docker setup
- Test data is automatically cleaned up after testing
- All foreign key constraints are properly maintained 