-- Migration 003: Fix vibe_reason column type
-- The vibe_reason column was too small (VARCHAR(100)) for LLM-generated reasons

ALTER TABLE date_vibe_scores 
ALTER COLUMN vibe_reason TYPE TEXT;

-- Add comment to clarify purpose
COMMENT ON COLUMN date_vibe_scores.vibe_reason IS 'LLM-generated explanation of the vibe score change'; 