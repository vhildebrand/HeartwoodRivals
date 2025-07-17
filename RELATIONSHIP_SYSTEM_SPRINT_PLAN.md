# Sprint Plan: Competitive Social & Relationship System

## 1. High-Level Roadmap

This document details the sprint-by-sprint plan for implementing the **Competitive Social & Relationship System**. The project is broken down into six sprints, starting with foundational backend work and progressively building up to full AI integration and player-facing features.

*   **Sprint 1: Foundation & Data Models**: Laying the groundwork in the database and creating core manager services.
*   **Sprint 2: The Witness & Reputation System**: Making NPCs passive observers of the social world and building the public reputation system.
*   **Sprint 3: The Gossip System**: Introducing active player influence through gossip and social manipulation.
*   **Sprint 4: The Romantic Contention Model**: Implementing the core AI state machine that governs NPC romantic decision-making.
*   **Sprint 5: AI-Driven Behavior & Planning**: Translating AI strategies into observable, in-game NPC actions and quests.
*   **Sprint 6: Polish, Balancing & Player Experience**: Tuning the system for fairness, fun, and intuitive gameplay.

---

## 🚀 SPRINT BREAKDOWN

### **Sprint 1: Foundation & Data Models**

**Goal**: Implement the necessary database schema changes and create the core backend services. This sprint is entirely focused on backend infrastructure.

**Timeline**: 1 week

| Task ID | Task                                                               | Service      | Priority | Status    |
| :------ | :----------------------------------------------------------------- | :----------- | :------- | :-------- |
| RS-101  | **DB**: Create migration for `agent_player_relationships` table    | `db`         | **High** | `Pending` |
| RS-102  | **DB**: Create migration for new `player_reputations` table        | `db`         | **High** | `Pending` |
| RS-103  | **DB**: Create migration for new `gossip_logs` table               | `db`         | **High** | `Pending` |
| RS-104  | **Backend**: Create `RelationshipManager` service stub in `web-api`  | `web-api`    | **High** | `Pending` |
| RS-105  | **Backend**: Create `ReputationManager` service stub in `web-api`    | `web-api`    | **High** | `Pending` |
| RS-106  | **Testing**: Write unit tests for all database migrations          | `db`         | `Medium` | `Pending` |

**Deliverable**: A patched database schema and placeholder manager services ready for logic implementation. The game will run, but no new features will be visible.

---

### **Sprint 2: The Witness & Reputation System**

**Goal**: Enable NPCs to passively observe player interactions and use that information to build a public reputation score for each player.

**Timeline**: 1-2 weeks

| Task ID | Task                                                                     | Service      | Priority | Status    |
| :------ | :----------------------------------------------------------------------- | :----------- | :------- | :-------- |
| RS-201  | **Backend**: Enhance `AgentObservationSystem` to tag "witnessable events"  | `game-server`  | **High** | `Pending` |
| RS-202  | **Backend**: `AgentMemoryManager` stores witnessed events as high-importance | `web-api`    | **High** | `Pending` |
| RS-203  | **Backend**: Implement `ReputationManager` to update scores from memories    | `web-api`    | **High** | `Pending` |
| RS-204  | **Backend**: NPC greetings are influenced by player reputation score       | `web-api`    | `Medium` | `Pending` |
| RS-205  | **Testing**: Integration test: player gives gift, witness NPC records it   | `e2e`        | **High** | `Pending` |
| RS-206  | **Testing**: Verify reputation score changes based on witnessed actions      | `e2e`        | `Medium` | `Pending` |

**Deliverable**: NPCs will now form memories about positive/negative social interactions they witness. A player's reputation will change based on their public actions.

---

### **Sprint 3: Conversational Gossip Analysis**

**Goal**: Enhance the AI to detect and analyze gossip within natural conversation, allowing players to influence NPC opinions and reputations through dialogue.

**Timeline**: 2 weeks

| Task ID | Task                                                                     | Service      | Priority | Status    |
| :------ | :----------------------------------------------------------------------- | :----------- | :------- | :-------- |
| RS-301  | **Backend**: Enhance `LLMWorker` with a post-response analysis step        | `web-api`    | **High** | `Pending` |
| RS-302  | **Backend**: Develop LLM prompt to detect gossip, subject, and sentiment   | `web-api`    | **High** | `Pending` |
| RS-303  | **Backend**: Log detected gossip and its credibility to `gossip_logs`      | `web-api`    | `Medium` | `Pending` |
| RS-304  | **Backend**: `ReputationManager` updates scores based on analyzed gossip   | `web-api`    | `Medium` | `Pending` |
| RS-305  | **Testing**: E2E test: Player makes a statement, verify gossip is logged   | `e2e`        | **High** | `Pending` |
| RS-306  | **Testing**: Verify NPC creates the correct memory from the conversation | `e2e`        | `High` | `Pending` |


**Deliverable**: Players can now influence each other's reputations by talking about them to NPCs. The AI will interpret these conversations and create corresponding memories and reputation adjustments. There will be no UI change.

---

### **Sprint 4: The Romantic Contention Model**

**Goal**: Implement the core state machine for NPC romantic decision-making, including the AI triggers for reflection and metacognition.

**Timeline**: 2 weeks

| Task ID | Task                                                                             | Service      | Priority | Status    |
| :------ | :------------------------------------------------------------------------------- | :----------- | :------- | :-------- |
| RS-401  | **Backend**: `RelationshipManager` updates `contention_state` in the database      | `web-api`    | **High** | `Pending` |
| RS-402  | **Backend**: Trigger Metacognitive event on entering `Conflicted` state            | `web-api`    | **High** | `Pending` |
| RS-403  | **Backend**: Trigger Reflection event on entering `Focused` state                  | `web-api`    | **High** | `Pending` |
| RS-404  | **Backend**: Develop and integrate specialized LLM prompts for social situations | `web-api`    | **High** | `Pending` |
| RS-405  | **Backend**: Implement `Exclusive` state logic and `dating` relationship flag      | `web-api`    | `Medium` | `Pending` |
| RS-406  | **Testing**: Unit tests for `RelationshipManager` state transition logic         | `web-api`    | `High` | `Pending` |
| RS-407  | **Testing**: Integration test to verify AI jobs are queued on state changes        | `e2e`        | `Medium` | `Pending` |

**Deliverable**: NPCs are now internally aware of their social standing with players. They will trigger advanced AI processing when faced with complex romantic situations, but their behavior will not yet change.

---

### **Sprint 5: AI-Driven Behavior & Planning**

**Goal**: Translate the AI's new strategic thoughts from Sprint 4 into observable, in-game NPC actions, quests, and dialogue.

**Timeline**: 2-3 weeks

| Task ID | Task                                                                   | Service       | Priority | Status    |
| :------ | :--------------------------------------------------------------------- | :------------ | :------- | :-------- |
| RS-501  | **Backend**: `PlanningSystem` understands new goals (`observe_players`, etc.) | `game-server` | **High** | `Pending` |
| RS-502  | **Backend**: Add new social activities to `ActivityManifest`             | `game-server` | **High** | `Pending` |
| RS-503  | **Backend**: Implement logic for NPC-initiated "defining moment" quest   | `game-server` | **High** | `Pending` |
| RS-504  | **Frontend**: Implement subtle dialogue changes reflecting NPC state     | `client`      | `Medium` | `Pending` |
| RS-505  | **Frontend**: Visualize new social activities (e.g., group hangouts)     | `client`      | `Medium` | `Pending` |
| RS-506  | **Testing**: E2E test: Trigger `Conflicted` state, verify NPC plans a hangout | `e2e`         | **High** | `Pending` |
| RS-507  | **Testing**: E2E test: Trigger `Focused` state, verify NPC plans a private date | `e2e`         | **High** | `Pending` |

**Deliverable**: The full system comes to life. NPCs will now act on their AI-generated social strategies, creating dynamic events and quests for players.

---

### **Sprint 6: Polish, Balancing & Player Experience**

**Goal**: Refine and balance the entire system to ensure it is fair, fun, and robust against exploits.

**Timeline**: 2 weeks

| Task ID | Task                                                                   | Service       | Priority | Status    |
| :------ | :--------------------------------------------------------------------- | :------------ | :------- | :-------- |
| RS-601  | **Balancing**: Tune all numerical values (affection, reputation, thresholds) | `config`      | **High** | `Pending` |
| RS-602  | **Backend**: Enhance Metacognition to better handle conflicting information | `web-api`     | **High** | `Pending` |
| RS-603  | **UI/UX**: Improve player feedback with more nuanced dialogue variations    | `client`      | `Medium` | `Pending` |
| RS-604  | **QA**: Full regression and exploratory testing of the social system     | `all`         | **High** | `Pending` |
| RS-605  | **Docs**: Update `PRD.md` and `DesignDoc.md` with final implementation   | `docs`        | `Medium` | `Pending` |

**Deliverable**: A complete, balanced, and well-documented Competitive Social & Relationship System, ready for player testing. 