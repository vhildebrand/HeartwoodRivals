# Sprint 3 Testing Documentation

## Overview

This document provides comprehensive testing instructions for Sprint 3 of the Competitive Social & Relationship System, which includes:

1. **Conversational Gossip Analysis** - NPCs detect and analyze gossip in player conversations
2. **Player Text Interface** - Players can make public statements and update their activity status
3. **Enhanced Reputation System** - Player reputations are updated based on gossip and witnessed actions
4. **Memory Integration** - NPCs create memories from gossip and public player actions

## Test Files

### 1. `test_sprint3_gossip_system.js`
Tests the core gossip detection and analysis functionality.

### 2. `test_sprint3_player_text_interface.js`
Tests the player text interface features (public speech and activity updates).

## Prerequisites

Before running tests, ensure the following services are running:

1. **Docker Compose Services**: 
   ```bash
   docker-compose up
   ```

2. **Database**: PostgreSQL with all Sprint 1 and 2 migrations applied
3. **Redis**: For job queue processing and caching
4. **Web API**: Running on port 3000
5. **Game Server**: Running on port 2567

## Running Tests

### Quick Test Execution

```bash
# Run gossip system tests
cd web-api
node test_sprint3_gossip_system.js

# Run player text interface tests
node test_sprint3_player_text_interface.js
```

### Individual Test Categories

#### Gossip System Tests
```bash
node test_sprint3_gossip_system.js
```

**Tests included:**
- ✅ Positive gossip detection
- ✅ Negative gossip detection
- ✅ No gossip detection (false positives)
- ✅ Gossip logging to database
- ✅ Reputation updates from gossip
- ✅ NPC memory creation from gossip
- ✅ Credibility calculation based on trust levels

#### Player Text Interface Tests
```bash
node test_sprint3_player_text_interface.js
```

**Tests included:**
- ✅ Public speech action processing
- ✅ Activity update action processing
- ✅ Public speech memory creation
- ✅ Activity update memory creation
- ✅ Witnessable event tagging
- ✅ Memory importance scoring
- ✅ Nearby NPC detection

## Manual Testing

### Testing Gossip System

1. **Start the system:**
   ```bash
   docker-compose up
   ```

2. **Open the game client** (http://localhost:5173)

3. **Test positive gossip:**
   - Approach an NPC (press E to interact)
   - Say: "Alice is really helpful and kind to everyone"
   - Check database for gossip log entry
   - Verify NPC created a memory about Alice

4. **Test negative gossip:**
   - Say: "Bob has been really rude to the merchants"
   - Check that gossip is logged as negative
   - Verify reputation impact

5. **Test no gossip:**
   - Say: "Hello! How are you today?"
   - Verify no gossip is detected or logged

### Testing Player Text Interface

1. **Test public speech:**
   - Press `T` key to activate speech input
   - Type: "Hello everyone! I'm working on my farm today"
   - Press Enter to submit
   - Check console for processing logsdock
   - Verify nearby NPCs create memories

2. **Test activity updates:**
   - Press `Y` key to activate activity input
   - Type: "crafting some tools"
   - Press Enter to submit
   - Check that NPCs nearby create activity memories

3. **Test UI controls:**
   - Press `Escape` to cancel input
   - Verify input boxes appear/disappear correctly
   - Test that dialogue prevents text input activation

4. **Test hotkey prevention:**
   - Open an HTML input field (like browser search bar)
   - Type `T` or `Y` while focused on the input field
   - Verify that the speech/activity interface does NOT activate
   - Use `client/test_hotkey_prevention.html` for comprehensive testing

## Expected Results

### Gossip System
- **Positive gossip**: `is_positive = true` in gossip_logs, reputation increases
- **Negative gossip**: `is_positive = false` in gossip_logs, reputation decreases
- **High trust speakers**: Higher credibility scores
- **Low trust speakers**: Lower credibility scores
- **Memory creation**: NPCs create memories tagged with 'gossip'

### Player Text Interface
- **Public speech**: Creates memories with 'public_speech' tag, importance = 9
- **Activity updates**: Creates memories with 'activity_update' tag, importance = 8
- **Witnessable events**: All events tagged as 'witnessable_social_event'
- **Nearby detection**: Only NPCs within range create memories

## Database Verification

### Check Gossip Logs
```sql
SELECT * FROM gossip_logs 
ORDER BY timestamp DESC 
LIMIT 10;
```

### Check NPC Memories
```sql
SELECT agent_id, content, tags, importance_score 
FROM agent_memories 
WHERE tags && ARRAY['gossip', 'public_speech', 'activity_update']
ORDER BY timestamp DESC 
LIMIT 20;
```

### Check Reputation Changes
```sql
SELECT character_id, reputation_score, last_updated 
FROM player_reputations 
ORDER BY last_updated DESC;
```

## Debugging

### Common Issues

1. **Tests fail with "Connection refused"**
   - Ensure Docker services are running
   - Check ports 3000, 2567, 5432, 6379 are available

2. **No gossip detected**
   - Check LLM response format
   - Verify prompt construction
   - Check OpenAI API key configuration

3. **No memories created**
   - Verify AgentObservationSystem is running
   - Check Redis pub/sub connectivity
   - Verify database connections

### Logging

Enable debug logging by setting environment variable:
```bash
export DEBUG=true
```

### Database Queries for Debugging

```sql
-- Check recent agent memories
SELECT agent_id, content, tags, importance_score, timestamp 
FROM agent_memories 
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Check gossip logs
SELECT source_character_id, target_character_id, content, is_positive, credibility_score
FROM gossip_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Check player reputations
SELECT character_id, reputation_score, last_updated 
FROM player_reputations;
```

## Integration Testing

### End-to-End Scenario

1. **Player A** talks to NPC Elara about **Player B**:
   - "Player B is really skilled at crafting"
   - Verify gossip logged with positive sentiment
   - Check Player B's reputation increases

2. **Player B** makes public speech:
   - Press T, say "I'm working on improving my crafting skills"
   - Verify nearby NPCs create memories
   - Check memories have correct tags and importance

3. **Player A** updates activity:
   - Press Y, type "helping other players with their projects"
   - Verify witnessable event processing
   - Check reputation impact from witnessed helpful behavior

### Performance Testing

Run tests with multiple concurrent actions:
```bash
# Run both test suites simultaneously
node test_sprint3_gossip_system.js & node test_sprint3_player_text_interface.js
```

## Troubleshooting

### Failed Tests

1. **Gossip detection fails**:
   - Check OpenAI API key
   - Verify LLM response parsing
   - Check prompt construction

2. **Memory creation fails**:
   - Verify AgentObservationSystem initialization
   - Check Redis connectivity
   - Verify database schema

3. **UI not responding**:
   - Check browser console for errors
   - Verify event listeners setup
   - Check WebSocket connection

4. **Hotkeys activating while typing**:
   - Verify `isTypingInHtmlInput()` function is working
   - Check if focus detection is working properly
   - Test with different input types (text, password, email, etc.)
   - Ensure contenteditable elements are detected

### Performance Issues

1. **Slow test execution**:
   - Increase Redis polling intervals
   - Optimize database queries
   - Use connection pooling

2. **Memory leaks**:
   - Ensure proper cleanup in tests
   - Check for unclosed connections
   - Monitor memory usage

## Success Criteria

All tests should pass with:
- ✅ Gossip correctly detected and classified
- ✅ Player reputation updates working
- ✅ NPC memories created with correct tags
- ✅ Player text interface functional
- ✅ Witnessable events processed
- ✅ Database integrity maintained

## Next Steps

After Sprint 3 testing is complete:
1. Run full regression tests for Sprints 1-3
2. Prepare for Sprint 4 (Romantic Contention Model)
3. Performance optimization based on test results
4. Documentation updates for production deployment 