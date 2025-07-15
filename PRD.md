Product Requirements Document


Draft

1. Introduction & Vision

Project Starlight Valley is a multiplayer, 2D pixel-art life and farming simulation game for web browsers, inspired by the aesthetics and core loops of games like Stardew Valley. Its revolutionary feature is a cast of non-player characters (NPCs) powered by large language models (LLMs), allowing for dynamic, unscripted, and evolving conversations.

The core vision is to create a living world where players not only collaborate to build a thriving community but also compete for the affection of truly intelligent and responsive characters. We are moving beyond static dialogue trees to foster genuine emotional connection and emergent social dynamics, creating a new genre of social simulation.

2. Target Audience

Primary Audience (The Social Roleplayer): Ages 18-35. Fans of life simulation games (Stardew Valley, Animal Crossing, The Sims). They are drawn to character development, storytelling, and social interaction. They are intrigued by the promise of AI-driven characters and are looking for a deeper, more meaningful virtual world experience. They are active on platforms like Discord and Reddit.

Secondary Audience (The Competitive Strategist): Ages 20-40. Players who enjoy optimization, social strategy, and competitive game mechanics. They are motivated by leaderboards, achieving unique outcomes, and mastering game systems. They will be drawn to the challenge of "winning" the affection of the AI NPCs.

3. Core Features (Epics)

This PRD breaks down the project into five main feature epics.

Epic ID

Epic Name

Description

Priority

E01

Core Gameplay & World Interaction

Foundational single-player mechanics including movement, farming, crafting, and world interaction.

Critical

E02

LLM-Powered NPC System

The AI system that gives NPCs their unique personalities, memories, and conversational abilities.

Critical

E03

Multiplayer & Social Infrastructure

The framework that allows 8-16 players to interact in a shared game instance.

Critical

E04

Competitive Dating Mechanics

The systems that govern relationship building, tracking affection, and creating competition among players.

High

E05

Player Progression & Customization

Systems for character creation, skill development, and cosmetic customization.

Medium

4. Feature Details & User Stories

E01: Core Gameplay & World Interaction

As a player, I want a familiar and satisfying core gameplay loop to ground my experience in the world.

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

E02: LLM-Powered NPC System

As a player, I want to interact with NPCs who feel alive, intelligent, and memorable.

Story ID

User Story

Acceptance Criteria

U2.1

As a player, I can initiate a conversation with an NPC by approaching them and pressing a key.

A dialogue UI opens. I can type my message into a text input field.

U2.2

As an NPC, I can generate a unique, in-character response to a player's message using an LLM.

The response should reflect my defined personality, mood, and the context of the conversation. Response time should be managed to feel natural (e.g., under 3-4 seconds).

U2.3

As an NPC, I can remember key details from previous conversations with a specific player.

The system saves a summary of past interactions. My future responses reference these memories (e.g., "You mentioned you liked fishing, did you catch anything today?").

U2.4

As a system, I can provide each NPC with a unique "constitution" or base prompt.

The prompt defines the NPC's name, backstory, personality traits, goals, and speech patterns. This prompt is the foundation for all their generated dialogue.

U2.5

As a player, I see a "typing..." indicator while the NPC is generating a response.

This manages my expectation for response time and makes the interaction feel more natural.

E03: Multiplayer & Social Infrastructure

As a player, I want to share the world with my friends and other players in real-time.

Story ID

User Story

Acceptance Criteria

U3.1

As a player, I can join a game instance and see up to 15 other players moving in real-time.

Player movements are synchronized with acceptable latency. Player usernames are visible above their characters.

U3.2

As a player, I can communicate with other players via a global text chat.

A chat window is available. Messages are broadcast to all players in the instance.

U3.3

As a system, the server acts as the authoritative source of truth for all game states.

Player actions are validated by the server to prevent cheating.

E04: Competitive Dating Mechanics

As a player, I want to build relationships with NPCs and see how my efforts compare to other players.

Story ID

User Story

Acceptance Criteria

U4.1

As a system, I can track each player's relationship score (Affection) with each NPC.

Affection is a numerical value stored in the database. Positive interactions (e.g., thoughtful dialogue, giving liked gifts) increase the score.

U4.2

As an NPC, my dialogue and behavior towards a player changes based on their Affection score.

At low affection, I am distant. At high affection, I am friendly, share secrets, and offer unique quests.

U4.3

As a player, I can give an item from my inventory to an NPC as a gift.

NPCs will have programmed preferences, and the LLM will generate a response based on whether they like the gift.

U4.4

As a player, I can view a social leaderboard that shows which players have the highest Affection with each NPC.

This creates a clear competitive element and social hub.

5. Technology Stack & Architecture

Frontend Engine: Phaser 3 (utilizing its PixiJS renderer).

Backend Framework: Node.js with Colyseus for multiplayer state management and room handling.

AI/LLM Integration: Server-side API calls to a foundational model (e.g., OpenAI's GPT-4o, Anthropic's Claude 3 Sonnet) for its balance of capability and speed.

Database:

Primary: PostgreSQL for structured data (player accounts, inventory, core progression).

Cache/Real-time: Redis for managing session data and real-time leaderboards.

Deployment: Docker containers hosted on a cloud platform like AWS or DigitalOcean.

6. Non-Functional Requirements

Performance: The game must maintain a stable 30-60 FPS on a standard modern browser (Chrome, Firefox) on a mid-range laptop. Server tick rate should be at least 20Hz.

Scalability: The server architecture must support multiple concurrent game instances of 16 players each.

Security: All client-server communication must be encrypted. The server must be authoritative to prevent cheating. Implement rate limiting on API endpoints, especially chat and LLM interactions.

Accessibility: Use clear, legible pixel fonts. Ensure color choices have sufficient contrast. All core interactions should be possible via keyboard.

7. Monetization Strategy (Initial Ideas)

The game will be free-to-play to maximize audience reach.

Primary: Sale of a "Starlight Pass" (Battle Pass) each season, offering exclusive cosmetic items (clothing, furniture) and convenience items that do not provide a competitive advantage in dating.

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

