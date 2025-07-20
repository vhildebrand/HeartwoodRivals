# NPC Conversation Debug Tools

This document explains how to use the debug tools for testing and troubleshooting NPC conversations in Heartwood Rivals.

## Quick Start

1. **Make sure your Docker services are running** [[memory:3392293]]
2. **Install dependencies for the debug script:**
   ```bash
   npm install
   ```
3. **Run the debug script:**
   ```bash
   node test_conversation_debug.js
   ```

## Available Debug Endpoints

### 1. List NPCs
Get all available NPCs and their current status:
```bash
node test_conversation_debug.js list-npcs
```

### 2. Force NPC-Player Conversation
Force a specific NPC to initiate a conversation with a player:
```bash
node test_conversation_debug.js force-player-conversation <npcId> <playerId> [topic] [approach] [message]
```

**Example:**
```bash
node test_conversation_debug.js force-player-conversation maya_teacher player123 "school lessons" "friendly" "Hello! I wanted to discuss your studies with you."
```

### 3. Force NPC-NPC Conversation  
Force two NPCs to start a conversation with each other:
```bash
node test_conversation_debug.js force-npc-conversation <initiatorId> <targetId> [topic] [approach] [message]
```

**Example:**
```bash
node test_conversation_debug.js force-npc-conversation maya_teacher thomas_tavern_keeper "education" "casual" "Hi Thomas! I wanted to chat about something."
```

### 4. Get Conversation Status
Check the current status of the conversation system:
```bash
node test_conversation_debug.js conversation-status
```

### 5. Trigger Thoughts
Force an NPC to generate thoughts (which might lead to conversations):
```bash
node test_conversation_debug.js trigger-thought <npcId> <thoughtTrigger> [importance]
```

**Example:**
```bash
node test_conversation_debug.js trigger-thought maya_teacher "I wonder what the player is up to" 8
```

## Direct API Usage

You can also call the debug endpoints directly via HTTP:

### POST `/npc/debug/force-player-conversation`
```json
{
  "npcId": "maya_teacher",
  "playerId": "player123",
  "topic": "general conversation",
  "approach": "friendly", 
  "openingMessage": "Hello! I wanted to talk with you."
}
```

### POST `/npc/debug/force-npc-conversation`
```json
{
  "initiatorId": "maya_teacher",
  "targetId": "thomas_tavern_keeper",
  "topic": "general conversation",
  "approach": "friendly",
  "openingMessage": "Hi! I wanted to chat with you."
}
```

### GET `/npc/debug/conversation-status`
Returns debug information about recent conversation attempts and NPC states.

### POST `/npc/debug/trigger-thought`
```json
{
  "npcId": "maya_teacher",
  "thoughtTrigger": "I wonder what the player is up to",
  "importance": 7
}
```

## What to Look For

### In Game Logs
When you force conversations, look for these log messages:

**NPC-Player Conversations:**
- `🐛 [DEBUG] Processing forced conversation initiation: <npc> -> <player>`
- `💬 [CONVERSATION] Executing immediate conversation: <npc> -> <player>`
- `💬 [CONVERSATION] Sending conversation initiation to client <playerId>`

**NPC-NPC Conversations:**
- `💬 [NPC-NPC] Starting conversation: <initiator> -> <target>`
- `💬 [NPC-NPC] <Name> says: "<message>"`

**Thought System:**
- `🐛 [DEBUG] Received forced thought generation for <npc>: <trigger>`
- `🧠 [THOUGHT_SYSTEM] Triggering thought for <npc>`

### In Game Client
**NPC-Player Conversations:**
- Look for conversation bubbles or dialogue windows opening
- Check if the NPC approaches the player 
- Watch for the opening message to appear

**NPC-NPC Conversations:**
- Look for dialogue bubbles above NPCs
- Watch for 3-turn conversation sequences
- Bubbles should appear and disappear after a few seconds

## Common Issues & Troubleshooting

### 1. "NPC not found" error
- Run `list-npcs` to see available NPC IDs
- Make sure you're using the exact ID (like `maya_teacher`, not `Maya Teacher`)

### 2. "Target not found" error  
- For NPC-Player conversations, make sure a player is actually connected
- For NPC-NPC conversations, verify both NPCs exist and are spawned

### 3. No visual conversation appears
- Check the game server logs for the debug messages
- Verify the conversation was processed but may have failed distance checks
- Make sure NPCs and players are within conversation range (32 pixels)

### 4. NPCs too far apart
- The system logs distance checks: `Distance check: X.X pixels (range: 32)`
- If NPCs are too far, they might schedule an approach first

## Understanding the Conversation Flow

1. **Debug endpoint called** → Redis message published to `initiate_conversation`
2. **HeartwoodRoom receives message** → `handleConversationInitiation()` called
3. **Distance/target validation** → `executeConversationInitiation()` called
4. **For NPC-Player**: Message sent to client via `npc_conversation_initiated`
5. **For NPC-NPC**: `initiateNPCToNPCConversation()` starts 3-turn sequence
6. **Client handles message** → Dialogue UI appears or bubbles show

## Tips for Effective Testing

1. **Start with NPC-NPC conversations** - they're fully server-side and easier to debug
2. **Check logs first** - see if the conversation system is receiving and processing requests
3. **Test with nearby NPCs** - avoid distance-related failures initially
4. **Use simple opening messages** - avoid overly complex text that might cause LLM issues
5. **Monitor Redis logs** - watch for message flow between systems

This debug system should help you identify whether the issue is:
- NPCs not deciding to initiate conversations naturally
- The conversation initiation system not working
- Message flow problems between systems
- Client-side display issues
- Distance or proximity problems 