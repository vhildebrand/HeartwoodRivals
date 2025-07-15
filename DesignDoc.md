Technical Design Document

1. Introduction

This document outlines the technical architecture and design for Project Heartwood Valley, a multiplayer 2D simulation game featuring fully autonomous generative agents as NPCs. Drawing from "Generative Agents: Interactive Simulacra of Human Behavior" and "Metacognition is all you need? Using Introspection in Generative Agents to Improve Goal-directed Behavior", this system implements true agentic behavior where NPCs maintain their own schedules, goals, memories, and can interact freely with both players and other NPCs in a persistent small town environment.

2. System Architecture Overview

The system is designed as a distributed application with seven primary services: the Client, the Game Server, a Web API Server, the Database Services, the LLM Service, the Agent Management System, and the Agent Memory & Planning System. The architecture supports autonomous agents that can perceive their environment, form memories, reflect on experiences, plan future actions, and interact with both players and other agents.

graph TD
    subgraph "Player's Browser"
        Client(Phaser 3 Game Client)
    end

    subgraph "Cloud Infrastructure (e.g., AWS, DigitalOcean)"
        subgraph "Game Server (Node.js)"
            GameServer[Colyseus Server]
        end
        subgraph "Web Server (Node.js)"
            WebApp[Web API / LLM Proxy]
        end
        subgraph "Agent Systems"
            AgentManager[Agent Management System]
            MemoryPlanning[Agent Memory & Planning]
            Reflection[Agent Reflection System]
            Metacognition[Agent Metacognition]
            Scheduler[Agent Scheduling System]
            InterAgent[Inter-Agent Communication]
        end
        subgraph "Database Services"
            Postgres[(PostgreSQL)]
            Redis[(Redis)]
            VectorDB[(Vector Database)]
        end
    end

    subgraph "Third-Party Service"
        LLM_API[LLM API <br/> e.g., OpenAI, Anthropic]
    end

    Client -- WebSocket --> GameServer
    Client -- HTTP/S --> WebApp
    WebApp -- HTTP/S --> LLM_API
    GameServer -- TCP --> Postgres
    GameServer -- TCP --> Redis
    WebApp -- TCP --> Postgres
    WebApp -- TCP --> Redis
    AgentManager -- TCP --> GameServer
    AgentManager -- HTTP/S --> WebApp
    MemoryPlanning -- TCP --> VectorDB
    MemoryPlanning -- TCP --> Redis
    Reflection -- HTTP/S --> LLM_API
    Metacognition -- HTTP/S --> LLM_API
    Scheduler -- TCP --> Redis
    InterAgent -- TCP --> GameServer

Client (Phaser 3): Renders the game and handles user input. Displays autonomous NPC behaviors and interactions.

Game Server (Colyseus): Manages real-time multiplayer state, player positions, NPC positions, and authoritative game events via WebSockets. Coordinates agent actions in the game world.

Web API (Node.js/Express): Handles non-real-time requests like authentication, inventory management, and acts as a secure proxy for all LLM API calls. Manages agent-to-agent communication requests.

Agent Management System: Orchestrates all autonomous agents, maintaining their lifecycle, coordinating their interactions, and ensuring coherent behavior across the town.

Agent Memory & Planning System: Implements the memory stream architecture from generative agents research, storing observations, reflections, and plans. Handles retrieval and synthesis of relevant memories for decision-making.

Agent Reflection System: Generates high-level reflections about agent experiences, identifying patterns and insights that inform future behavior. Implements the reflection mechanism for emergent personality development.

Agent Metacognition System: Provides agents with introspective capabilities to evaluate their own performance, adjust strategies, and improve goal-directed behavior based on outcomes.

Agent Scheduling System: Manages daily schedules, routines, and dynamic goal-driven activities for each agent. Handles interruptions, social interactions, and adaptive planning.

Inter-Agent Communication: Facilitates natural conversations and interactions between NPCs, enabling emergent social dynamics and collaborative behaviors.

Databases:

PostgreSQL: The primary store for persistent data (users, items, relationships, agent profiles, and long-term memories).

Redis: A cache for session data, agent state, active plans, and real-time coordination between agents.

Vector Database (e.g., Pinecone, Weaviate): Stores embeddings of agent memories for efficient semantic retrieval and similarity-based memory access.

LLM Service: An external, third-party API providing the language model for agent reasoning, dialogue, and reflection.

3. Client-Side Architecture (Phaser 3)

The client is responsible for rendering the game world and capturing player input.

Scene Management: The game will be structured into multiple scenes for modularity.

PreloaderScene: Loads all necessary game assets (images, atlases, tilemaps).

MainMenuScene: Handles main menu UI, login/character selection.

GameScene: The main game world where gameplay occurs. It will render players, NPCs, and the tilemap.

UIScene: Renders all UI elements on top of the GameScene (e.g., chat, inventory, dialogue boxes). This keeps UI logic separate from game logic.

Networking:

The client will use the official colyseus.js SDK.

On joining the GameScene, the client will connect to the Colyseus server: const room = await client.joinOrCreate("heartwood_room");.

The client will listen for state patches from the server (room.onStateChange) and update the positions and animations of players and NPCs accordingly.

Player input (e.g., key presses for movement) will be sent to the server for validation: room.send("move", { x, y });.

State Management: Client-side state (e.g., player inventory) will be a combination of data received from the server and local state. For simplicity, we will use plain JavaScript objects and custom event emitters before introducing a formal state management library.

4. Server-Side Architecture

4.1. Game Server (Colyseus)

The Game Server handles the real-time multiplayer logic.

Room Definition (HeartwoodRoom.ts):

A single room type will manage one game instance (a single farm/town area).

State Schema: The room's state will be defined using @colyseus/schema for automatic binary patching.

class Player extends Schema { @type("string") name: string; @type("number") x: number; @type("number") y: number; }
class NPC extends Schema { @type("string") characterId: string; @type("number") x: number; @type.("number") y: number; }
class HeartwoodRoomState extends Schema { @type({ map: Player }) players = new MapSchema<Player>(); @type({ map: NPC }) npcs = new MapSchema<NPC>(); }

Lifecycle Hooks:

onCreate(): Initialize the room, load NPC data from the database.

onJoin(): Authorize the player, create a Player schema instance, and add them to the state.

onMessage(): Handle incoming messages from clients (e.g., "move", "chat"). This is where server-authoritative logic lives.

onLeave(): Remove the player from the state.

4.2. Web API (Node.js / Express)

This server handles all HTTP-based communication.

Authentication:

POST /auth/login: Accepts credentials, returns a JSON Web Token (JWT).

POST /auth/register: Creates a new user in the PostgreSQL database.

LLM Proxy:

POST /npc/interact: This is the crucial endpoint for conversations.

Receives { npcId: string, message: string } from the client with a valid JWT.

It will not call the LLM API directly. Instead, it will publish a job to a Redis queue.

A separate worker process will consume jobs from this queue, construct the prompt, call the LLM API, and store the result. This prevents the API from being a blocking bottleneck.

Middleware: All protected routes will use JWT middleware to authenticate the user.

5. Generative Agent Architecture

This system implements the full generative agent architecture as described in the research papers, creating truly autonomous NPCs with emergent behaviors.

5.1. Agent Memory Stream

Each agent maintains a comprehensive memory stream consisting of:

Observations: Real-time perceptions of the environment, other agents, and players
- "I see Bob approaching the blacksmith shop"
- "Alice is talking to the merchant about wheat prices"
- "The sun is setting, most people are heading home"

Reflections: High-level insights generated from observations
- "Alice seems worried about the harvest this year"
- "Bob has been visiting me more often lately"
- "The town feels more tense since the merchant shortage"

Plans: Goal-oriented action sequences
- "I should finish this horseshoe before dinner"
- "I want to ask Bob about his mining concerns"
- "I need to restock iron before the festival"

5.2. Memory Retrieval and Synthesis

Vector-based retrieval using embeddings to find relevant memories based on:
- Semantic similarity to current situation
- Recency weighting for fresh memories
- Importance scoring for significant events
- Emotional relevance to agent's current state

5.3. Agent Reflection System

Periodic reflection process that:
- Analyzes patterns in recent observations
- Generates insights about relationships and situations
- Updates agent's understanding of social dynamics
- Influences future behavior and decision-making

5.4. Agent Planning System

Goal-directed behavior through:
- Daily routine planning (work, meals, social time)
- Reactive planning for unexpected events
- Social goal formation (strengthening relationships, pursuing interests)
- Adaptive replanning based on outcomes

5.5. Agent Metacognition System

Introspective capabilities for:
- Performance evaluation of past actions
- Strategy adjustment based on outcomes
- Goal prioritization and modification
- Self-awareness of emotional states and preferences

5.6. Agent Scheduling and Coordination

Dynamic scheduling that handles:
- Individual agent routines and preferences
- Social coordination for group activities
- Interruption handling for player interactions
- Emergent social events and gatherings

5.7. Prompt Construction for Agentic Behavior

When agents need to make decisions or respond, prompts include:

Agent Constitution: Core personality, goals, and behavioral patterns
Current Context: Immediate environment, people present, time of day
Relevant Memories: Retrieved from memory stream based on current situation
Active Plans: Current goals and intended actions
Emotional State: Mood, energy level, social needs
Metacognitive Insights: Self-awareness and strategic considerations

Example prompt structure:
```
You are Elara, a thoughtful blacksmith in Heartwood Valley. You love your craft and flowers, but dislike loud noises and crowds. You're concerned about the town's economy but try to stay optimistic.

Current Situation: It's 3 PM, you're in your smithy. Bob approaches looking worried.

Relevant Memories:
- Bob mentioned dangerous mine conditions yesterday
- You've been working on a horseshoe for his cart
- Bob has been visiting more often lately, possibly interested in you romantically

Current Plans:
- Finish the horseshoe before dinner
- Ask Bob about his mining concerns
- Close shop at 5 PM for evening walk

Emotional State: Focused but open to conversation, slightly worried about Bob's safety

Metacognitive Insight: You've noticed Bob seems to need someone to talk to about his work stress. Being a good listener might strengthen your friendship.

Given this context, how do you respond to Bob's approach?
```

Memory Management:

Observations are continuously stored as embeddings in the vector database
Reflections are generated daily and during significant events
Plans are updated based on outcomes and new information
All interactions update the memory stream with new observations
Long-term memories are periodically consolidated and summarized

Cost/Rate Limiting: 
- Intelligent batching of reflection generation
- Efficient memory retrieval to minimize LLM calls
- Adaptive detail levels based on situation importance
- Caching of recent decisions and responses

6. Database Schema

6.1. PostgreSQL

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Player Characters
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    character_name VARCHAR(50) NOT NULL
    -- other character data like skills, etc.
);

-- Generative Agents (NPCs)
CREATE TABLE agents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    constitution TEXT NOT NULL, -- Core personality and behavioral patterns
    current_location VARCHAR(100),
    current_activity TEXT,
    energy_level INT DEFAULT 100,
    mood VARCHAR(50) DEFAULT 'neutral',
    primary_goal TEXT,
    secondary_goals TEXT[], -- Array of secondary goals
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Memory Stream
CREATE TABLE agent_memories (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    memory_type VARCHAR(20) NOT NULL, -- 'observation', 'reflection', 'plan'
    content TEXT NOT NULL,
    importance_score INT DEFAULT 0, -- 1-10 scale
    emotional_relevance INT DEFAULT 0, -- 1-10 scale
    tags TEXT[], -- For categorization
    related_agents TEXT[], -- Other agents involved
    related_players UUID[], -- Players involved
    location VARCHAR(100),
    timestamp TIMESTAMPTZ DEFAULT now(),
    embedding_id VARCHAR(100) -- Reference to vector DB
);

-- Agent Relationships (Agent-to-Agent)
CREATE TABLE agent_relationships (
    agent_id VARCHAR(50) REFERENCES agents(id),
    other_agent_id VARCHAR(50) REFERENCES agents(id),
    relationship_type VARCHAR(50), -- 'friend', 'colleague', 'rival', etc.
    affection_score INT DEFAULT 0,
    trust_level INT DEFAULT 0,
    interaction_frequency INT DEFAULT 0,
    last_interaction TIMESTAMPTZ,
    PRIMARY KEY (agent_id, other_agent_id)
);

-- Agent-Player Relationships
CREATE TABLE agent_player_relationships (
    agent_id VARCHAR(50) REFERENCES agents(id),
    character_id UUID REFERENCES characters(id),
    relationship_type VARCHAR(50),
    affection_score INT DEFAULT 0,
    trust_level INT DEFAULT 0,
    interaction_frequency INT DEFAULT 0,
    last_interaction TIMESTAMPTZ,
    PRIMARY KEY (agent_id, character_id)
);

-- Agent Schedules
CREATE TABLE agent_schedules (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    day_of_week INT, -- 0-6, or NULL for one-time events
    start_time TIME,
    end_time TIME,
    activity TEXT NOT NULL,
    location VARCHAR(100),
    priority INT DEFAULT 1, -- 1-10 scale
    is_flexible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Plans (Dynamic, goal-oriented actions)
CREATE TABLE agent_plans (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    goal TEXT NOT NULL,
    plan_steps TEXT[], -- Array of planned actions
    current_step INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    priority INT DEFAULT 1,
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Reflections
CREATE TABLE agent_reflections (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    reflection TEXT NOT NULL,
    trigger_memories BIGINT[], -- Array of memory IDs that triggered this reflection
    insights TEXT[],
    behavioral_changes TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Metacognitive Insights
CREATE TABLE agent_metacognition (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(50) REFERENCES agents(id),
    performance_evaluation TEXT,
    strategy_adjustments TEXT[],
    goal_modifications TEXT[],
    self_awareness_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation Logs (Enhanced for agent-agent interactions)
CREATE TABLE conversation_logs (
    id BIGSERIAL PRIMARY KEY,
    initiator_type VARCHAR(10) NOT NULL, -- 'agent' or 'player'
    initiator_id VARCHAR(50) NOT NULL, -- agent_id or character_id
    recipient_type VARCHAR(10) NOT NULL, -- 'agent' or 'player'
    recipient_id VARCHAR(50) NOT NULL, -- agent_id or character_id
    message TEXT NOT NULL,
    response TEXT,
    context TEXT, -- Environmental context
    emotional_tone VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Agent State (Current dynamic state)
CREATE TABLE agent_states (
    agent_id VARCHAR(50) PRIMARY KEY REFERENCES agents(id),
    current_x INT,
    current_y INT,
    current_direction VARCHAR(10),
    current_action VARCHAR(100),
    action_start_time TIMESTAMPTZ,
    interaction_target VARCHAR(50), -- Who they're currently interacting with
    emotional_state JSONB, -- Complex emotional state
    physical_state JSONB, -- Energy, health, etc.
    cognitive_load INT DEFAULT 0, -- How much they're thinking about
    updated_at TIMESTAMPTZ DEFAULT now()
);

6.2. Redis

Session Data: HASH - session:<user_id> -> { characterId: "...", ... }

Agent States: HASH - agent:state:<agent_id> -> { location: "...", activity: "...", mood: "...", energy: 85 }

Agent Active Plans: LIST - agent:plans:<agent_id> -> Current active plans and their progress

Agent Current Actions: STRING - agent:action:<agent_id> -> Current action with TTL

Agent Interactions: SET - agent:interactions:<agent_id> -> Active interactions with other agents/players

Agent Memory Cache: HASH - agent:memory_cache:<agent_id> -> Recently accessed memories for faster retrieval

Agent Reflection Triggers: LIST - agent:reflection_triggers:<agent_id> -> Events that should trigger reflection

Agent Coordination: HASH - agent:coordination -> Inter-agent coordination and conflict resolution

Agent Schedules: HASH - agent:schedule:<agent_id> -> Today's schedule and modifications

Agent Emotional State: HASH - agent:emotions:<agent_id> -> Current emotional state and recent changes

Agent Social Context: HASH - agent:social:<agent_id> -> Current social situation and nearby agents

Leaderboards: SORTED SET - leaderboard:<agent_id> -> ZADD leaderboard:elara 150 <character_id_1>

Recent Conversation: LIST - conversation_history:<agent_id>:<other_id> -> Recent conversation context (with TTL)

Rate Limiting: STRING - ratelimit:interact:<user_id> -> SET ... EX 5

Agent Processing Queue: LIST - agent:processing_queue -> Queue of agents needing LLM processing

Agent Metacognition Queue: LIST - agent:metacognition_queue -> Queue of agents needing metacognitive processing

7. Key Data Flows

7.1. Player Movement

Client: User presses 'W'. Client sends room.send("move", "up").

Game Server (Colyseus): onMessage("move") is triggered. The server validates if the move is legal (e.g., not into a wall).

Game Server: If valid, updates the player's x, y in the room state.

All Clients: The colyseus.js SDK receives the state patch. The onStateChange listener fires, and the player model is updated to the new coordinates.

Agent Management System: Observes player movement and updates agent memory streams with new observations.

7.2. Agent Autonomous Behavior

Agent Scheduling System: Checks current time against agent schedules and active plans.

Agent Management System: Identifies agents that need to take actions or make decisions.

Agent Memory System: Retrieves relevant memories based on current context and situation.

Agent Planning System: Determines appropriate actions based on goals, schedule, and environmental context.

LLM Worker: Processes agent decision-making with full contextual prompt including memories, plans, and metacognitive insights.

Agent Management System: Executes the decided action (movement, interaction, activity change).

Game Server: Updates agent positions and states in the world.

All Clients: Receive agent state updates and display autonomous NPC behaviors.

7.3. Agent-Agent Interactions

Agent A: Approaches Agent B based on social goals or scheduled activities.

Agent Management System: Detects proximity and initiates inter-agent interaction.

Agent Memory System: Retrieves relevant memories about the relationship and past interactions.

Agent Planning System: Both agents consider their goals and how this interaction fits their plans.

LLM Worker: Processes conversation flow with full context for both agents.

Agent Management System: Updates relationship states and memory streams for both agents.

Game Server: Broadcasts interaction states to all clients.

All Clients: Display agent-to-agent conversation and behavioral changes.

7.4. Agent Memory and Reflection

Agent Memory System: Continuously monitors for significant events, interactions, and observations.

Agent Memory System: Stores new observations as embeddings in Vector Database.

Agent Reflection System: Periodically analyzes memory patterns and generates insights.

LLM Worker: Processes reflection generation with memory stream analysis.

Agent Memory System: Stores reflections and updates agent understanding.

Agent Planning System: Adjusts future plans based on new reflections and insights.

7.5. Agent Metacognitive Processing

Agent Metacognition System: Monitors agent performance and goal achievement.

Agent Metacognition System: Evaluates recent actions and their outcomes.

LLM Worker: Processes metacognitive analysis with performance data.

Agent Management System: Updates agent strategies and goal priorities.

Agent Planning System: Modifies future planning based on metacognitive insights.

7.6. Player-Agent Conversation

Client: Player types "Hello Elara" and hits send. Client makes an authenticated POST /agent/interact call to the Web API.

Web API: The API validates the request, checks rate limits, and queues the interaction.

Agent Management System: Notifies the target agent of the player interaction.

Agent Memory System: Retrieves relevant memories about the player and current context.

Agent Planning System: Considers how this interaction fits current goals and plans.

LLM Worker: Processes the conversation with full agent context (memories, plans, emotional state, metacognitive insights).

Agent Management System: Updates agent memory with the new interaction and any resulting plan changes.

Game Server: Sends the response back to the client and updates agent state.

Client: Receives the message from Colyseus and displays the agent's response in the dialogue UI.

7.7. Agent Scheduling and Coordination

Agent Scheduling System: Manages individual agent schedules and identifies conflicts.

Agent Coordination System: Resolves conflicts when multiple agents want to use the same space or resource.

Agent Management System: Coordinates group activities and social events.

Agent Planning System: Adjusts individual plans based on coordination needs.

Game Server: Updates agent positions and activities based on coordinated plans.

All Clients: Display coordinated agent behaviors and group activities.

8. Deployment & Operations (DevOps)

Containerization: The entire stack (Web API, Game Server, Agent Systems, Databases) will be defined in a docker-compose.yml file for easy local development setup.

CI/CD: A GitHub Actions workflow will be set up. On a push to the main branch, it will:

Run tests for all services including agent behavior tests.

Build Docker images for the Web API, Game Server, and Agent Management System.

Push images to a container registry (e.g., Docker Hub, AWS ECR).

Trigger a deployment on the cloud host to pull the new images and restart the services.

Monitoring: Use a process manager like PM2 for Node.js applications. Integrate a logging service (e.g., Datadog, Logtail) to aggregate logs from all services for easier debugging.

Agent-Specific Monitoring:
- Agent behavior metrics (actions per minute, interaction frequency)
- Memory system performance (retrieval latency, reflection generation time)
- LLM API usage and costs per agent
- Agent coordination conflicts and resolution times
- Metacognitive processing queue lengths and processing times

Scaling Considerations:
- Horizontal scaling of Agent Management System for large populations
- Vector database clustering for memory storage
- Redis clustering for real-time agent coordination
- Load balancing for LLM API calls across multiple providers
- Caching strategies for frequently accessed agent memories

