-- Migration 004: Add player_name column to gauntlet_results table
-- This allows storing and displaying actual player usernames in speed dating results
-- instead of just session IDs

-- Add player_name column to gauntlet_results table
ALTER TABLE gauntlet_results 
ADD COLUMN IF NOT EXISTS player_name VARCHAR(255);

-- Create index for better query performance when filtering by player_name
CREATE INDEX IF NOT EXISTS idx_gauntlet_results_player_name 
ON gauntlet_results(player_name);

-- Update existing records to have a fallback player name based on player_id
UPDATE gauntlet_results 
SET player_name = 'Player_' || SUBSTRING(player_id, 1, 8)
WHERE player_name IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN gauntlet_results.player_name IS 'Display name of the player for speed dating results UI'; 