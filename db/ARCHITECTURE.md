# Database Architecture

## Overview
The database layer provides persistent storage for Heartwood Valley using **PostgreSQL** as the primary database. It stores player data, agent information, memory streams, and game state. The architecture is designed to support the complex generative agent system with efficient data retrieval and storage patterns.

## Technology Stack
- **PostgreSQL 14**: Primary relational database
- **pgvector**: Vector similarity search extension (Sprint 2+)
- **Docker**: Containerized database deployment
- **Node.js pg**: PostgreSQL client for Node.js
- **SQL**: Structured query language for data operations

## Database Schema Overview

### Core Tables

#### 1. Users & Characters
```sql
-- User authentication and account management
users (id, username, password_hash, created_at)

-- Player characters in the game world
characters (id, user_id, character_name)
```

#### 2. Agent System
```sql
-- Core agent information and configuration
agents (id, name, constitution, current_location, current_activity, 
        energy_level, mood, primary_goal, secondary_goals,
        personality_traits, likes, dislikes, background, 
        schedule, current_plans, created_at, updated_at)

-- Real-time agent state management
agent_states (agent_id, current_x, current_y, current_direction,
              current_action, action_start_time, interaction_target,
              emotional_state, physical_state, cognitive_load, updated_at)
```

#### 3. Memory System (Sprint 2+)
```sql
-- Agent memory stream for generative behavior
agent_memories (id, agent_id, memory_type, content, importance_score,
                emotional_relevance, tags, related_agents, related_players,
                location, timestamp, embedding_id)

-- Agent reflections and insights
agent_reflections (id, agent_id, reflection, trigger_memories,
                   insights, behavioral_changes, created_at)

-- Metacognitive processing
agent_metacognition (id, agent_id, performance_evaluation,
                     strategy_adjustments, goal_modifications,
                     self_awareness_notes, created_at)
```

#### 4. Social System
```sql
-- Agent-to-agent relationships
agent_relationships (agent_id, other_agent_id, relationship_type,
                     affection_score, trust_level, interaction_frequency,
                     last_interaction)

-- Agent-player relationships
agent_player_relationships (agent_id, character_id, relationship_type,
                           affection_score, trust_level, interaction_frequency,
                           last_interaction)

-- Conversation history
conversation_logs (id, initiator_type, initiator_id, recipient_type,
                   recipient_id, message, response, context,
                   emotional_tone, timestamp)
```

#### 5. Planning System
```sql
-- Agent schedules and routines
agent_schedules (id, agent_id, day_of_week, start_time, end_time,
                 activity, location, priority, is_flexible, created_at)

-- Dynamic agent plans
agent_plans (id, agent_id, goal, plan_steps, current_step,
             status, priority, deadline, created_at, updated_at)
```

## Data Architecture Patterns

### 1. Agent Data Model
```
Core Agent Entity:
├── Basic Info: name, constitution, personality
├── Current State: location, activity, mood, energy
├── Goals: primary_goal, secondary_goals, current_plans
├── Relationships: connections to other agents/players
├── Memory: observations, reflections, metacognition
└── Schedule: daily routines and planned activities
```

### 2. Memory Stream Pattern
```sql
Memory Types:
- 'observation': Direct environmental perceptions
- 'reflection': High-level insights from observations
- 'plan': Goal-oriented action sequences
- 'metacognition': Self-evaluation and strategy adjustment

Retrieval Factors:
- Recency: Recent memories weighted higher
- Importance: Scored 1-10 for significance
- Relevance: Vector similarity to current context
- Emotional: Emotional connection to current state
```

### 3. Relationship Modeling
```sql
Relationship Dimensions:
- Type: friend, colleague, rival, romantic, family
- Affection: -100 to +100 emotional connection
- Trust: 0-100 reliability assessment
- Frequency: Interaction count and recency
- History: Conversation logs and shared experiences
```

## Data Flow Patterns

### 1. Agent Initialization Flow
```
JSON Agent Files → load_agents.js → Database Population
├── agents table: Core agent data
├── agent_states table: Initial positioning
├── agent_schedules table: Daily routines
└── agent_relationships table: Initial connections
```

### 2. Memory Creation Flow
```
Game Event → Observation → Embedding Generation → Storage
├── Vector DB: Semantic search capability
├── PostgreSQL: Structured memory data
└── Redis: Recent memory cache
```

### 3. Agent Decision Flow
```
Decision Request → Memory Retrieval → Context Assembly → LLM Prompt
├── Recent memories (PostgreSQL timestamp)
├── Important memories (importance score)
├── Relevant memories (vector similarity)
└── Emotional memories (emotional relevance)
```

## Performance Optimizations

### 1. Indexing Strategy
```sql
-- Primary performance indexes
CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_timestamp ON agent_memories(timestamp);
CREATE INDEX idx_agent_memories_importance ON agent_memories(importance_score);
CREATE INDEX idx_conversation_logs_timestamp ON conversation_logs(timestamp);
CREATE INDEX idx_agent_relationships_agent_id ON agent_relationships(agent_id);

-- Composite indexes for complex queries
CREATE INDEX idx_memories_agent_type_time ON agent_memories(agent_id, memory_type, timestamp);
CREATE INDEX idx_states_location ON agent_states(current_x, current_y);
```

### 2. Data Partitioning (Future)
```sql
-- Partition conversation logs by timestamp
CREATE TABLE conversation_logs_2024_01 PARTITION OF conversation_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Partition memories by agent for large populations
CREATE TABLE agent_memories_high_activity PARTITION OF agent_memories
FOR VALUES IN ('elara_blacksmith', 'marcus_merchant', 'sarah_farmer');
```

### 3. Connection Pooling
```typescript
// Efficient connection management
const pool = new Pool({
  max: 20,                // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections
  connectionTimeoutMillis: 2000, // Connection timeout
});
```

## Data Initialization

### 1. Agent Loading System (`load_agents.js`)
```javascript
Agent Loading Process:
1. Read JSON files from agents/ directory
2. Parse agent configuration data
3. Insert/update agents table with upsert
4. Initialize agent_states with starting positions
5. Create default schedules and relationships
6. Log successful agent loading
```

### 2. Database Initialization (`init.sql`)
```sql
Initialization Process:
1. Create all required tables
2. Set up primary and foreign key constraints
3. Create performance indexes
4. Initialize default data (if any)
5. Set up triggers for automatic timestamps
```

## Vector Database Integration (Sprint 2)

### 1. pgvector Extension
```sql
-- Enable vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to memories table
ALTER TABLE agent_memories 
ADD COLUMN embedding vector(1536);

-- Create vector similarity index
CREATE INDEX ON agent_memories 
USING ivfflat (embedding vector_cosine_ops);
```

### 2. Memory Embedding Pipeline
```typescript
Memory Processing:
1. Memory content → OpenAI embedding API
2. Generate 1536-dimensional vector
3. Store in embedding column
4. Index for fast similarity search
5. Query using cosine similarity
```

### 3. Semantic Memory Retrieval
```sql
-- Find similar memories using vector search
SELECT content, importance_score, timestamp
FROM agent_memories
WHERE agent_id = $1
ORDER BY embedding <-> $2
LIMIT 10;

-- Combined similarity and recency search
SELECT *, 
       (embedding <-> $2) as similarity_score,
       EXTRACT(epoch FROM (now() - timestamp)) as recency_seconds
FROM agent_memories
WHERE agent_id = $1
ORDER BY (embedding <-> $2) * 0.7 + 
         (EXTRACT(epoch FROM (now() - timestamp)) / 86400) * 0.3
LIMIT 10;
```

## Data Consistency & Integrity

### 1. Transaction Management
```sql
-- Atomic agent state updates
BEGIN;
  UPDATE agents SET current_activity = 'talking' WHERE id = 'elara_blacksmith';
  UPDATE agent_states SET interaction_target = 'player_123' WHERE agent_id = 'elara_blacksmith';
  INSERT INTO conversation_logs (initiator_type, initiator_id, recipient_type, recipient_id, message) 
  VALUES ('player', 'player_123', 'agent', 'elara_blacksmith', 'Hello!');
COMMIT;
```

### 2. Foreign Key Constraints
```sql
-- Ensure referential integrity
ALTER TABLE agent_memories 
ADD CONSTRAINT fk_agent_memories_agent_id 
FOREIGN KEY (agent_id) REFERENCES agents(id);

ALTER TABLE agent_relationships 
ADD CONSTRAINT fk_agent_relationships_agent_id 
FOREIGN KEY (agent_id) REFERENCES agents(id);
```

### 3. Data Validation
```sql
-- Ensure valid data ranges
ALTER TABLE agent_memories 
ADD CONSTRAINT check_importance_score 
CHECK (importance_score >= 0 AND importance_score <= 10);

ALTER TABLE agent_relationships 
ADD CONSTRAINT check_affection_score 
CHECK (affection_score >= -100 AND affection_score <= 100);
```

## Backup & Recovery

### 1. Backup Strategy
```bash
# Daily full backup
pg_dump -U heartwood_user -h localhost heartwood_db > backup_$(date +%Y%m%d).sql

# Incremental backup using WAL
pg_basebackup -U heartwood_user -h localhost -D /backup/base -Ft -z -P

# Point-in-time recovery setup
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
```

### 2. Data Recovery
```bash
# Restore from backup
psql -U heartwood_user -h localhost heartwood_db < backup_20240101.sql

# Point-in-time recovery
pg_ctl stop -D /data/postgres
pg_ctl start -D /data/postgres
```

## Monitoring & Maintenance

### 1. Performance Monitoring
```sql
-- Monitor query performance
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY total_time DESC;

-- Monitor table statistics
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables;

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes;
```

### 2. Maintenance Tasks
```sql
-- Regular maintenance
VACUUM ANALYZE agent_memories;
VACUUM ANALYZE conversation_logs;
REINDEX INDEX idx_agent_memories_timestamp;

-- Statistics update
ANALYZE agent_memories;
ANALYZE agent_relationships;
```

## Security Considerations

### 1. Access Control
```sql
-- Role-based access control
CREATE ROLE heartwood_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO heartwood_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO heartwood_app;

-- Restricted access for specific operations
CREATE ROLE heartwood_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO heartwood_readonly;
```

### 2. Data Protection
```sql
-- Encrypt sensitive data
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash passwords
INSERT INTO users (username, password_hash) 
VALUES ('player1', crypt('password123', gen_salt('bf')));

-- Audit logging
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    operation VARCHAR(10),
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMPTZ DEFAULT now()
);
```

## Docker Configuration

### 1. Container Setup
```yaml
# docker-compose.yml configuration
postgres:
  image: postgres:14-alpine
  environment:
    - POSTGRES_USER=heartwood_user
    - POSTGRES_PASSWORD=heartwood_password
    - POSTGRES_DB=heartwood_db
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
  ports:
    - '5432:5432'
```

### 2. Volume Management
```bash
# Data persistence
docker volume create postgres_data

# Backup volume
docker volume create postgres_backup

# Mount backup volume
docker run -v postgres_backup:/backup postgres:14-alpine
```

## Development Workflow

### 1. Local Development
```bash
# Start database
docker-compose up postgres

# Connect to database
psql -U heartwood_user -h localhost heartwood_db

# Load sample data
node load_agents.js

# Run migrations (future)
npm run migrate
```

### 2. Schema Changes
```sql
-- Version-controlled schema changes
-- Migration: 001_add_vector_support.sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE agent_memories ADD COLUMN embedding vector(1536);
CREATE INDEX ON agent_memories USING ivfflat (embedding vector_cosine_ops);
```

## Future Enhancements

### 1. Advanced Vector Operations
```sql
-- Hybrid search combining vector and text
SELECT *, 
       ts_rank(to_tsvector('english', content), plainto_tsquery('friendship')) as text_score,
       (embedding <-> $1) as vector_score
FROM agent_memories
WHERE to_tsvector('english', content) @@ plainto_tsquery('friendship')
ORDER BY text_score * 0.3 + (1 - (embedding <-> $1)) * 0.7;
```

### 2. Sharding Strategy
```sql
-- Horizontal sharding for large agent populations
CREATE TABLE agent_memories_shard_1 () INHERITS (agent_memories);
CREATE TABLE agent_memories_shard_2 () INHERITS (agent_memories);

-- Partition function
CREATE OR REPLACE FUNCTION agent_memories_partition_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.agent_id IN ('elara_blacksmith', 'marcus_merchant') THEN
        INSERT INTO agent_memories_shard_1 VALUES (NEW.*);
    ELSE
        INSERT INTO agent_memories_shard_2 VALUES (NEW.*);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### 3. Real-time Features
```sql
-- PostgreSQL LISTEN/NOTIFY for real-time updates
CREATE OR REPLACE FUNCTION notify_memory_insert() RETURNS TRIGGER AS $$
BEGIN
    NOTIFY memory_update, json_build_object('agent_id', NEW.agent_id, 'type', 'new_memory')::text;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_insert_trigger
AFTER INSERT ON agent_memories
FOR EACH ROW EXECUTE FUNCTION notify_memory_insert();
```

This database architecture provides a robust foundation for the generative agent system, with efficient data storage, retrieval patterns, and scalability considerations for future growth. 