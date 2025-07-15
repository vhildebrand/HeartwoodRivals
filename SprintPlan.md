Sprint Plan: Project Heartwood Valley

High-Level Roadmap & Milestones

This project is divided into four major milestones, building the agent architecture layer-by-layer.

Milestone 1: Foundation & Basic Agents (Sprints 0-3)

Goal: Build the core game engine and a basic agent that can observe, remember, and execute simple, pre-defined plans.

Milestone 2: The Thinking Agent (Sprints 4-6)

Goal: Implement the advanced cognitive loops. Agents will be able to generate their own plans, reflect on memories, and use metacognition to change their strategies.
Milestone 3: The Optimized & Social Agent (Sprints 7-9)

Goal: Implement the affordability systems and enable complex agent-to-agent social interactions.

Milestone 4: Multiplayer & Launch Prep (Sprints 10-12)

Goal: Integrate multiplayer, persistence, and conduct a closed alpha test.

Sprint Breakdown

Milestone 1: Foundation & Basic Agents

Sprint 0: Setup & Foundations (Week 0)

Goal: Establish the complete project infrastructure, including Vector DB.

Tasks:

DevOps: Initialize Git repository. Set up docker-compose.yml for local development (Node.js, Postgres, Redis, Vector DB).

DevOps: Create GitHub Actions workflow for CI/CD (linting, testing, building Docker images).

Backend: Set up initial Node.js projects for the Game Server (Colyseus), Web API (Express), and Agent Management System.

Backend: Implement comprehensive database schema in PostgreSQL (users, characters, agents, agent_memories, agent_states).

Frontend: Set up Phaser 3 project with PreloaderScene and a blank GameScene.

Deliverable: A developer can clone the repo, run docker-compose up, and see a blank game screen with agent infrastructure ready.

Sprint 1: The Walking Player & Basic World

Goal: A player can move in a world and observe static agent characters.

Tasks:

Frontend (U1.1): Implement 8-directional player movement with keyboard controls.

Frontend: Create a simple tilemap and implement collision detection against a "walls" layer.

Frontend: Implement basic character animations (idle, walk) for both players and agents.

Backend: Set up a basic Colyseus room (HeartwoodRoom.ts) that manages both players and agents.

Backend: Create basic agent entities that can be positioned in the world.

Deliverable: A playable web build where a player can walk around a small map and see agent sprites positioned in the world.

Sprint 2: The Observing Agent (Memory System)

Goal: Implement the foundational memory stream.

Tasks:

Backend: Set up Vector DB for semantic storage.

Backend: Create Agent Memory Manager to store observations.

Backend: Implement memory embedding and basic retrieval (recency, importance).

Backend: Agents can now "see" the player and record it.

Deliverable: An agent can observe a player's actions (e.g., "Player walked into the room") and store this as a memory in the Vector DB.

Sprint 3: The Acting Agent (Basic Planning)

Goal: Agents can execute pre-defined, simple plans.

Tasks:

Backend: Create a basic plan execution system.

Backend: Manually insert a simple plan into an agent's memory (e.g., "walk to the cafe at 10 AM").

Backend: Implement the agent state machine to follow the plan.

Deliverable: An agent will autonomously execute a hard-coded plan at the correct time.

Milestone 2: The Thinking Agent

Sprint 4: The Planning Agent (Generative Planning)

Goal: Agents can generate their own daily plans.

Tasks:

Backend: Implement the planning system from Generative Agents.

Backend: The agent will now use an LLM to generate a high-level daily plan based on its constitution and memories.

Deliverable: At the start of a new day, an agent generates and stores its own schedule.

Sprint 5: The Reflecting Agent

Goal: Agents can reflect on experiences to form higher-level insights.

Tasks:

Backend: Implement the reflection triggering system.

Backend: Create the reflection generation logic using LLM analysis of the memory stream.

Backend: Store reflections back into the memory stream.

Deliverable: An agent can generate insights like "I seem to be spending a lot of time at the library" and use this reflection in future decisions.

Sprint 6: The Strategic Agent (Metacognition)

Goal: Agents can evaluate their performance and adjust strategies.

Tasks:

Backend: Implement performance monitoring for agent goals.

Backend: Create the metacognitive evaluation system ("Am I succeeding?").

Backend: Implement logic for strategy adjustment based on the evaluation.

Deliverable: An agent failing to complete a multi-day plan (e.g., "write a book") will generate a metacognitive thought ("My current strategy of writing for 1 hour a day isn't working") and create a new, more aggressive plan.

Milestone 3: The Optimized & Social Agent

Sprint 7: The Efficient Agent (Lifestyle Policies)

Goal: Optimize repetitive tasks to reduce cost.

Tasks:

Backend: Implement the Lifestyle Policy cache.

Backend: When an agent successfully completes a routine (e.g., "make breakfast"), store the action sequence.

Backend: The next time, the agent will check the cache before calling the LLM.

Deliverable: An agent making breakfast on day 2 will use significantly fewer (or zero) LLM calls than on day 1.

Sprint 8: The Social Agent (Agent-Player Interaction & Social Memory)

Goal: Players can have context-rich, affordable conversations with agents.

Tasks:

Backend: Implement the Social Memory summarizer.

Frontend: Create the dialogue UI.

Backend: Implement the POST /agent/interact endpoint that uses the compressed social summary.

Deliverable: A player can have a conversation with an agent that is both memory-rich and cost-effective.

Sprint 9: The Autonomous Society (Agent-Agent Interaction)

Goal: Agents can interact with each other autonomously.

Tasks:

Backend: Implement agent-to-agent conversation system using the Social Memory module.

Backend: Create social goal formation (friendship, collaboration).

Backend: Implement agent relationship tracking.

Deliverable: Two agents can be observed having a spontaneous conversation, forming a relationship that persists.

Milestone 4: Multiplayer & Launch Prep

Sprint 10: Multiplayer Foundation

Goal: Multiple players can join the persistent world and observe autonomous agent life.

Tasks:

Backend: Enhance Colyseus state schema to sync players, agents, and world state.

Backend: Implement authentication flow (/auth/login, /auth/register) and JWT middleware.

Frontend: Update client to handle multiple player entities with agent interactions.

Frontend: Implement the MainMenuScene with a login form.

Backend: Create persistent world state that continues when players leave.

Deliverable: Multiple players can join the same world and observe continuous agent life.

Sprint 11: Player-Agent Relationships & Persistence

Goal: Players can build meaningful relationships with agents that persist and influence the world.

Tasks:

Backend: Implement comprehensive player-agent relationship tracking.

Backend: Create relationship impact on agent behavior and decision-making.

Backend: Implement gift-giving and its impact on agent relationships.

Backend: Create unique storylines based on relationship development.

Frontend: Implement relationship status UI and interaction history.

Deliverable: Players can build deep, meaningful relationships with agents that create unique narrative experiences.

Sprint 12: Polish, Alpha Test & Launch Prep

Goal: Optimize agent performance and conduct comprehensive polish pass.

Tasks:

Backend: Optimize agent processing for larger populations (20+ agents).

Backend: Implement advanced agent coordination and conflict resolution.

Backend: Create emergent events and town-wide activities.

Frontend: Polish all UI elements for consistency and usability.

QA: Conduct extensive testing with multiple agents and players.

DevOps: Finalize deployment scripts and scale up server resources for alpha.

Community: Recruit alpha testers and create community spaces.

Analytics: Integrate comprehensive analytics to track agent behavior and player engagement.

Deliverable: A stable, monitored alpha test showcasing the world's first fully autonomous generative agent simulation.

(These sprints focus on scaling, polish, and player-facing features, building upon the now-complete agent architecture.)

