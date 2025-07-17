# Sprint 2 Testing Suite: Witness & Reputation System

This document describes the testing suite for Sprint 2 of the Competitive Social & Relationship System, which focuses on the **Witness & Reputation System**.

## Overview

Sprint 2 implements:
- **Witnessable Social Events**: NPCs can observe and record player actions
- **High-importance Memories**: Witnessed events are stored with high importance (score: 9)
- **Reputation Updates**: Player reputation changes based on witnessed positive/negative actions
- **Reputation-influenced Interactions**: NPC greetings and dialogue adapt based on player reputation

## Test Suite Files

### 1. `test_witness_system.js`
**Purpose**: Integration test for the complete witness system flow

**Tests**:
- Gift giving event recording
- NPC witness memory creation
- High-importance memory scoring
- Reputation updates from witnessed events
- Negative behavior tracking
- Gossip log generation

**Usage**:
```bash
cd web-api
node test_witness_system.js
```

### 2. `test_reputation_changes.js`
**Purpose**: Comprehensive testing of reputation score changes

**Tests**:
- Positive reputation changes
- Negative reputation changes
- Boundary conditions (0-100 caps)
- Reputation statistics
- Multiple player tracking
- Reputation tier classifications

**Usage**:
```bash
cd web-api
node test_reputation_changes.js
```

## Test Environment Setup

### Prerequisites
- Docker containers running (postgres, redis, web-api)
- Database initialized with latest schema
- Environment variables configured

### Running the Tests

1. **Start the development environment**:
   ```bash
   docker-compose up
   ```

2. **Apply database migrations** (if needed):
   ```bash
   cd db
   node apply_migration.js
   ```

3. **Run individual tests**:
   ```bash
   cd web-api
   node test_witness_system.js
   node test_reputation_changes.js
   ```

## Test Results Interpretation

### Witness System Test Results

**Expected Outputs**:
- ✅ Witness memory created with high importance (9)
- ✅ Memory tagged as `witnessable_social_event`
- ✅ Reputation increased for positive actions (+2 to +3)
- ✅ Reputation decreased for negative actions (-2 to -3)
- ✅ Gossip logs generated for social events

**Failure Indicators**:
- ❌ No witness memory found
- ❌ Reputation did not change
- ❌ Incorrect importance scoring
- ❌ Missing witnessable tags

### Reputation Changes Test Results

**Expected Outputs**:
- ✅ All reputation changes match expected values
- ✅ Reputation caps at 0 and 100
- ✅ Statistics show correct calculations
- ✅ Tier classifications work correctly

**Failure Indicators**:
- ❌ Reputation values don't match expectations
- ❌ Boundary caps not working
- ❌ Statistical calculations incorrect

## Integration Points Tested

### 1. AgentObservationSystem → AgentMemoryManager
- Witnessable events create high-importance memories
- Tags are properly attached to memories
- Related players are correctly linked

### 2. AgentObservationSystem → ReputationManager
- Reputation updates triggered by witnessed events
- Positive/negative actions properly classified
- Score changes calculated correctly

### 3. ReputationManager → LLMWorker
- Player reputation retrieved during conversation
- Reputation context added to NPC prompts
- Greetings influenced by reputation scores

## Database Tables Tested

### Core Tables
- `agent_memories`: Witness memories with high importance
- `player_reputations`: Reputation score tracking
- `gossip_logs`: Social event logging
- `agent_player_relationships`: Enhanced with new columns

### Test Data Cleanup
All tests include comprehensive cleanup to prevent data pollution:
- Test users and characters removed
- Reputation records deleted
- Memory entries cleaned up
- Gossip logs cleared

## Performance Considerations

### Memory Usage
- High-importance memories (score: 9) are prioritized for retrieval
- Witnessable events create permanent records
- Reputation updates are immediately persistent

### Redis Integration
- Async event processing via Redis pub/sub
- Test waits (2 seconds) for async processing
- Memory caching for frequently accessed data

## Troubleshooting

### Common Issues

1. **Redis Connection Error**:
   ```bash
   Error: Redis connection failed
   ```
   **Solution**: Ensure Redis container is running and accessible

2. **Database Connection Error**:
   ```bash
   Error: Database connection failed
   ```
   **Solution**: Verify PostgreSQL container and credentials

3. **Missing Tables Error**:
   ```bash
   Error: relation "player_reputations" does not exist
   ```
   **Solution**: Run database migration script

4. **Agent Not Found Error**:
   ```bash
   Error: Agent elara_blacksmith not found
   ```
   **Solution**: Ensure agents are loaded via `load_agents.js`

### Test Debugging

Enable detailed logging:
```javascript
// Add to test files for debugging
console.log('Debug: Current reputation:', await reputationManager.getPlayerReputation(testPlayerId));
console.log('Debug: Recent memories:', await pool.query('SELECT * FROM agent_memories WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT 5', [agentId]));
```

## Next Steps

After successful Sprint 2 testing, proceed to:
- **Sprint 3**: The Gossip System (LLM-based gossip detection)
- **Sprint 4**: The Romantic Contention Model (AI state machine)
- **Sprint 5**: AI-Driven Behavior & Planning (observable actions)
- **Sprint 6**: Polish, Balancing & Player Experience

## API Integration

The tested systems integrate with existing API endpoints:
- `/npc/interact` - Now includes reputation context
- `/memory/test-observation` - Enhanced with witnessable events
- Future: `/reputation/stats` - Reputation monitoring

## Sprint 2 Success Criteria

✅ **All tests passing**
✅ **NPCs witness and record social events**
✅ **Reputation scores update correctly**
✅ **High-importance memories created**
✅ **NPC interactions influenced by reputation**
✅ **System integrates with existing architecture**

The witness and reputation system provides the foundation for Sprint 3's gossip detection and Sprint 4's romantic contention model. 