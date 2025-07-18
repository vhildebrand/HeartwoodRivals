# Manual Test Guide: AI Conversation, Memory, and Thought System

## Prerequisites
1. Start the services: `docker-compose up -d`
2. Wait for all services to be healthy
3. Ensure `jq` is installed for JSON parsing

## Test Sequence Overview

This guide tests the following AI systems:
- **Memory Formation**: How NPCs create and store memories from conversations
- **Thought Processing**: How NPCs process information and make decisions
- **Schedule Modifications**: How urgent situations trigger schedule changes
- **NPC Awareness**: How NPCs observe and react to each other
- **Memory-Informed Conversations**: How past memories influence responses

---

## Step 1: Check System Status

First, verify the API is running:
```bash
curl -X GET "http://localhost:3001/npc/list" | jq
```

Expected: List of available NPCs

---

## Step 2: Check Baseline Memory State

Check Elara's initial memory count:
```bash
curl -s "http://localhost:3001/memory/debug-memories/elara_blacksmith" | jq '.memories | length'
```

**Record this number** - we'll compare it after conversations.

---

## Step 3: Test Casual Conversation (No Schedule Change)

Send a casual message to Elara:
```bash
curl -X POST "http://localhost:3001/npc/interact" \
  -H "Content-Type: application/json" \
  -d '{
    "npcId": "elara_blacksmith",
    "message": "Hello Elara! How is your metalworking going today?",
    "characterId": "test_player_123"
  }'
```

1. **Note the jobId** from the response
2. **Wait 5 seconds** for processing
3. **Check the response**:
   ```bash
   curl -s "http://localhost:3001/npc/conversation/YOUR_JOB_ID" | jq '.response'
   ```

**Expected**: Casual, friendly response about her work

---

## Step 4: Test Urgent Conversation (Should Trigger Schedule Change)

Send an urgent message that should trigger schedule changes:
```bash
curl -X POST "http://localhost:3001/npc/interact" \
  -H "Content-Type: application/json" \
  -d '{
    "npcId": "elara_blacksmith",
    "message": "Elara! There is a fire at the church! Can you help make emergency repair tools right away?",
    "characterId": "test_player_123"
  }'
```

1. **Note the jobId** from the response
2. **Wait 5 seconds** for processing
3. **Check the response**:
   ```bash
   curl -s "http://localhost:3001/npc/conversation/YOUR_JOB_ID" | jq '.response'
   ```

**Expected**: Urgent response indicating she'll help immediately

---

## Step 5: Check Memory Formation

Check if memories were formed from both conversations:
```bash
curl -s "http://localhost:3001/memory/debug-memories/elara_blacksmith" | jq '.memories | length'
```

**Compare with Step 2** - should be higher.

View recent memories:
```bash
curl -s "http://localhost:3001/memory/debug-memories/elara_blacksmith" | jq -r '.memories[] | select(.timestamp > (now - 600)) | "- \(.memory_type): \(.content)"' | head -10
```

**Expected**: Recent conversation memories stored

---

## Step 6: Check Thought System Processing

Check what thoughts were triggered:
```bash
curl -s "http://localhost:3001/thought/stats/elara_blacksmith" | jq
```

**Expected**: Thought processing statistics, including recent thoughts

---

## Step 7: Check Schedule Modifications

Check if urgent conversation triggered schedule changes:
```bash
curl -s "http://localhost:3001/npc/debug-plans/elara_blacksmith" | jq -r '.plans[] | select(.created_at > (now - 600) | todate) | "- \(.goal) (Priority: \(.priority))"'
```

**Expected**: High-priority emergency plans created

---

## Step 8: Test Memory-Informed Conversation

Test if Elara remembers the previous conversations:
```bash
curl -X POST "http://localhost:3001/npc/interact" \
  -H "Content-Type: application/json" \
  -d '{
    "npcId": "elara_blacksmith",
    "message": "Do you remember what we talked about earlier? How are you handling the church situation?",
    "characterId": "test_player_123"
  }'
```

1. **Note the jobId** from the response
2. **Wait 5 seconds** for processing
3. **Check the response**:
   ```bash
   curl -s "http://localhost:3001/npc/conversation/YOUR_JOB_ID" | jq '.response'
   ```

**Expected**: Response that references the fire and emergency tools

---

## Step 9: Test NPC Awareness System

Check the awareness system status:
```bash
curl -s "http://localhost:3001/awareness/stats" | jq
```

Trigger an observation between NPCs:
```bash
curl -X POST "http://localhost:3001/awareness/trigger-observation" \
  -H "Content-Type: application/json" \
  -d '{
    "observerId": "elara_blacksmith",
    "targetId": "thomas_tavern_keeper",
    "activity": "serving drinks at the tavern"
  }'
```

Check observations:
```bash
curl -s "http://localhost:3001/awareness/observations/elara_blacksmith" | jq
```

**Expected**: Recent observations of other NPCs

---

## Step 10: Test with Different NPC

Try the same urgent scenario with a different NPC (like Dr. Helena for medical emergency):
```bash
curl -X POST "http://localhost:3001/npc/interact" \
  -H "Content-Type: application/json" \
  -d '{
    "npcId": "dr_helena",
    "message": "Dr. Helena! There is a medical emergency at the docks! Someone is badly injured!",
    "characterId": "test_player_123"
  }'
```

**Expected**: Different response based on her medical background

---

## What to Observe

### 1. **Memory Formation**
- NPCs store both casual and urgent conversations
- Importance scores vary based on conversation content
- Memories include player ID for personalization

### 2. **Thought Processing**
- Urgent conversations trigger more thought processing
- Different thought types generated (immediate, scheduled, etc.)
- Daily limits prevent over-processing

### 3. **Schedule Modifications**
- Urgent scenarios create high-priority plans
- Emergency activities interrupt normal schedules
- Plans include specific details from conversations

### 4. **NPC Awareness**
- NPCs observe each other's activities
- Observations become memories
- Triggers additional thoughts and interactions

### 5. **Memory-Informed Responses**
- Later conversations reference earlier ones
- Personality and memories influence response tone
- Context accumulates over time

---

## Key Endpoints for Monitoring

- **Memory Debug**: `/memory/debug-memories/{npcId}`
- **Thought Stats**: `/thought/stats/{npcId}`
- **Plan Debug**: `/npc/debug-plans/{npcId}`
- **Awareness Stats**: `/awareness/stats`
- **Conversation Status**: `/npc/conversation/{jobId}`

---

## Expected Behavior Patterns

1. **Casual Conversations**: Generate low-urgency memories, minimal schedule impact
2. **Urgent Conversations**: Generate high-urgency memories, immediate schedule changes
3. **Memory Recall**: NPCs reference past conversations in future interactions
4. **Thought Processing**: More complex conversations trigger more thought processing
5. **Schedule Adaptation**: NPCs adapt their daily plans based on important conversations 