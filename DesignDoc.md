Technical Design Document

1. Introduction

This document outlines the technical architecture and design for Project Heartwood Valley, a multiplayer 2D simulation game with LLM-powered NPCs. It serves as a guide for the development team, detailing the system components, their interactions, data models, and implementation strategies required to fulfill the specifications laid out in the Product Requirements Document (PRD).

2. System Architecture Overview

The system is designed as a distributed application composed of five primary services: the Client, the Game Server, a Web API Server, the Database Services, and the external LLM Service.

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
        subgraph "Database Services"
            Postgres[(PostgreSQL)]
            Redis[(Redis)]
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

Client (Phaser 3): Renders the game and handles user input.

Game Server (Colyseus): Manages real-time multiplayer state, player positions, and authoritative game events via WebSockets.

Web API (Node.js/Express): Handles non-real-time requests like authentication, inventory management, and acts as a secure proxy for all LLM API calls.

Databases:

PostgreSQL: The primary store for persistent data (users, items, relationships).

Redis: A cache for session data and a real-time store for leaderboards and recent conversation history.

LLM Service: An external, third-party API providing the language model.

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

5. LLM Integration Service

This service is the brain behind the NPCs. It's a logical service that will be implemented as part of the Web API server, likely as a separate worker process.

Prompt Construction: When a conversation job is processed, the prompt sent to the LLM will be constructed as follows:

Base Constitution (from DB): "You are Elara, a shy blacksmith who loves flowers but dislikes loud noises. You are secretly worried about the failing town economy. You speak in short, thoughtful sentences."

Relationship Context (from Redis/DB): "Your current affection level with Player 'Bob' is 45 (Neutral)."

Recent Memory (from Redis): "Conversation History (last 5 exchanges): Bob said 'Hello'. You said '...Hi.'. Bob said 'I brought you a flower'. You said 'Oh, for me? Thank you...'"

Player's Current Message: "Bob says: 'The mines seem dangerous today.'"

Memory Management:

After each LLM response, a new summary of the exchange is generated (potentially by another, faster LLM call).

This summary is pushed to a list in Redis with a TTL (Time To Live) to keep recent memory fast.

Full conversation logs are saved asynchronously to PostgreSQL for long-term analysis and fine-tuning.

Cost/Rate Limiting: The service will enforce a per-user rate limit (e.g., 1 message every 5 seconds) using Redis. This is critical for managing API costs.

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

-- NPC Relationship Tracking
CREATE TABLE npc_relationships (
    character_id UUID REFERENCES characters(id),
    npc_id VARCHAR(50) NOT NULL, -- e.g., "elara_the_blacksmith"
    affection_score INT DEFAULT 0,
    PRIMARY KEY (character_id, npc_id)
);

-- Conversation Logs
CREATE TABLE conversation_logs (
    id BIGSERIAL PRIMARY KEY,
    character_id UUID REFERENCES characters(id),
    npc_id VARCHAR(50) NOT NULL,
    player_message TEXT,
    npc_response TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

6.2. Redis

Session Data: HASH - session:<user_id> -> { characterId: "...", ... }

Leaderboards: SORTED SET - leaderboard:<npc_id> -> ZADD leaderboard:elara 150 <character_id_1>

Recent Conversation: LIST - conversation_history:<character_id>:<npc_id> -> LPUSH ... "Player: Hi | NPC: Hello" (with TTL)

Rate Limiting: STRING - ratelimit:interact:<user_id> -> SET ... EX 5

7. Key Data Flows

7.1. Player Movement

Client: User presses 'W'. Client sends room.send("move", "up").

Game Server (Colyseus): onMessage("move") is triggered. The server validates if the move is legal (e.g., not into a wall).

Game Server: If valid, updates the player's x, y in the room state.

All Clients: The colyseus.js SDK receives the state patch. The onStateChange listener fires, and the 3D model for the moving player is updated to the new coordinates.

7.2. NPC Conversation

Client: Player types "Hello Elara" and hits send. Client makes an authenticated POST /npc/interact call to the Web API. A "typing..." indicator is shown in the UI.

Web API: The API validates the request, checks the rate limit in Redis, and pushes a job to the conversation_queue in Redis. It immediately returns a 202 Accepted response.

LLM Worker: The worker picks up the job. It fetches the NPC constitution, relationship score, and recent history from the databases.

LLM Worker: It constructs the detailed prompt and sends it to the external LLM API.

LLM Worker: On receiving the response, it updates the conversation log in PostgreSQL and caches the new summary in Redis.

LLM Worker: It sends the response back to the relevant client via a direct message through the Colyseus server.

Client: Receives the message from Colyseus and displays the NPC's response in the dialogue UI.

8. Deployment & Operations (DevOps)

Containerization: The entire stack (Web API, Game Server, Databases) will be defined in a docker-compose.yml file for easy local development setup.

CI/CD: A GitHub Actions workflow will be set up. On a push to the main branch, it will:

Run tests.

Build Docker images for the Web API and Game Server.

Push images to a container registry (e.g., Docker Hub, AWS ECR).

Trigger a deployment on the cloud host to pull the new images and restart the services.

Monitoring: Use a process manager like PM2 for Node.js applications. Integrate a logging service (e.g., Datadog, Logtail) to aggregate logs from all services for easier debugging.

