Product Requirements Document


Draft

1. Introduction & Vision

Project Heartwood Valley is a multiplayer, 2D pixel-art life and farming simulation game for web browsers that features the world's first fully autonomous generative agents as NPCs. Inspired by breakthrough research in "Generative Agents: Interactive Simulacra of Human Behavior" and "Metacognition is all you need? Using Introspection in Generative Agents to Improve Goal-directed Behavior", this game creates a living, breathing small town where NPCs have their own memories, schedules, goals, and relationships.

The core vision is to create a persistent social simulation where autonomous agents live authentic lives - working, socializing, pursuing goals, and forming relationships with each other and players. These agents remember every interaction, reflect on their experiences, plan for the future, and adapt their behavior based on outcomes. Players enter this world as newcomers to a town that continues to exist and evolve even when they're not playing, creating unprecedented emergent storytelling and social dynamics.

2. Target Audience

Primary Audience (The AI Enthusiast): Ages 22-40. Tech-savvy individuals fascinated by artificial intelligence, emergent behavior, and autonomous systems. They are drawn to witnessing and interacting with the first truly agentic NPCs in gaming. They want to explore the boundaries of AI behavior and be part of a groundbreaking social simulation experience. They are active on platforms like Discord, Reddit, and AI communities.

Secondary Audience (The Social Simulation Lover): Ages 18-35. Fans of life simulation games (Stardew Valley, Animal Crossing, The Sims) who crave deeper, more meaningful social interactions. They are looking for authentic relationship-building experiences and emergent storytelling that goes beyond scripted content. They value character development, community building, and narrative depth.

Tertiary Audience (The Competitive Strategist): Ages 20-40. Players who enjoy optimization, social strategy, and competitive game mechanics. They are motivated by understanding agent behavior patterns, achieving unique relationship outcomes, and mastering complex social systems. They will be drawn to the challenge of building meaningful relationships with autonomous agents.

3. Core Features (Epics)

This PRD breaks down the project into seven main feature epics.

Epic ID

Epic Name

Description

Priority

E01

Core Gameplay & World Interaction

Foundational mechanics including movement, farming, crafting, and world interaction in the persistent town.

Critical

E02

Agent Foundation: Memory & Planning

The base agent architecture with memory streams, retrieval, and goal-oriented planning based on Generative Agents research.

Critical

E03

Agent Intellect: Reflection & Metacognition

Systems for agents to generate high-level insights (reflection) and evaluate their own performance and strategies (metacognition).

Critical

E04

Agent Optimization & Affordability

Systems to reduce LLM costs, including caching routine behaviors (Lifestyle Policy) and compressing social context (Social Memory).

High

E05

Agent Social Dynamics

Systems enabling autonomous agent-to-agent and player-agent interactions, relationships, and coordination.

High

E06

Multiplayer & Persistence

The framework that allows players to interact in a shared, persistent world that evolves even when they are offline.

High

E07

Player Progression & Customization

Systems for character creation, skill development, and meaningful progression within the agent community.

Medium

4. Feature Details & User Stories

E01: Core Gameplay & World Interaction

As a player, I want a familiar and satisfying core gameplay loop to ground my experience in the persistent world.

Story ID

User Story

Acceptance Criteria

U1.1

As a player, I can move my character around a 2D tile-based world using keyboard controls.

Character moves in 4 or 8 directions. Collision detection prevents walking through solid objects. Smooth animations for walking/running.

U1.2

As a player, I can perform basic farming actions: tilling soil, planting seeds, watering crops.

Player can use tools. Crops grow over time (days). Player can harvest mature crops to get items.

U1.3

As a player, I can manage an inventory to hold items I've gathered or crafted.

A UI panel shows inventory slots. I can select, move, and stack items. Inventory has a finite capacity.

U1.4

As a player, I can interact with world objects (e.g., open chests, read signs, chop trees).

Pressing an action key near an object triggers an interaction.

U1.5

As a player, I can observe autonomous agents living their lives in the world.

Agents move around the world, perform activities, and interact with each other without player intervention.

E02: Autonomous Agent System

As a player, I want to interact with agents who live authentic, autonomous lives with their own goals and personalities.

Story ID

User Story

Acceptance Criteria

U2.1

As an agent, I can maintain my own daily schedule and routines.

Agent follows a personalized schedule (work, meals, social time) that can be interrupted by events or social interactions.

U2.2

As an agent, I can form and pursue my own goals.

Agent can set personal goals (craft items, socialize, explore) and work towards them over time.

U2.3

As an agent, I can perceive and respond to my environment.

Agent observes other agents, players, and world events, storing these as memories that influence future behavior.

U2.4

As an agent, I can initiate conversations and interactions with other agents.

Agent can approach other agents for social interaction based on goals, schedules, or emergent needs.

U2.5

As an agent, I can adapt my behavior based on past experiences.

Agent's personality and preferences evolve based on interactions and outcomes.

E03: Agent Intellect: Reflection & Metacognition

As a player, I want agents to learn from their experiences and get smarter over time.

Story ID

User Story

Acceptance Criteria

U3.1

As an agent, I can periodically generate reflections about my recent experiences.

Agent analyzes recent memories to form insights about relationships, preferences, and patterns. These reflections are stored in the memory stream.

U3.2

As an agent, I can evaluate my own performance towards achieving a goal.

Agent periodically asks itself "Am I succeeding?" and generates a self-assessment, storing it as a metacognitive memory.

U3.3

As an agent, if I am failing at a goal, I can change my strategy.

A low performance evaluation triggers a metacognitive process where the agent generates new plans or modifies its core goals.

U3.4

As an agent, I can form opinions and preferences based on accumulated experiences.

Agent develops likes, dislikes, and preferences that influence future behavior.

U3.5

As a player, I can observe agents referencing past interactions in conversations.

Agent mentions previous conversations and shared experiences naturally in dialogue.

E04: Agent Optimization & Affordability

As a system, I need to manage the high cost of running many LLM-powered agents simultaneously.

Story ID

User Story

Acceptance Criteria

U4.1

As a system, I can cache an agent's common daily routines to reduce LLM calls.

A successful action sequence for a routine (e.g., "make coffee") is stored as a "Lifestyle Policy." The next time, the agent executes the policy directly without calling the LLM.

U4.2

As a system, I can create compressed summaries of social context for conversations.

Before generating dialogue, the system creates a "Social Memory" summary (e.g., "Relationship: Friends, Feeling: Happy, Recent Events: Talked about the festival"). This is used in the prompt instead of many raw memories.

U4.3

As a system, I can reduce LLM costs while maintaining agent intelligence.

Common routines are cached and reused, social context is compressed, and repeated patterns are optimized without sacrificing agent authenticity.

U4.4

As a system, I can scale to support larger agent populations cost-effectively.

The affordability systems allow for more agents to run simultaneously within the same budget constraints.

U4.5

As a player, I cannot distinguish between cached and generated agent behaviors.

Agent behaviors remain consistent and authentic regardless of whether they're using cached policies or fresh LLM generation.

E05: Multiplayer & Social Infrastructure

As a player, I want to share the persistent world with other players and observe agent behaviors together.

Story ID

User Story

Acceptance Criteria

U5.1

As a player, I can join a game instance and see up to 15 other players moving in real-time.

Player movements are synchronized with acceptable latency. Player usernames are visible above their characters.

U5.2

As a player, I can communicate with other players via a global text chat.

A chat window is available. Messages are broadcast to all players in the instance.

U5.3

As a system, the server acts as the authoritative source of truth for all game states.

Player actions are validated by the server to prevent cheating.

U5.4

As a player, I can observe autonomous agents interacting with each other and other players.

Agent-agent interactions are visible to all players in the instance, creating shared emergent experiences.

U5.5

As a player, I can see the persistent world continuing to evolve when I'm not playing.

Agents continue their lives, form relationships, and create events that persist between player sessions.

E06: Agent-Agent Interactions

As a player, I want to witness authentic social dynamics between autonomous agents.

Story ID

User Story

Acceptance Criteria

U6.1

As an agent, I can initiate conversations with other agents based on my goals and social needs.

Agent approaches other agents for conversation, collaboration, or to fulfill social goals.

U6.2

As an agent, I can form and maintain relationships with other agents.

Agent develops friendships, rivalries, and working relationships that influence future interactions.

U6.3

As an agent, I can coordinate activities with other agents.

Agents can plan and execute group activities like shared meals, festivals, or work projects.

U6.4

As an agent, I can have conflicts and resolve them through interaction.

Agents can disagree, compete for resources, and work through conflicts naturally.

U6.5

As a player, I can observe complex social dynamics emerging from agent interactions.

Agent relationships create emergent stories, alliances, and social hierarchies that players can witness.

E07: Player Progression & Customization

As a player, I want to develop my character and build meaningful relationships within the agent community.

Story ID

User Story

Acceptance Criteria

U7.1

As a player, I can create a unique character with customizable appearance and background.

Character creator allows appearance customization and background selection that influences agent interactions.

U7.2

As a player, I can develop skills that are recognized by agents.

Skill progression in farming, crafting, or social abilities affects how agents perceive and interact with me.

U7.3

As a player, I can build deep relationships with agents over time.

Agent relationships develop through consistent interaction, shared experiences, and mutual understanding.

U7.4

As a player, I can influence the town's development through my actions and relationships.

Player actions and agent relationships can lead to town improvements, new events, or community changes.

U7.5

As a player, I can discover unique storylines that emerge from my specific interactions with agents.

Each player's experience creates unique narrative paths based on their relationships and choices.

5. Technology Stack & Architecture

Frontend Engine: Phaser 3 (utilizing its PixiJS renderer) for rich 2D graphics and smooth agent animations.

Backend Framework: Node.js with Colyseus for multiplayer state management and real-time agent coordination.

AI/LLM Integration: Server-side API calls to foundational models (OpenAI's GPT-4o, Anthropic's Claude 3 Sonnet) for agent reasoning, dialogue, reflection, and metacognition.

Agent Systems: Custom Node.js services for agent management, memory processing, reflection generation, and inter-agent coordination.

Database:

Primary: PostgreSQL for structured data (player accounts, agent profiles, long-term memories, relationships).

Vector Database: Pinecone or Weaviate for semantic memory storage and retrieval.

Cache/Real-time: Redis for agent states, active plans, real-time coordination, and memory caching.

Deployment: Docker containers hosted on a cloud platform like AWS or DigitalOcean with auto-scaling for agent processing.

6. Non-Functional Requirements

Performance: The game must maintain a stable 30-60 FPS on a standard modern browser (Chrome, Firefox) on a mid-range laptop. Server tick rate should be at least 20Hz.

Scalability: The server architecture must support multiple concurrent game instances of 16 players each.

Security: All client-server communication must be encrypted. The server must be authoritative to prevent cheating. Implement rate limiting on API endpoints, especially chat and LLM interactions.

Accessibility: Use clear, legible pixel fonts. Ensure color choices have sufficient contrast. All core interactions should be possible via keyboard.

7. Monetization Strategy (Initial Ideas)

The game will be free-to-play to maximize audience reach.

Primary: Sale of a "Heartwood Pass" (Battle Pass) each season, offering exclusive cosmetic items (clothing, furniture) and convenience items that do not provide a competitive advantage in dating.

Secondary: A premium currency used to purchase specific cosmetic items directly.

8. Success Metrics (KPIs)

Engagement: Daily Active Users (DAU), Average Session Length, Player Retention (Day 1, Day 7, Day 30).

Social: Number of chat messages sent per session. Average number of unique players interacted with per session.

Monetization: Conversion Rate (percentage of players who make a purchase), Average Revenue Per Paying User (ARPPU).

Technical: Server uptime, average API response time for LLM calls.

9. Assumptions & Risks

Assumption: Players will find emergent, unscripted AI conversations more engaging than traditional dialogue trees.

Assumption: The competitive aspect of dating will be seen as fun and not create a toxic environment.

Risk (High): LLM API costs could become unsustainable if player growth is high. Mitigation: Implement strict cooldowns, conversation length limits, and use more cost-effective models.

Risk (Medium): LLM-generated content could be inappropriate or break character. Mitigation: Implement robust content filtering on both input and output, and continuously refine NPC base prompts.

Risk (Medium): The technical complexity of integrating all systems (game engine, multiplayer server, LLM, database) could lead to development delays.

10. Future Scope & V2 Ideas

Player housing and decoration.

Marriage and family system with NPCs.

Expanding the world with new areas and NPCs.

Player-run shops and economy.

Seasonal events and festivals with unique multiplayer activities.

Fine-tuning our own open-source LLM on game-specific data to reduce costs and improve performance.

