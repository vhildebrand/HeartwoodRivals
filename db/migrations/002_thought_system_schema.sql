-- Thought System Schema Migration
-- Adds tables and columns needed for the unified thought system

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

-- Add indexes for performance
CREATE INDEX idx_conversation_intentions_agent_id ON conversation_intentions(agent_id);
CREATE INDEX idx_conversation_intentions_status ON conversation_intentions(status);
CREATE INDEX idx_agent_thoughts_agent_id ON agent_thoughts(agent_id);
CREATE INDEX idx_agent_thoughts_thought_type ON agent_thoughts(thought_type);
CREATE INDEX idx_agent_thoughts_created_at ON agent_thoughts(created_at);
CREATE INDEX idx_thought_limits_agent_date ON thought_limits(agent_id, date);

-- Add thought tracking column to existing agent_memories table
ALTER TABLE agent_memories ADD COLUMN thought_triggered BOOLEAN DEFAULT FALSE;

-- Update agent table to track last thought processing times
ALTER TABLE agents ADD COLUMN last_thought_processing TIMESTAMPTZ DEFAULT now();
ALTER TABLE agents ADD COLUMN last_evening_reflection TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN thought_processing_enabled BOOLEAN DEFAULT TRUE;

-- Insert default thought limits for existing agents
INSERT INTO thought_limits (agent_id, date, personality_changes_count, goal_changes_count, spontaneous_conversations_count, total_thoughts_count)
SELECT id, CURRENT_DATE, 0, 0, 0, 0 FROM agents
ON CONFLICT (agent_id, date) DO NOTHING;

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

CREATE INDEX idx_thought_processing_queue_agent_id ON thought_processing_queue(agent_id);
CREATE INDEX idx_thought_processing_queue_status ON thought_processing_queue(status);
CREATE INDEX idx_thought_processing_queue_priority ON thought_processing_queue(priority DESC); 