-- Migration 001: Relationship System Foundation
-- This migration adds the foundational schema changes for the competitive social & relationship system

-- Add new columns to existing agent_player_relationships table
ALTER TABLE agent_player_relationships
ADD COLUMN IF NOT EXISTS contention_state VARCHAR(20) DEFAULT 'open', -- ('open', 'conflicted', 'focused', 'exclusive')
ADD COLUMN IF NOT EXISTS relationship_status VARCHAR(50) DEFAULT 'acquaintance'; -- ('acquaintance', 'friend', 'close_friend', 'romantic_interest', 'dating', 'estranged')

-- Create new player_reputations table
CREATE TABLE IF NOT EXISTS player_reputations (
    character_id UUID PRIMARY KEY REFERENCES characters(id),
    reputation_score INT DEFAULT 50, -- Starts at a neutral 50 on a 0-100 scale
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Create new gossip_logs table
CREATE TABLE IF NOT EXISTS gossip_logs (
    id BIGSERIAL PRIMARY KEY,
    source_character_id UUID REFERENCES characters(id) NOT NULL,
    target_character_id UUID REFERENCES characters(id) NOT NULL, -- The player being gossiped about
    npc_listener_id VARCHAR(50) REFERENCES agents(id) NOT NULL,
    content TEXT NOT NULL,
    is_positive BOOLEAN NOT NULL,
    credibility_score INT DEFAULT 50, -- How much the NPC believes it (0-100)
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_player_reputations_character_id ON player_reputations(character_id);
CREATE INDEX IF NOT EXISTS idx_player_reputations_reputation_score ON player_reputations(reputation_score);

CREATE INDEX IF NOT EXISTS idx_gossip_logs_source_character_id ON gossip_logs(source_character_id);
CREATE INDEX IF NOT EXISTS idx_gossip_logs_target_character_id ON gossip_logs(target_character_id);
CREATE INDEX IF NOT EXISTS idx_gossip_logs_npc_listener_id ON gossip_logs(npc_listener_id);
CREATE INDEX IF NOT EXISTS idx_gossip_logs_timestamp ON gossip_logs(timestamp);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gossip_logs_target_npc_time ON gossip_logs(target_character_id, npc_listener_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_player_relationships_contention ON agent_player_relationships(contention_state);
CREATE INDEX IF NOT EXISTS idx_agent_player_relationships_status ON agent_player_relationships(relationship_status); 