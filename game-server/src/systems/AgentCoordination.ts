/**
 * Agent Coordination System
 * Prevents conflicts and manages agent interactions
 * Handles spatial coordination and resource management
 */

import { SpawnedAgent } from './AgentSpawner';
import { AgentState } from './AgentStateMachine';
import { Point } from './Pathfinding';

export interface CoordinationRequest {
  agentId: string;
  requestType: 'movement' | 'interaction' | 'resource';
  targetPosition?: Point;
  targetResource?: string;
  targetAgentId?: string;
  priority: number;
  timestamp: number;
}

export interface CoordinationResult {
  approved: boolean;
  reason?: string;
  alternativePosition?: Point;
  waitTime?: number;
}

export class AgentCoordination {
  private occupiedPositions: Map<string, string> = new Map(); // position -> agentId
  private reservedPositions: Map<string, { agentId: string; expiresAt: number }> = new Map();
  private interactionTargets: Map<string, string> = new Map(); // targetId -> agentId
  private resourceAccess: Map<string, string[]> = new Map(); // resource -> [agentIds]
  private pendingRequests: Map<string, CoordinationRequest[]> = new Map();
  
  private reservationTimeoutMs: number = 5000; // 5 seconds
  private proximityRadius: number = 2; // tiles
  private maxAgentsPerResource: number = 3;

  constructor() {
    // Clean up expired reservations periodically
    setInterval(() => {
      this.cleanupExpiredReservations();
    }, 1000);
  }

  /**
   * Request coordination for agent action
   */
  public requestCoordination(
    request: CoordinationRequest,
    agents: Map<string, SpawnedAgent>
  ): CoordinationResult {
    const agent = agents.get(request.agentId);
    if (!agent) {
      return { approved: false, reason: 'Agent not found' };
    }

    switch (request.requestType) {
      case 'movement':
        return this.handleMovementRequest(request, agent, agents);
      case 'interaction':
        return this.handleInteractionRequest(request, agent, agents);
      case 'resource':
        return this.handleResourceRequest(request, agent, agents);
      default:
        return { approved: false, reason: 'Unknown request type' };
    }
  }

  /**
   * Handle movement coordination request
   */
  private handleMovementRequest(
    request: CoordinationRequest,
    agent: SpawnedAgent,
    agents: Map<string, SpawnedAgent>
  ): CoordinationResult {
    if (!request.targetPosition) {
      return { approved: false, reason: 'No target position specified' };
    }

    const targetKey = this.positionToKey(request.targetPosition);
    
    // Check if position is already occupied
    const occupyingAgent = this.occupiedPositions.get(targetKey);
    if (occupyingAgent && occupyingAgent !== request.agentId) {
      // Try to find alternative position
      const alternative = this.findAlternativePosition(
        request.targetPosition,
        agents,
        request.agentId
      );
      
      if (alternative) {
        return {
          approved: true,
          alternativePosition: alternative
        };
      }
      
      return {
        approved: false,
        reason: 'Position occupied',
        waitTime: 2000 // Wait 2 seconds before retry
      };
    }

    // Check if position is reserved
    const reservation = this.reservedPositions.get(targetKey);
    if (reservation && reservation.agentId !== request.agentId) {
      if (reservation.expiresAt > Date.now()) {
        return {
          approved: false,
          reason: 'Position reserved',
          waitTime: reservation.expiresAt - Date.now()
        };
      } else {
        // Reservation expired, clean it up
        this.reservedPositions.delete(targetKey);
      }
    }

    // Check for proximity conflicts
    const proximityConflict = this.checkProximityConflicts(
      request.targetPosition,
      request.agentId,
      agents
    );
    
    if (proximityConflict) {
      return {
        approved: false,
        reason: 'Too close to other agents',
        waitTime: 1000
      };
    }

    // Reserve the position
    this.reservePosition(request.targetPosition, request.agentId);
    
    return { approved: true };
  }

  /**
   * Handle interaction coordination request
   */
  private handleInteractionRequest(
    request: CoordinationRequest,
    agent: SpawnedAgent,
    agents: Map<string, SpawnedAgent>
  ): CoordinationResult {
    if (!request.targetAgentId) {
      return { approved: false, reason: 'No target agent specified' };
    }

    const targetAgent = agents.get(request.targetAgentId);
    if (!targetAgent) {
      return { approved: false, reason: 'Target agent not found' };
    }

    // Check if target agent is available for interaction
    if (!targetAgent.schema.isInteractable) {
      return { approved: false, reason: 'Target agent not interactable' };
    }

    // Check if target agent is already in interaction
    const currentInteraction = this.interactionTargets.get(request.targetAgentId);
    if (currentInteraction && currentInteraction !== request.agentId) {
      return {
        approved: false,
        reason: 'Target agent already in interaction',
        waitTime: 5000
      };
    }

    // Reserve the interaction
    this.interactionTargets.set(request.targetAgentId, request.agentId);
    this.interactionTargets.set(request.agentId, request.targetAgentId);
    
    return { approved: true };
  }

  /**
   * Handle resource access coordination request
   */
  private handleResourceRequest(
    request: CoordinationRequest,
    agent: SpawnedAgent,
    agents: Map<string, SpawnedAgent>
  ): CoordinationResult {
    if (!request.targetResource) {
      return { approved: false, reason: 'No target resource specified' };
    }

    const currentUsers = this.resourceAccess.get(request.targetResource) || [];
    
    // Check if already has access
    if (currentUsers.includes(request.agentId)) {
      return { approved: true };
    }

    // Check if resource is at capacity
    if (currentUsers.length >= this.maxAgentsPerResource) {
      return {
        approved: false,
        reason: 'Resource at capacity',
        waitTime: 3000
      };
    }

    // Grant access
    currentUsers.push(request.agentId);
    this.resourceAccess.set(request.targetResource, currentUsers);
    
    return { approved: true };
  }

  /**
   * Update agent position in coordination system
   */
  public updateAgentPosition(agentId: string, oldPosition: Point, newPosition: Point): void {
    const oldKey = this.positionToKey(oldPosition);
    const newKey = this.positionToKey(newPosition);
    
    // Remove from old position
    this.occupiedPositions.delete(oldKey);
    
    // Add to new position
    this.occupiedPositions.set(newKey, agentId);
    
    // Remove any reservation for new position
    this.reservedPositions.delete(newKey);
  }

  /**
   * Release agent from coordination system
   */
  public releaseAgent(agentId: string): void {
    // Remove from occupied positions
    for (const [position, occupier] of this.occupiedPositions) {
      if (occupier === agentId) {
        this.occupiedPositions.delete(position);
      }
    }
    
    // Remove from reserved positions
    for (const [position, reservation] of this.reservedPositions) {
      if (reservation.agentId === agentId) {
        this.reservedPositions.delete(position);
      }
    }
    
    // Remove from interactions
    for (const [targetId, interactorId] of this.interactionTargets) {
      if (interactorId === agentId) {
        this.interactionTargets.delete(targetId);
      }
    }
    
    // Remove from resource access
    for (const [resource, users] of this.resourceAccess) {
      const index = users.indexOf(agentId);
      if (index !== -1) {
        users.splice(index, 1);
        if (users.length === 0) {
          this.resourceAccess.delete(resource);
        }
      }
    }
  }

  /**
   * Release interaction between agents
   */
  public releaseInteraction(agentId: string, targetId: string): void {
    this.interactionTargets.delete(agentId);
    this.interactionTargets.delete(targetId);
  }

  /**
   * Release resource access
   */
  public releaseResource(agentId: string, resource: string): void {
    const users = this.resourceAccess.get(resource);
    if (users) {
      const index = users.indexOf(agentId);
      if (index !== -1) {
        users.splice(index, 1);
        if (users.length === 0) {
          this.resourceAccess.delete(resource);
        }
      }
    }
  }

  /**
   * Find alternative position near target
   */
  private findAlternativePosition(
    target: Point,
    agents: Map<string, SpawnedAgent>,
    agentId: string
  ): Point | null {
    const radius = 3;
    
    for (let r = 1; r <= radius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) === r || Math.abs(dy) === r) {
            const candidate = { x: target.x + dx, y: target.y + dy };
            const candidateKey = this.positionToKey(candidate);
            
            if (!this.occupiedPositions.has(candidateKey) &&
                !this.reservedPositions.has(candidateKey) &&
                !this.checkProximityConflicts(candidate, agentId, agents)) {
              return candidate;
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Check for proximity conflicts
   */
  private checkProximityConflicts(
    position: Point,
    agentId: string,
    agents: Map<string, SpawnedAgent>
  ): boolean {
    for (const [otherId, otherAgent] of agents) {
      if (otherId === agentId) continue;
      
      const distance = Math.sqrt(
        Math.pow(position.x - otherAgent.schema.x, 2) +
        Math.pow(position.y - otherAgent.schema.y, 2)
      );
      
      if (distance < this.proximityRadius) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Reserve position for agent
   */
  private reservePosition(position: Point, agentId: string): void {
    const key = this.positionToKey(position);
    this.reservedPositions.set(key, {
      agentId,
      expiresAt: Date.now() + this.reservationTimeoutMs
    });
  }

  /**
   * Convert position to string key
   */
  private positionToKey(position: Point): string {
    return `${Math.floor(position.x)},${Math.floor(position.y)}`;
  }

  /**
   * Clean up expired reservations
   */
  private cleanupExpiredReservations(): void {
    const now = Date.now();
    
    for (const [key, reservation] of this.reservedPositions) {
      if (reservation.expiresAt < now) {
        this.reservedPositions.delete(key);
      }
    }
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): object {
    return {
      occupiedPositions: this.occupiedPositions.size,
      reservedPositions: this.reservedPositions.size,
      activeInteractions: this.interactionTargets.size,
      resourceAccess: this.resourceAccess.size,
      proximityRadius: this.proximityRadius
    };
  }
} 