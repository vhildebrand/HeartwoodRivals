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
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_thought_processing TIMESTAMPTZ DEFAULT now(), -- Last time thought processing ran
    last_evening_reflection TIMESTAMPTZ, -- Last time evening reflection occurred
    thought_processing_enabled BOOLEAN DEFAULT TRUE -- Whether thought processing is enabled
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
    embedding vector(1536), -- OpenAI embedding vector (1536 dimensions)
    thought_triggered BOOLEAN DEFAULT FALSE -- Whether this memory was triggered by a thought
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
    contention_state VARCHAR(20) DEFAULT 'open', -- ('open', 'conflicted', 'focused', 'exclusive')
    relationship_status VARCHAR(50) DEFAULT 'acquaintance', -- ('acquaintance', 'friend', 'close_friend', 'romantic_interest', 'dating', 'estranged')
    PRIMARY KEY (agent_id, character_id)
);

-- Player Reputations (for social influence system)
CREATE TABLE player_reputations (
    character_id UUID PRIMARY KEY REFERENCES characters(id),
    reputation_score INT DEFAULT 50, -- Starts at a neutral 50 on a 0-100 scale
    reputation_notes TEXT DEFAULT 'No reputation established yet',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create a view to map agent_reputations to player_reputations for backward compatibility
-- This allows queries looking for agent_reputations to work without code changes
CREATE OR REPLACE VIEW agent_reputations AS
SELECT 
    character_id,
    character_id as agent_id,  -- Map character_id to agent_id for compatibility
    reputation_score,
    reputation_notes,
    created_at,
    updated_at
FROM player_reputations;

-- Add comment explaining the view
COMMENT ON VIEW agent_reputations IS 'Compatibility view mapping player_reputations to agent_reputations for legacy queries';

-- Gossip Logs (for social manipulation tracking)
CREATE TABLE gossip_logs (
    id BIGSERIAL PRIMARY KEY,
    source_character_id UUID REFERENCES characters(id) NOT NULL,
    target_character_id UUID REFERENCES characters(id) NOT NULL, -- The player being gossiped about
    npc_listener_id VARCHAR(50) REFERENCES agents(id) NOT NULL,
    content TEXT NOT NULL,
    is_positive BOOLEAN NOT NULL,
    credibility_score INT DEFAULT 50, -- How much the NPC believes it (0-100)
    timestamp TIMESTAMPTZ DEFAULT now()
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

-- Indexes for new relationship system tables
CREATE INDEX idx_player_reputations_character_id ON player_reputations(character_id);
CREATE INDEX idx_player_reputations_reputation_score ON player_reputations(reputation_score);

CREATE INDEX idx_gossip_logs_source_character_id ON gossip_logs(source_character_id);
CREATE INDEX idx_gossip_logs_target_character_id ON gossip_logs(target_character_id);
CREATE INDEX idx_gossip_logs_npc_listener_id ON gossip_logs(npc_listener_id);
CREATE INDEX idx_gossip_logs_timestamp ON gossip_logs(timestamp);

-- Composite indexes for common relationship system queries
CREATE INDEX idx_gossip_logs_target_npc_time ON gossip_logs(target_character_id, npc_listener_id, timestamp);
CREATE INDEX idx_agent_player_relationships_contention ON agent_player_relationships(contention_state);
CREATE INDEX idx_agent_player_relationships_status ON agent_player_relationships(relationship_status);

-- ============================================
-- THOUGHT SYSTEM SCHEMA
-- ============================================

-- Table for conversation intentions (when NPCs want to initiate conversations)
CREATE TABLE conversation_intentions (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id) NOT NULL,
    target VARCHAR(100) NOT NULL, -- Player ID or agent ID
    topic TEXT NOT NULL,
    approach TEXT NOT NULL,
    timing VARCHAR(50) NOT NULL, -- 'immediate', 'soon', specific time
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT now(),
    executed_at TIMESTAMPTZ
);

-- Table for thought tracking and logging
CREATE TABLE agent_thoughts (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id) NOT NULL,
    thought_type VARCHAR(50) NOT NULL, -- 'immediate_interruption', 'scheduled_activity', etc.
    trigger_type VARCHAR(50) NOT NULL, -- 'external_event', 'internal_reflection', etc.
    trigger_data JSONB NOT NULL,
    decision TEXT NOT NULL,
    action_type VARCHAR(50), -- 'immediate_activity', 'schedule_activity', etc.
    action_details JSONB,
    reasoning TEXT NOT NULL,
    importance INT NOT NULL,
    urgency INT NOT NULL,
    confidence INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'executed', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT now(),
    executed_at TIMESTAMPTZ
);

-- Table for tracking daily thought limits
CREATE TABLE thought_limits (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id) NOT NULL,
    date DATE NOT NULL,
    personality_changes_count INT DEFAULT 0,
    goal_changes_count INT DEFAULT 0,
    spontaneous_conversations_count INT DEFAULT 0,
    total_thoughts_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, date)
);

-- Create thought processing queue table for Redis backup
CREATE TABLE thought_processing_queue (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id) NOT NULL,
    queue_type VARCHAR(50) NOT NULL, -- 'immediate', 'scheduled', 'evening_reflection'
    trigger_data JSONB NOT NULL,
    priority INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);



-- Add indexes for thought system performance
CREATE INDEX idx_conversation_intentions_agent_id ON conversation_intentions(agent_id);
CREATE INDEX idx_conversation_intentions_status ON conversation_intentions(status);
CREATE INDEX idx_agent_thoughts_agent_id ON agent_thoughts(agent_id);
CREATE INDEX idx_agent_thoughts_thought_type ON agent_thoughts(thought_type);
CREATE INDEX idx_agent_thoughts_created_at ON agent_thoughts(created_at);
CREATE INDEX idx_thought_limits_agent_date ON thought_limits(agent_id, date);
CREATE INDEX idx_thought_processing_queue_agent_id ON thought_processing_queue(agent_id);
CREATE INDEX idx_thought_processing_queue_status ON thought_processing_queue(status);
CREATE INDEX idx_thought_processing_queue_priority ON thought_processing_queue(priority DESC);

-- ============================================
-- SPEED DATING SYSTEM SCHEMA
-- ============================================

-- Add personality_seed column to agents table for procedural generation
ALTER TABLE agents ADD COLUMN personality_seed TEXT;

-- Speed dating events table
CREATE TABLE speed_dating_events (
    id BIGINT PRIMARY KEY, -- Custom IDs from game server
    event_name VARCHAR(100) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_participants INT DEFAULT 10,
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'cancelled'
    location VARCHAR(100) DEFAULT 'town_square',
    season_theme VARCHAR(100), -- Theme for the social season
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Event participants (both players and NPCs)
CREATE TABLE event_participants (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES speed_dating_events(id) ON DELETE CASCADE,
    participant_type VARCHAR(10) NOT NULL, -- 'player' or 'npc'
    participant_id VARCHAR(50) NOT NULL, -- character_id or agent_id
    registration_time TIMESTAMPTZ DEFAULT now(),
    attendance_status VARCHAR(20) DEFAULT 'registered', -- 'registered', 'present', 'absent'
    UNIQUE(event_id, participant_id)
);

-- Individual speed dating matches within an event
CREATE TABLE speed_dating_matches (
    id BIGINT PRIMARY KEY, -- Custom IDs from game server
    event_id BIGINT REFERENCES speed_dating_events(id) ON DELETE CASCADE,
    player_id VARCHAR(50) NOT NULL, -- Player session ID from game server
    npc_id VARCHAR(50) REFERENCES agents(id),
    match_order INT NOT NULL, -- Order in the gauntlet (1st, 2nd, 3rd, etc.)
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_seconds INT DEFAULT 300, -- 5 minutes per date
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'skipped'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Real-time vibe scores during dates
CREATE TABLE date_vibe_scores (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT REFERENCES speed_dating_matches(id) ON DELETE CASCADE,
    player_message TEXT NOT NULL,
    npc_response TEXT,
    vibe_score INT NOT NULL, -- -10 to +10 scale
    vibe_reason TEXT, -- LLM-generated explanation of score
    keyword_matches TEXT[], -- Keywords that triggered the score
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Post-date LLM assessments
CREATE TABLE date_assessments (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT REFERENCES speed_dating_matches(id) ON DELETE CASCADE,
    conversation_transcript TEXT NOT NULL,
    overall_score INT NOT NULL, -- 0-100 scale
    chemistry_score INT NOT NULL, -- 0-100 scale
    compatibility_score INT NOT NULL, -- 0-100 scale
    personality_match_score INT NOT NULL, -- 0-100 scale
    assessment_reasoning TEXT NOT NULL,
    highlighted_moments TEXT[], -- Key positive/negative moments
    npc_perspective TEXT, -- How the NPC felt about the date
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Gauntlet results and NPC rankings
CREATE TABLE gauntlet_results (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES speed_dating_events(id) ON DELETE CASCADE,
    player_id VARCHAR(50) NOT NULL, -- Player session ID from game server
    npc_id VARCHAR(50) REFERENCES agents(id),
    final_rank INT NOT NULL, -- NPC's ranking of this player (1 = best)
    overall_impression TEXT NOT NULL, -- NPC's overall thoughts
    attraction_level INT NOT NULL, -- 1-10 scale
    compatibility_rating INT NOT NULL, -- 1-10 scale
    relationship_potential VARCHAR(50), -- 'not_interested', 'friends', 'romantic_interest', 'soulmate'
    confessional_statement TEXT NOT NULL, -- NPC's "confessional" about the player
    reasoning TEXT NOT NULL, -- Detailed explanation of ranking
    memorable_moments TEXT[], -- What stood out to the NPC
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, player_id, npc_id)
);

-- Social season data for themed events
CREATE TABLE social_seasons (
    id BIGSERIAL PRIMARY KEY,
    season_name VARCHAR(100) NOT NULL,
    theme VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    personality_modifiers JSONB, -- JSON object with personality trait modifiers
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Dating system configuration
CREATE TABLE dating_system_config (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default dating system configuration
INSERT INTO dating_system_config (config_key, config_value, description) VALUES
('date_duration_seconds', '300', 'Default duration for each speed date (5 minutes)'),
('vibe_meter_sensitivity', '0.7', 'Sensitivity for real-time vibe scoring (0-1)'),
('max_participants_per_event', '10', 'Maximum participants per speed dating event'),
('gauntlet_reflection_prompt', 'You are {npc_name}. You just finished a speed dating gauntlet where you met several potential romantic partners. Reflect on each person you met and rank them based on your personal preferences, chemistry, and compatibility. Consider your personality traits: {personality_traits}, your likes: {likes}, and your dislikes: {dislikes}. For each person, provide: 1) A ranking (1 being your top choice), 2) Your overall impression, 3) Attraction level (1-10), 4) Compatibility rating (1-10), 5) Relationship potential, and 6) A confessional statement about what you really thought.', 'LLM prompt for post-gauntlet NPC reflection'),
('scoring_prompt', 'You are an expert at analyzing romantic compatibility and chemistry. You have been given a conversation transcript between {npc_name} and {player_name} from a speed dating session. {npc_name} has the following traits: {npc_traits}, likes: {npc_likes}, and dislikes: {npc_dislikes}. Analyze the conversation for: 1) Overall chemistry and connection (0-100), 2) Compatibility based on shared interests and values (0-100), 3) Personality match and communication style (0-100), 4) Overall date success score (0-100). Provide reasoning for each score and highlight the most positive and negative moments.', 'LLM prompt for post-date scoring');

-- Create indexes for dating system performance
CREATE INDEX idx_speed_dating_events_date_status ON speed_dating_events(event_date, status);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_participant_id ON event_participants(participant_id);
CREATE INDEX idx_speed_dating_matches_event_id ON speed_dating_matches(event_id);
CREATE INDEX idx_speed_dating_matches_player_npc ON speed_dating_matches(player_id, npc_id);
CREATE INDEX idx_speed_dating_matches_status ON speed_dating_matches(status);
CREATE INDEX idx_date_vibe_scores_match_id ON date_vibe_scores(match_id);
CREATE INDEX idx_date_vibe_scores_timestamp ON date_vibe_scores(timestamp);
CREATE INDEX idx_date_assessments_match_id ON date_assessments(match_id);
CREATE INDEX idx_gauntlet_results_event_player ON gauntlet_results(event_id, player_id);
CREATE INDEX idx_gauntlet_results_npc_rank ON gauntlet_results(npc_id, final_rank);
CREATE INDEX idx_social_seasons_dates ON social_seasons(start_date, end_date);
CREATE INDEX idx_dating_system_config_key ON dating_system_config(config_key);


-- Migration 003: Fix vibe_reason column type
-- The vibe_reason column was too small (VARCHAR(100)) for LLM-generated reasons

ALTER TABLE date_vibe_scores 
ALTER COLUMN vibe_reason TYPE TEXT;

-- Add comment to clarify purpose
COMMENT ON COLUMN date_vibe_scores.vibe_reason IS 'LLM-generated explanation of the vibe score change'; 