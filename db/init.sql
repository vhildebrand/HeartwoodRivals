-- db/init.sql
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

-- NPCs table to store NPC data and constitutions
CREATE TABLE npcs (
    id VARCHAR(50) PRIMARY KEY, -- e.g., "elara_the_blacksmith"
    name VARCHAR(100) NOT NULL,
    constitution TEXT NOT NULL, -- Base prompt/personality
    x_position INT DEFAULT 0,
    y_position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- NPC Relationship Tracking
CREATE TABLE npc_relationships (
    character_id UUID REFERENCES characters(id),
    npc_id VARCHAR(50) REFERENCES npcs(id),
    affection_score INT DEFAULT 0,
    PRIMARY KEY (character_id, npc_id)
);

-- Conversation Logs
CREATE TABLE conversation_logs (
    id BIGSERIAL PRIMARY KEY,
    character_id UUID REFERENCES characters(id),
    npc_id VARCHAR(50) REFERENCES npcs(id),
    player_message TEXT,
    npc_response TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Insert a test NPC for Sprint 3
INSERT INTO npcs (id, name, constitution, x_position, y_position) VALUES (
    'elara_blacksmith',
    'Elara',
    'You are Elara, a shy and thoughtful blacksmith in a small valley town. You have a gentle personality and speak in short, thoughtful sentences. You love flowers and nature, but you dislike loud noises and crowds. You are secretly worried about the failing economy of the town but try to stay optimistic. You are skilled at your craft and take pride in your work. When someone approaches you, you are polite but initially reserved until you get to know them better. You often pause before speaking, choosing your words carefully.',
    8,
    6
);
