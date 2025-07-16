/**
 * Pathfinding System
 * Implements A* pathfinding algorithm for agent movement
 * Integrates with MapManager for collision detection
 */

import { MapManager } from '../maps/MapManager';

export interface Point {
  x: number;
  y: number;
}

export interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic cost to end
  f: number; // Total cost (g + h)
  parent: PathNode | null;
}

export interface PathfindingOptions {
  allowDiagonal: boolean;
  maxSearchDistance: number;
  heuristicWeight: number;
}

export class Pathfinding {
  private mapManager: MapManager;
  private mapId: string;
  private defaultOptions: PathfindingOptions;

  constructor(mapId: string, options?: Partial<PathfindingOptions>) {
    this.mapManager = MapManager.getInstance();
    this.mapId = mapId;
    this.defaultOptions = {
      allowDiagonal: true,
      maxSearchDistance: 100,
      heuristicWeight: 1.0,
      ...options
    };
  }

  /**
   * Find path between two points using A* algorithm
   */
  public findPath(
    start: Point,
    end: Point,
    options?: Partial<PathfindingOptions>
  ): Point[] {
    const opts = { ...this.defaultOptions, ...options };
    
    // Validate start and end points
    if (!this.isValidPosition(start) || !this.isValidPosition(end)) {
      return [];
    }

    // If start and end are the same, return empty path
    if (start.x === end.x && start.y === end.y) {
      return [];
    }

    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();
    
    // Create start node
    const startNode: PathNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: this.calculateHeuristic(start, end),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h * opts.heuristicWeight;
    
    openSet.push(startNode);
    
    while (openSet.length > 0) {
      // Find node with lowest f score
      let currentNode = openSet[0];
      let currentIndex = 0;
      
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < currentNode.f) {
          currentNode = openSet[i];
          currentIndex = i;
        }
      }
      
      // Move current node from open to closed set
      openSet.splice(currentIndex, 1);
      closedSet.add(this.nodeKey(currentNode));
      
      // Check if we reached the end
      if (currentNode.x === end.x && currentNode.y === end.y) {
        return this.reconstructPath(currentNode);
      }
      
      // Check all neighbors
      const neighbors = this.getNeighbors(currentNode, opts.allowDiagonal);
      
      for (const neighbor of neighbors) {
        const neighborKey = this.nodeKey(neighbor);
        
        // Skip if already processed or not walkable
        if (closedSet.has(neighborKey) || !this.isValidPosition(neighbor)) {
          continue;
        }
        
        // Calculate tentative g score
        const tentativeG = currentNode.g + this.calculateDistance(currentNode, neighbor);
        
        // Check if this path to neighbor is better
        let existingNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
        
        if (!existingNode) {
          // New node
          const newNode: PathNode = {
            x: neighbor.x,
            y: neighbor.y,
            g: tentativeG,
            h: this.calculateHeuristic(neighbor, end),
            f: 0,
            parent: currentNode
          };
          newNode.f = newNode.g + newNode.h * opts.heuristicWeight;
          
          openSet.push(newNode);
        } else if (tentativeG < existingNode.g) {
          // Better path found
          existingNode.g = tentativeG;
          existingNode.f = existingNode.g + existingNode.h * opts.heuristicWeight;
          existingNode.parent = currentNode;
        }
      }
      
      // Prevent infinite loops
      if (openSet.length > opts.maxSearchDistance) {
        break;
      }
    }
    
    // No path found
    return [];
  }

  /**
   * Find nearest walkable position to a target
   */
  public findNearestWalkablePosition(target: Point, maxRadius: number = 10): Point | null {
    if (this.isValidPosition(target)) {
      return target;
    }
    
    // Search in expanding circles
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let x = target.x - radius; x <= target.x + radius; x++) {
        for (let y = target.y - radius; y <= target.y + radius; y++) {
          // Only check perimeter of current radius
          if (Math.abs(x - target.x) === radius || Math.abs(y - target.y) === radius) {
            const point = { x, y };
            if (this.isValidPosition(point)) {
              return point;
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Smooth path by removing unnecessary waypoints
   */
  public smoothPath(path: Point[]): Point[] {
    if (path.length <= 2) {
      return path;
    }
    
    const smoothedPath: Point[] = [path[0]];
    let currentIndex = 0;
    
    while (currentIndex < path.length - 1) {
      let farthestIndex = currentIndex + 1;
      
      // Find the farthest point we can directly reach
      for (let i = currentIndex + 2; i < path.length; i++) {
        if (this.hasDirectPath(path[currentIndex], path[i])) {
          farthestIndex = i;
        } else {
          break;
        }
      }
      
      smoothedPath.push(path[farthestIndex]);
      currentIndex = farthestIndex;
    }
    
    return smoothedPath;
  }

  /**
   * Check if there's a direct path between two points (line of sight)
   */
  public hasDirectPath(start: Point, end: Point): boolean {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const steps = Math.max(dx, dy);
    
    if (steps === 0) return true;
    
    const xStep = (end.x - start.x) / steps;
    const yStep = (end.y - start.y) / steps;
    
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(start.x + xStep * i);
      const y = Math.round(start.y + yStep * i);
      
      if (!this.isValidPosition({ x, y })) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get next step in path towards target
   */
  public getNextStep(current: Point, target: Point): Point | null {
    const path = this.findPath(current, target);
    
    if (path.length === 0) {
      return null;
    }
    
    // Return first waypoint (after current position)
    return path[0];
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(a: Point, b: Point): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    
    // Diagonal movement costs more
    if (dx > 0 && dy > 0) {
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    return dx + dy;
  }

  /**
   * Calculate heuristic (Manhattan distance with diagonal adjustment)
   */
  private calculateHeuristic(a: Point, b: Point): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    
    // Diagonal distance heuristic
    return Math.max(dx, dy) + (Math.sqrt(2) - 1) * Math.min(dx, dy);
  }

  /**
   * Get neighbors of a node
   */
  private getNeighbors(node: PathNode, allowDiagonal: boolean): Point[] {
    const neighbors: Point[] = [];
    
    // Cardinal directions
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 1, y: 0 },  // Right
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }  // Left
    ];
    
    // Diagonal directions
    if (allowDiagonal) {
      directions.push(
        { x: 1, y: -1 },  // Up-Right
        { x: 1, y: 1 },   // Down-Right
        { x: -1, y: 1 },  // Down-Left
        { x: -1, y: -1 }  // Up-Left
      );
    }
    
    for (const dir of directions) {
      const neighbor = {
        x: node.x + dir.x,
        y: node.y + dir.y
      };
      
      neighbors.push(neighbor);
    }
    
    return neighbors;
  }

  /**
   * Check if position is valid and walkable
   */
  private isValidPosition(pos: Point): boolean {
    return this.mapManager.isTileWalkable(this.mapId, pos.x, pos.y);
  }

  /**
   * Generate unique key for node
   */
  private nodeKey(node: Point): string {
    return `${node.x},${node.y}`;
  }

  /**
   * Reconstruct path from end node
   */
  private reconstructPath(endNode: PathNode): Point[] {
    const path: Point[] = [];
    let current: PathNode | null = endNode;
    
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    
    // Remove start position from path
    path.shift();
    
    return path;
  }

  /**
   * Update map reference (if map changes)
   */
  public updateMap(newMapId: string): void {
    this.mapId = newMapId;
  }

  /**
   * Get pathfinding statistics for debugging
   */
  public getStats(): object {
    return {
      mapId: this.mapId,
      defaultOptions: this.defaultOptions
    };
  }
} 