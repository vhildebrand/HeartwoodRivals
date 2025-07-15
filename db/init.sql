-- db/init.sql

-- Enable pgvector extension for semantic similarity search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    character_name VARCHAR(50) NOT NULL
);

-- Generative Agents (NPCs)
CREATE TABLE agents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    constitution TEXT NOT NULL, -- Core personality and behavioral patterns
    current_location VARCHAR(100),
    current_activity TEXT,
    energy_level INT DEFAULT 100,
    mood VARCHAR(50) DEFAULT 'neutral',
    primary_goal TEXT,
    secondary_goals TEXT[], -- Array of secondary goals
    personality_traits TEXT[], -- Array of personality traits
    likes TEXT[], -- Array of things they like
    dislikes TEXT[], -- Array of things they dislike
    background TEXT,
    schedule JSONB, -- Daily schedule as JSON
    current_plans TEXT[], -- Array of current plans
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Load agents from JSON files
-- This will be executed by the load_agents.js script after the database is initialized

-- Agent Memory Stream
CREATE TABLE agent_memories (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    memory_type VARCHAR(20) NOT NULL, -- 'observation', 'reflection', 'plan'
    content TEXT NOT NULL,
    importance_score INT DEFAULT 0, -- 1-10 scale
    emotional_relevance INT DEFAULT 0, -- 1-10 scale
    tags TEXT[], -- For categorization
    related_agents TEXT[], -- Other agents involved
    related_players TEXT[], -- Players involved (supports both UUID and string IDs)
    location VARCHAR(100),
    timestamp TIMESTAMPTZ DEFAULT now(),
    embedding vector(1536) -- OpenAI embedding vector (1536 dimensions)
);

-- Agent Relationships (Agent-to-Agent)
CREATE TABLE agent_relationships (
    agent_id VARCHAR(50) REFERENCES agents(id),
    other_agent_id VARCHAR(50) REFERENCES agents(id),
    relationship_type VARCHAR(50), -- 'friend', 'colleague', 'rival', etc.
    affection_score INT DEFAULT 0,
    trust_level INT DEFAULT 0,
    interaction_frequency INT DEFAULT 0,
    last_interaction TIMESTAMPTZ,
    PRIMARY KEY (agent_id, other_agent_id)
);

-- Agent-Player Relationships
CREATE TABLE agent_player_relationships (
    agent_id VARCHAR(50) REFERENCES agents(id),
    character_id UUID REFERENCES characters(id),
    relationship_type VARCHAR(50),
    affection_score INT DEFAULT 0,
    trust_level INT DEFAULT 0,
    interaction_frequency INT DEFAULT 0,
    last_interaction TIMESTAMPTZ,
    PRIMARY KEY (agent_id, character_id)
);

-- Agent Schedules
CREATE TABLE agent_schedules (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    day_of_week INT, -- 0-6, or NULL for one-time events
    start_time TIME,
    end_time TIME,
    activity TEXT NOT NULL,
    location VARCHAR(100),
    priority INT DEFAULT 1, -- 1-10 scale
    is_flexible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Plans (Dynamic, goal-oriented actions)
CREATE TABLE agent_plans (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    goal TEXT NOT NULL,
    plan_steps TEXT[], -- Array of planned actions
    current_step INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    priority INT DEFAULT 1,
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Reflections
CREATE TABLE agent_reflections (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    reflection TEXT NOT NULL,
    trigger_memories BIGINT[], -- Array of memory IDs that triggered this reflection
    insights TEXT[],
    behavioral_changes TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Metacognitive Insights
CREATE TABLE agent_metacognition (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    performance_evaluation TEXT,
    strategy_adjustments TEXT[],
    goal_modifications TEXT[],
    self_awareness_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation Logs (Enhanced for agent-agent interactions)
CREATE TABLE conversation_logs (
    id BIGSERIAL PRIMARY KEY,
    initiator_type VARCHAR(10) NOT NULL, -- 'agent' or 'player'
    initiator_id VARCHAR(50) NOT NULL, -- agent_id or character_id
    recipient_type VARCHAR(10) NOT NULL, -- 'agent' or 'player'
    recipient_id VARCHAR(50) NOT NULL, -- agent_id or character_id
    message TEXT NOT NULL,
    response TEXT,
    context TEXT, -- Environmental context
    emotional_tone VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Agent State (Current dynamic state)
CREATE TABLE agent_states (
    agent_id VARCHAR(50) PRIMARY KEY REFERENCES agents(id),
    current_x INT,
    current_y INT,
    current_direction VARCHAR(10),
    current_action VARCHAR(100),
    action_start_time TIMESTAMPTZ,
    interaction_target VARCHAR(50), -- Who they're currently interacting with
    emotional_state JSONB, -- Complex emotional state
    physical_state JSONB, -- Energy, health, etc.
    cognitive_load INT DEFAULT 0, -- How much they're thinking about
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient memory retrieval
CREATE INDEX idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_timestamp ON agent_memories(timestamp);
CREATE INDEX idx_agent_memories_importance ON agent_memories(importance_score);
CREATE INDEX idx_agent_memories_type ON agent_memories(memory_type);

-- Create vector similarity index for semantic search
CREATE INDEX idx_agent_memories_embedding ON agent_memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create composite index for efficient agent-specific queries
CREATE INDEX idx_agent_memories_agent_time ON agent_memories(agent_id, timestamp DESC);
CREATE INDEX idx_agent_memories_agent_importance ON agent_memories(agent_id, importance_score DESC);
