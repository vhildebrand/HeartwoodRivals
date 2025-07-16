#!/bin/bash

# Test script for the Metacognitive System
# This script demonstrates the Sarah/seeds example and other metacognitive features

echo "🧠 Testing the Metacognitive System"
echo "======================================"

# Base URL for the API
BASE_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}🔷 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to make API call and show response
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    print_step "$description"
    echo "📤 $method $endpoint"
    
    if [ -n "$data" ]; then
        echo "📋 Data: $data"
        response=$(curl -s -X $method -H "Content-Type: application/json" -d "$data" $BASE_URL$endpoint)
    else
        response=$(curl -s -X $method $BASE_URL$endpoint)
    fi
    
    if [ $? -eq 0 ]; then
        echo "📥 Response:"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        print_success "API call successful"
    else
        print_error "API call failed"
    fi
    echo ""
}

# Function to wait for processing
wait_for_processing() {
    local max_wait=30
    local wait_time=0
    
    print_step "Waiting for processing to complete..."
    
    while [ $wait_time -lt $max_wait ]; do
        response=$(curl -s $BASE_URL/metacognition/queue-status)
        queue_length=$(echo "$response" | jq -r '.queue_length' 2>/dev/null)
        
        if [ "$queue_length" = "0" ]; then
            print_success "Processing complete"
            return 0
        fi
        
        echo "⏳ Queue length: $queue_length (waiting ${wait_time}s)"
        sleep 2
        wait_time=$((wait_time + 2))
    done
    
    print_warning "Processing may still be ongoing after ${max_wait}s"
}

echo ""
echo "🎯 Test 1: Sarah/Seeds Example"
echo "=============================="
api_call "POST" "/metacognition/sarah-seeds-example" "" "Triggering Sarah/seeds example"

wait_for_processing

echo ""
echo "📊 Test 2: Check Metacognitive Queue Status"
echo "=========================================="
api_call "GET" "/metacognition/queue-status" "" "Checking queue status"

echo ""
echo "📈 Test 3: Check Metacognitive Statistics"
echo "======================================="
api_call "GET" "/metacognition/stats" "" "Getting overall statistics"

echo ""
echo "📜 Test 4: Check Sarah's Metacognitive History"
echo "============================================="
api_call "GET" "/metacognition/history/sarah_farmer" "" "Getting Sarah's metacognitive history"

echo ""
echo "🔄 Test 5: Check Sarah's Schedule Modifications"
echo "=============================================="
api_call "GET" "/metacognition/schedule-modifications/sarah_farmer" "" "Getting Sarah's schedule modifications"

echo ""
echo "🎭 Test 6: Manual Metacognitive Trigger"
echo "====================================="
api_call "POST" "/metacognition/trigger" '{"agentId": "elara_blacksmith", "reason": "manual_test"}' "Manually triggering metacognition for Elara"

wait_for_processing

echo ""
echo "💬 Test 7: Conversation-Based Trigger"
echo "==================================="
api_call "POST" "/metacognition/conversation-trigger" '{"agentId": "elara_blacksmith", "playerMessage": "I need some special equipment for deep sea fishing, can you help me?", "context": "blacksmith_shop"}' "Triggering conversation-based metacognition"

wait_for_processing

echo ""
echo "📜 Test 8: Check Elara's Metacognitive History"
echo "============================================="
api_call "GET" "/metacognition/history/elara_blacksmith" "" "Getting Elara's metacognitive history"

echo ""
echo "🔄 Test 9: Check Elara's Schedule Modifications"
echo "=============================================="
api_call "GET" "/metacognition/schedule-modifications/elara_blacksmith" "" "Getting Elara's schedule modifications"

echo ""
echo "📊 Test 10: Final Statistics Check"
echo "================================"
api_call "GET" "/metacognition/stats" "" "Getting final statistics"

echo ""
echo "🎯 Test 11: Reflection Integration Check"
echo "======================================"
api_call "GET" "/reflection/stats" "" "Checking reflection system integration"

echo ""
echo "🧠 Metacognitive System Test Complete!"
echo "======================================"
echo ""
echo "🔍 What to look for in the results:"
echo "  • Sarah should have schedule modifications to visit the mansion"
echo "  • Agents should show metacognitive evaluations in their history"
echo "  • Schedule modifications should have clear reasoning"
echo "  • The system should integrate with the existing reflection system"
echo ""
echo "📋 Key endpoints for ongoing testing:"
echo "  • GET /metacognition/queue-status - Monitor processing queue"
echo "  • GET /metacognition/stats - Overall system statistics"
echo "  • GET /metacognition/history/{agentId} - Agent's metacognitive history"
echo "  • GET /metacognition/schedule-modifications/{agentId} - Schedule changes"
echo "  • POST /metacognition/trigger - Manual trigger for testing"
echo "  • POST /metacognition/conversation-trigger - Conversation-based trigger"
echo ""
echo "🎊 Sprint 6 Metacognitive System Ready!" 