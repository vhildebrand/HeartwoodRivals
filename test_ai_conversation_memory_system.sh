#!/bin/bash

# Test script for AI Conversation, Memory, and Thought System
# This tests how NPCs form memories, process thoughts, and change schedules

echo "🧠 Testing AI Conversation and Memory System"
echo "============================================"

# Configuration
BASE_URL="http://localhost:3000"
PLAYER_ID="test_player_123"
NPC_ID="elara_blacksmith"
NPC_NAME="Elara"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==== $1 ====${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test 1: Check baseline memory state
print_step "Test 1: Check baseline memory state"
echo "Getting initial memory state for $NPC_NAME..."
curl -s "$BASE_URL/memory/debug-memories/$NPC_ID" | jq '.memories | length' > /tmp/initial_memory_count.txt
INITIAL_COUNT=$(cat /tmp/initial_memory_count.txt)
print_success "Initial memory count: $INITIAL_COUNT"

# Test 2: Test casual conversation (should create memory but not trigger schedule change)
print_step "Test 2: Casual conversation test"
echo "Testing casual conversation that should NOT trigger schedule changes..."

CASUAL_RESPONSE=$(curl -s -X POST "$BASE_URL/npc/interact" \
  -H "Content-Type: application/json" \
  -d "{
    \"npcId\": \"$NPC_ID\",
    \"message\": \"Hello Elara! How's your day going?\",
    \"characterId\": \"$PLAYER_ID\"
  }")

JOB_ID=$(echo "$CASUAL_RESPONSE" | jq -r '.jobId')
print_success "Casual conversation job created: $JOB_ID"

# Wait for job completion
echo "Waiting for response..."
sleep 5

CASUAL_RESULT=$(curl -s "$BASE_URL/npc/conversation/$JOB_ID")
echo "Response: $(echo "$CASUAL_RESULT" | jq -r '.response')"

# Test 3: Test urgent conversation (should trigger schedule change)
print_step "Test 3: Urgent conversation test"
echo "Testing urgent conversation that SHOULD trigger schedule changes..."

URGENT_RESPONSE=$(curl -s -X POST "$BASE_URL/npc/interact" \
  -H "Content-Type: application/json" \
  -d "{
    \"npcId\": \"$NPC_ID\",
    \"message\": \"Elara! There's a fire at the church! Can you help make emergency repair tools?\",
    \"characterId\": \"$PLAYER_ID\"
  }")

JOB_ID=$(echo "$URGENT_RESPONSE" | jq -r '.jobId')
print_success "Urgent conversation job created: $JOB_ID"

# Wait for job completion
echo "Waiting for response..."
sleep 5

URGENT_RESULT=$(curl -s "$BASE_URL/npc/conversation/$JOB_ID")
echo "Response: $(echo "$URGENT_RESULT" | jq -r '.response')"

# Test 4: Check memory formation
print_step "Test 4: Check memory formation"
echo "Checking if memories were formed from conversations..."
sleep 3

NEW_MEMORIES=$(curl -s "$BASE_URL/memory/debug-memories/$NPC_ID" | jq '.memories | length')
MEMORY_DIFFERENCE=$((NEW_MEMORIES - INITIAL_COUNT))
print_success "New memories formed: $MEMORY_DIFFERENCE (Total: $NEW_MEMORIES)"

# Show recent memories
echo "Recent memories:"
curl -s "$BASE_URL/memory/debug-memories/$NPC_ID" | jq -r '.memories[] | select(.timestamp > (now - 300)) | "- \(.memory_type): \(.content)"' | head -5

# Test 5: Check thought system processing
print_step "Test 5: Check thought system processing"
echo "Checking thought system processing..."
sleep 2

THOUGHT_STATS=$(curl -s "$BASE_URL/thought/stats/$NPC_ID")
echo "Thought system stats:"
echo "$THOUGHT_STATS" | jq '.'

# Test 6: Test another NPC's awareness
print_step "Test 6: Test NPC awareness system"
echo "Testing how other NPCs observe activities..."

# Check what other NPCs are aware of
AWARENESS_STATS=$(curl -s "$BASE_URL/awareness/stats")
echo "Awareness system stats:"
echo "$AWARENESS_STATS" | jq '.'

# Test 7: Check for schedule modifications
print_step "Test 7: Check for schedule modifications"
echo "Checking if urgent conversation triggered schedule changes..."
sleep 5

# Check recent plans
RECENT_PLANS=$(curl -s "$BASE_URL/npc/debug-plans/$NPC_ID")
echo "Recent plans:"
echo "$RECENT_PLANS" | jq -r '.plans[] | select(.created_at > (now - 300) | todate) | "- \(.goal) (Priority: \(.priority))"' | head -3

# Test 8: Test memory retrieval in conversation
print_step "Test 8: Test memory-informed conversation"
echo "Testing how memories influence future conversations..."

MEMORY_TEST_RESPONSE=$(curl -s -X POST "$BASE_URL/npc/interact" \
  -H "Content-Type: application/json" \
  -d "{
    \"npcId\": \"$NPC_ID\",
    \"message\": \"Do you remember what we talked about earlier?\",
    \"characterId\": \"$PLAYER_ID\"
  }")

JOB_ID=$(echo "$MEMORY_TEST_RESPONSE" | jq -r '.jobId')
sleep 5

MEMORY_RESULT=$(curl -s "$BASE_URL/npc/conversation/$JOB_ID")
echo "Memory-informed response: $(echo "$MEMORY_RESULT" | jq -r '.response')"

# Test 9: Test NPC-to-NPC awareness
print_step "Test 9: Test NPC-to-NPC observation"
echo "Testing NPC awareness of other NPCs..."

# Trigger observation
OBSERVATION_TRIGGER=$(curl -s -X POST "$BASE_URL/awareness/trigger-observation" \
  -H "Content-Type: application/json" \
  -d "{
    \"observerId\": \"$NPC_ID\",
    \"targetId\": \"thomas_tavern_keeper\",
    \"activity\": \"serving drinks at the tavern\"
  }")

echo "Observation trigger result: $OBSERVATION_TRIGGER"

# Test 10: Final system state check
print_step "Test 10: Final system state check"
echo "Final system state summary:"

# Memory stats
FINAL_MEMORY_COUNT=$(curl -s "$BASE_URL/memory/stats/$NPC_ID" | jq '.total_memories')
echo "Total memories: $FINAL_MEMORY_COUNT"

# Thought processing stats
FINAL_THOUGHTS=$(curl -s "$BASE_URL/thought/stats/$NPC_ID" | jq '.total_thoughts_today')
echo "Thoughts processed today: $FINAL_THOUGHTS"

# Plans generated
FINAL_PLANS=$(curl -s "$BASE_URL/npc/debug-plans/$NPC_ID" | jq '.plans | length')
echo "Total plans: $FINAL_PLANS"

print_success "AI Conversation and Memory System test completed!"
print_warning "Check the logs for detailed processing information"

echo ""
echo "🔍 Key things to observe:"
echo "1. Memory formation from conversations"
echo "2. Thought system processing triggers"
echo "3. Schedule modifications for urgent situations"
echo "4. NPC awareness and observation system"
echo "5. Memory-informed conversation responses" 