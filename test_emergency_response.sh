#!/bin/bash

echo "🚨 Testing Emergency Response System 🚨"
echo "======================================="

# Base URL for the web API
BASE_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_emergency_response() {
    local agent_id="$1"
    local agent_name="$2"
    local player_message="$3"
    local expected_urgency="$4"
    local test_description="$5"
    
    echo -e "\n${YELLOW}🧪 Testing: ${test_description}${NC}"
    echo "Agent: ${agent_name}"
    echo "Message: \"${player_message}\""
    echo "Expected urgency: ${expected_urgency}"
    echo "---"
    
    # Simulate conversation with agent
    response=$(curl -s -X POST "${BASE_URL}/npc/interact" \
        -H "Content-Type: application/json" \
        -d "{
            \"npcId\": \"${agent_id}\",
            \"message\": \"${player_message}\",
            \"characterId\": \"test_player_emergency\"
        }")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Conversation sent successfully${NC}"
        echo "Response: $response"
        
        # Wait for processing and rate limiting
        sleep 8
        
        # Check if emergency metacognition was triggered
        echo "Checking for emergency metacognition..."
        metacognition_response=$(curl -s -X GET "${BASE_URL}/metacognition/history/${agent_id}")
        
        if echo "$metacognition_response" | grep -q "urgent"; then
            echo -e "${GREEN}✅ Emergency metacognition triggered${NC}"
        else
            echo -e "${RED}❌ Emergency metacognition not triggered${NC}"
        fi
        
        # Check for schedule modifications
        echo "Checking for schedule modifications..."
        schedule_response=$(curl -s -X GET "${BASE_URL}/metacognition/schedule-modifications/${agent_id}")
        
        if echo "$schedule_response" | grep -q "emergency\|urgent\|immediate"; then
            echo -e "${GREEN}✅ Emergency schedule modifications found${NC}"
        else
            echo -e "${RED}❌ No emergency schedule modifications found${NC}"
        fi
        
    else
        echo -e "${RED}❌ Failed to send conversation${NC}"
    fi
    
    echo "---"
    
    # Wait between tests to avoid rate limiting
    sleep 2
}

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Test 1: Dr. Helena - Medical Emergency (should trigger immediate response)
test_emergency_response \
    "dr_helena" \
    "Dr. Helena" \
    "Doctor! There's a man dying in the barn behind the church! He's bleeding badly and needs immediate help!" \
    "10" \
    "Medical emergency - should trigger immediate response"

# Test 2: Fire Chief - Fire Emergency (should trigger immediate response)
test_emergency_response \
    "captain_finn" \
    "Captain Finn" \
    "Captain! The fire station is burning down! There's a huge fire and we need help immediately!" \
    "10" \
    "Fire emergency - should trigger immediate response"

# Test 3: Regular person - Ice cream (should not trigger emergency)
test_emergency_response \
    "isabella_baker" \
    "Isabella Baker" \
    "Hey Isabella, there's ice cream being sold on main street. Thought you might be interested." \
    "1-3" \
    "Ice cream information - should not trigger emergency"

# Test 4: Officer Blake - Crime Emergency (should trigger immediate response)
test_emergency_response \
    "officer_blake" \
    "Officer Blake" \
    "Officer! There's been a robbery at the market! The thief is still there and people are hurt!" \
    "10" \
    "Crime emergency - should trigger immediate response"

# Test 5: Regular conversation - Weather (should not trigger emergency)
test_emergency_response \
    "thomas_tavern_keeper" \
    "Thomas" \
    "Nice weather today, isn't it? Perfect for a drink at the tavern." \
    "1-2" \
    "Weather conversation - should not trigger emergency"

echo -e "\n${GREEN}🎯 Emergency Response System Test Complete!${NC}"
echo "======================================="
echo "Check the logs above to see if the emergency system is working correctly."
echo ""
echo "Key things to look for:"
echo "1. High urgency conversations (medical, fire, crime) should trigger immediate metacognition"
echo "2. Emergency schedule modifications should be created with high priority"
echo "3. Regular conversations should not trigger emergency responses"
echo "4. Agents should respond appropriately based on their professional roles"
echo ""
echo "You can also check the system logs for detailed emergency processing messages." 