import { Point } from '../models/interfaces.js';

export class PathFinder {
  constructor(nodes, edges) {
    this.nodes = new Map();
    this.adjacencyList = new Map();
    
    for (const node of nodes) {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, []);
    }
    
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  addEdge(edge) {
    const fromId = edge.from.id;
    const toId = edge.to.id;
    
    if (this.adjacencyList.has(fromId) && this.adjacencyList.has(toId)) {
      this.adjacencyList.get(fromId).push({
        node: edge.to,
        edge: edge,
        weight: edge.length
      });
      this.adjacencyList.get(toId).push({
        node: edge.from,
        edge: edge,
        weight: edge.length
      });
    }
  }

  findNearestNode(point) {
    let nearestNode = null;
    let minDistance = Infinity;
    
    for (const node of this.nodes.values()) {
      if (node.position.floor !== point.floor) continue;
      const dist = node.position.distanceTo(point);
      if (dist < minDistance) {
        minDistance = dist;
        nearestNode = node;
      }
    }
    
    return nearestNode;
  }

  findShortestPath(startNode, endNode, time = null, ignoreBlocked = false) {
    if (!startNode || !endNode) return { path: [], distance: Infinity, edges: [] };
    
    const distances = new Map();
    const previous = new Map();
    const visited = new Set();
    
    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
    }
    distances.set(startNode.id, 0);
    
    while (true) {
      let current = null;
      let minDist = Infinity;
      
      for (const [nodeId, dist] of distances) {
        if (!visited.has(nodeId) && dist < minDist) {
          minDist = dist;
          current = this.nodes.get(nodeId);
        }
      }
      
      if (current === null || current.id === endNode.id) break;
      
      visited.add(current.id);
      
      const neighbors = this.adjacencyList.get(current.id) || [];
      
      for (const neighbor of neighbors) {
        if (visited.has(neighbor.node.id)) continue;
        
        let weight = neighbor.weight;
        
        if (!ignoreBlocked && neighbor.edge.isBlockedAt(time !== null ? time : 0)) {
          continue;
        }
        
        const newDist = distances.get(current.id) + weight;
        
        if (newDist < distances.get(neighbor.node.id)) {
          distances.set(neighbor.node.id, newDist);
          previous.set(neighbor.node.id, { node: current, edge: neighbor.edge });
        }
      }
    }
    
    const path = [];
    const edges = [];
    let current = endNode;
    
    while (current !== null && previous.get(current.id) !== null) {
      path.unshift(current);
      const prev = previous.get(current.id);
      if (prev.edge) {
        edges.unshift(prev.edge);
      }
      current = prev.node;
    }
    
    if (path.length > 0) {
      path.unshift(startNode);
    }
    
    return {
      path,
      edges,
      distance: distances.get(endNode.id) || Infinity
    };
  }

  findShortestPathToAnyExit(startPoint, exits, time = null, ignoreBlocked = false) {
    const startNode = this.findNearestNode(startPoint);
    if (!startNode) return { path: [], distance: Infinity, exit: null, edges: [] };
    
    let bestPath = { path: [], distance: Infinity, exit: null, edges: [] };
    
    for (const exit of exits) {
      if (!exit.isSafe) continue;
      
      const exitNode = this.findNearestNode(exit.position);
      if (!exitNode) continue;
      
      const result = this.findShortestPath(startNode, exitNode, time, ignoreBlocked);
      
      if (result.distance < bestPath.distance) {
        bestPath = {
          ...result,
          exit
        };
      }
    }
    
    return bestPath;
  }

  findNearestExit(startPoint, exits) {
    let nearestExit = null;
    let minDistance = Infinity;
    
    for (const exit of exits) {
      if (!exit.isSafe) continue;
      const dist = startPoint.distanceTo(exit.position);
      if (dist < minDistance) {
        minDistance = dist;
        nearestExit = exit;
      }
    }
    
    return nearestExit;
  }

  pointToEdgeDistance(point, edge) {
    const p1 = edge.from.position;
    const p2 = edge.to.position;
    
    if (p1.floor !== point.floor || p2.floor !== point.floor) return Infinity;
    
    const lineVec = { x: p2.x - p1.x, y: p2.y - p1.y };
    const pointVec = { x: point.x - p1.x, y: point.y - p1.y };
    
    const lineLenSq = lineVec.x * lineVec.x + lineVec.y * lineVec.y;
    if (lineLenSq === 0) return point.distanceTo(p1);
    
    let t = (pointVec.x * lineVec.x + pointVec.y * lineVec.y) / lineLenSq;
    t = Math.max(0, Math.min(1, t));
    
    const projection = new Point(
      p1.x + t * lineVec.x,
      p1.y + t * lineVec.y,
      point.floor
    );
    
    return point.distanceTo(projection);
  }

  isPointOnEdge(point, edge, threshold = 1.0) {
    return this.pointToEdgeDistance(point, edge) <= threshold;
  }
}

export default PathFinder;
