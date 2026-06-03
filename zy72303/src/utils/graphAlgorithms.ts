import type { GraphNode, GraphEdge, PathResult } from '../types';

interface GraphAdjacency {
  [nodeId: string]: Array<{ target: string; edgeId: string; weight: number }>;
}

function buildAdjacencyList(nodes: GraphNode[], edges: GraphEdge[]): GraphAdjacency {
  const adjacency: GraphAdjacency = {};
  nodes.forEach(node => {
    adjacency[node.id] = [];
  });
  edges.forEach(edge => {
    if (adjacency[edge.source]) {
      adjacency[edge.source].push({
        target: edge.target,
        edgeId: edge.id,
        weight: edge.weight,
      });
    }
    if (adjacency[edge.target]) {
      adjacency[edge.target].push({
        target: edge.source,
        edgeId: edge.id,
        weight: edge.weight,
      });
    }
  });
  return adjacency;
}

export function dijkstra(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
  maxPathLength: number = 10
): PathResult | null {
  const adjacency = buildAdjacencyList(nodes, edges);
  
  const distances: { [nodeId: string]: number } = {};
  const previous: { [nodeId: string]: { node: string; edge: string } | null } = {};
  const visited: Set<string> = new Set();
  
  nodes.forEach(node => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
  });
  distances[sourceId] = 0;
  
  const unvisited = new Set(nodes.map(n => n.id));
  
  while (unvisited.size > 0) {
    let currentNode: string | null = null;
    let minDistance = Infinity;
    
    unvisited.forEach(nodeId => {
      if (distances[nodeId] < minDistance) {
        minDistance = distances[nodeId];
        currentNode = nodeId;
      }
    });
    
    if (currentNode === null || minDistance === Infinity) break;
    if (currentNode === targetId) break;
    
    unvisited.delete(currentNode);
    visited.add(currentNode);
    
    const neighbors = adjacency[currentNode] || [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.target)) continue;
      
      const alt = distances[currentNode] + neighbor.weight;
      if (alt < distances[neighbor.target]) {
        distances[neighbor.target] = alt;
        previous[neighbor.target] = { node: currentNode, edge: neighbor.edgeId };
      }
    }
  }
  
  if (distances[targetId] === Infinity) return null;
  
  const pathNodes: string[] = [];
  const pathEdges: string[] = [];
  let current: string | null = targetId;
  let pathLength = 0;
  type PrevEntry = { node: string; edge: string } | null | undefined;

  while (current !== null && pathLength < maxPathLength) {
    pathNodes.unshift(current);
    const prev: PrevEntry = previous[current];
    if (prev) {
      pathEdges.unshift(prev.edge);
      current = prev.node;
    } else {
      break;
    }
    pathLength++;
  }
  
  return {
    nodes: pathNodes,
    edges: pathEdges,
    totalWeight: distances[targetId],
  };
}

export function findAlternativePath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
  excludeEdges: string[],
  maxPathLength: number = 12
): PathResult | null {
  const filteredEdges = edges.filter(e => !excludeEdges.includes(e.id));
  return dijkstra(nodes, filteredEdges, sourceId, targetId, maxPathLength);
}

export function calculateDetourRatio(
  shortestPath: PathResult,
  alternativePath: PathResult
): number | null {
  if (shortestPath.totalWeight === 0) return null;
  return alternativePath.totalWeight / shortestPath.totalWeight;
}

export function getEdgeById(edges: GraphEdge[], edgeId: string): GraphEdge | undefined {
  return edges.find(e => e.id === edgeId);
}

export function getNodeById(nodes: GraphNode[], nodeId: string): GraphNode | undefined {
  return nodes.find(n => n.id === nodeId);
}

export function formatPathDescription(nodes: GraphNode[], path: PathResult): string {
  return path.nodes
    .map(nodeId => getNodeById(nodes, nodeId)?.label || nodeId)
    .join(' → ');
}
