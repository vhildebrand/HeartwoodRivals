#!/usr/bin/env node

/**
 * Test script for NPC conversation debug endpoints
 * 
 * Usage:
 *   node test_conversation_debug.js list-npcs
 *   node test_conversation_debug.js force-player-conversation <npcId> <playerId> [topic] [approach] [message]
 *   node test_conversation_debug.js force-npc-conversation <initiatorId> <targetId> [topic] [approach] [message]
 *   node test_conversation_debug.js conversation-status
 *   node test_conversation_debug.js trigger-thought <npcId> <thoughtTrigger> [importance]
 */

// Import fetch for Node.js (Node 18+ has it built-in, but let's be explicit)
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function makeRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        
        if (!response.ok) {
            console.error(`❌ Error ${response.status}:`, data.error || data.message);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('❌ Network error:', error.message);
        return null;
    }
}

async function listNPCs() {
    console.log('📋 Fetching NPC list...');
    const result = await makeRequest('/npc/list');
    
    if (result && result.agents) {
        console.log(`\n🤖 Found ${result.agents.length} NPCs:\n`);
        result.agents.forEach((npc, index) => {
            console.log(`${index + 1}. ${npc.name} (${npc.id})`);
            console.log(`   Location: ${npc.current_location || 'Unknown'}`);
            console.log(`   Activity: ${npc.current_activity || 'Unknown'}\n`);
        });
        
        console.log('\n💡 Use these NPC IDs for the conversation test commands:');
        result.agents.forEach(npc => {
            console.log(`   ${npc.name}: ${npc.id}`);
        });
    }
}

async function forcePlayerConversation(npcId, playerId, topic, approach, openingMessage) {
    console.log(`💬 Forcing player conversation: ${npcId} -> ${playerId}`);
    
    const body = {
        npcId,
        playerId,
        topic: topic || 'general conversation',
        approach: approach || 'friendly',
        openingMessage: openingMessage || `Hello! I wanted to talk with you about something.`
    };
    
    const result = await makeRequest('/npc/debug/force-player-conversation', 'POST', body);
    
    if (result && result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`📝 Conversation Data:`, result.conversationData);
        console.log(`\n💡 Check the game logs and client UI to see if the conversation appeared!`);
    }
}

async function forceNPCConversation(initiatorId, targetId, topic, approach, openingMessage) {
    console.log(`💬 Forcing NPC-NPC conversation: ${initiatorId} -> ${targetId}`);
    
    const body = {
        initiatorId,
        targetId,
        topic: topic || 'general conversation',
        approach: approach || 'friendly',
        openingMessage: openingMessage || `Hi! I wanted to chat with you about something.`
    };
    
    const result = await makeRequest('/npc/debug/force-npc-conversation', 'POST', body);
    
    if (result && result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`📝 Conversation Data:`, result.conversationData);
        console.log(`\n💡 Check the game logs and client UI to see dialogue bubbles!`);
    }
}

async function getConversationStatus() {
    console.log('🔍 Fetching conversation status...');
    
    const result = await makeRequest('/npc/debug/conversation-status');
    
    if (result && result.success) {
        console.log(`\n📊 Conversation Debug Status:`);
        console.log(`Timestamp: ${result.debug.timestamp}\n`);
        
        console.log(`🗨️ Recent Conversation Attempts (${result.debug.recentConversationAttempts.length}):`);
        if (result.debug.recentConversationAttempts.length > 0) {
            result.debug.recentConversationAttempts.forEach((attempt, index) => {
                console.log(`${index + 1}. ${attempt.type || 'unknown'}: ${JSON.stringify(attempt).substring(0, 100)}...`);
            });
        } else {
            console.log('   No recent conversation attempts found');
        }
        
        console.log(`\n🤖 Recent NPC Activities (${result.debug.recentNPCActivities.length}):`);
        result.debug.recentNPCActivities.forEach((npc, index) => {
            console.log(`${index + 1}. ${npc.name} (${npc.id})`);
            console.log(`   Location: ${npc.current_location || 'Unknown'}`);
            console.log(`   Activity: ${npc.current_activity || 'Unknown'}`);
            console.log(`   Last Change: ${npc.last_activity_timestamp || 'Unknown'}\n`);
        });
        
        console.log(`💭 Conversation Intentions (${result.debug.conversationIntentions.length}):`);
        if (result.debug.conversationIntentions.length > 0) {
            result.debug.conversationIntentions.forEach((intention, index) => {
                console.log(`${index + 1}. ${intention.agent_id} -> ${intention.target}`);
                console.log(`   Topic: ${intention.topic}, Timing: ${intention.timing}`);
                console.log(`   Created: ${intention.created_at}\n`);
            });
        } else {
            console.log('   No conversation intentions found');
        }
    }
}

async function triggerThought(npcId, thoughtTrigger, importance) {
    console.log(`🧠 Triggering thought for NPC ${npcId}: ${thoughtTrigger}`);
    
    const body = {
        npcId,
        thoughtTrigger,
        importance: parseInt(importance) || 7
    };
    
    const result = await makeRequest('/npc/debug/trigger-thought', 'POST', body);
    
    if (result && result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`📝 Thought Data:`, result.thoughtData);
        console.log(`\n💡 This might trigger the NPC to want to have conversations. Check logs for thought processing!`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log(`
🤖 NPC Conversation Debug Tool

Available commands:
  list-npcs                                           - List all NPCs and their IDs
  force-player-conversation <npcId> <playerId>       - Force NPC to talk to player
  force-npc-conversation <initiatorId> <targetId>    - Force NPC to talk to NPC
  conversation-status                                 - Show conversation debug status
  trigger-thought <npcId> <thoughtTrigger>           - Force NPC to generate thoughts

Examples:
  node test_conversation_debug.js list-npcs
  node test_conversation_debug.js force-player-conversation maya_teacher player123
  node test_conversation_debug.js force-npc-conversation maya_teacher thomas_tavern_keeper
  node test_conversation_debug.js conversation-status
  node test_conversation_debug.js trigger-thought maya_teacher "I wonder what the player is up to"

💡 Note: Make sure your Docker services are running and the web-api is accessible at ${BASE_URL}
        `);
        return;
    }

    switch (command) {
        case 'list-npcs':
            await listNPCs();
            break;
            
        case 'force-player-conversation':
            if (args.length < 3) {
                console.error('❌ Usage: force-player-conversation <npcId> <playerId> [topic] [approach] [message]');
                return;
            }
            await forcePlayerConversation(args[1], args[2], args[3], args[4], args[5]);
            break;
            
        case 'force-npc-conversation':
            if (args.length < 3) {
                console.error('❌ Usage: force-npc-conversation <initiatorId> <targetId> [topic] [approach] [message]');
                return;
            }
            await forceNPCConversation(args[1], args[2], args[3], args[4], args[5]);
            break;
            
        case 'conversation-status':
            await getConversationStatus();
            break;
            
        case 'trigger-thought':
            if (args.length < 3) {
                console.error('❌ Usage: trigger-thought <npcId> <thoughtTrigger> [importance]');
                return;
            }
            await triggerThought(args[1], args[2], args[3]);
            break;
            
        default:
            console.error(`❌ Unknown command: ${command}`);
            console.log('Run without arguments to see available commands.');
    }
}

main().catch(console.error); 