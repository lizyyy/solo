import { Position, Slope, Patroller, WeatherType } from '../types';
import { WEATHER_SPEED_PENALTY } from '../data/constants';

interface Node {
  id: string;
  position: Position;
}

interface Edge {
  from: string;
  to: string;
  slope: Slope;
  weight: number;
}

export class PathFinder {
  private nodes: Map<string, Node> = new Map();
  private edges: Map<string, Edge[]> = new Map();

  constructor(slopes: Slope[]) {
    this.buildGraph(slopes);
  }

  private buildGraph(slopes: Slope[]) {
    slopes.forEach((slope, index) => {
      const startId = `node-${index}-start`;
      const endId = `node-${index}-end`;

      if (!this.nodes.has(startId)) {
        this.nodes.set(startId, { id: startId, position: slope.start });
      }
      if (!this.nodes.has(endId)) {
        this.nodes.set(endId, { id: endId, position: slope.end });
      }

      if (!this.edges.has(startId)) {
        this.edges.set(startId, []);
      }
      if (!this.edges.has(endId)) {
        this.edges.set(endId, []);
      }

      const weight = slope.baseTravelTime;
      this.edges.get(startId)!.push({ from: startId, to: endId, slope, weight });
      this.edges.get(endId)!.push({ from: endId, to: startId, slope, weight });
    });
  }

  private getDistance(a: Position, b: Position): number {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));
  }

  private findNearestNode(position: Position): string | null {
    let nearest: string | null = null;
    let minDist = Infinity;

    this.nodes.forEach((node, id) => {
      const dist = this.getDistance(position, node.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = id;
      }
    });

    return nearest;
  }

  findPath(
    start: Position,
    end: Position,
    patroller: Patroller,
    weather: WeatherType
  ): { route: string[]; estimatedTime: number; slopeIds: string[] } | null {
    const startNode = this.findNearestNode(start);
    const endNode = this.findNearestNode(end);

    if (!startNode || !endNode) {
      return null;
    }

    const openSet: Set<string> = new Set([startNode]);
    const cameFrom: Map<string, string> = new Map();
    const gScore: Map<string, number> = new Map();
    const fScore: Map<string, number> = new Map();

    gScore.set(startNode, 0);
    fScore.set(startNode, this.getDistance(this.nodes.get(startNode)!.position, end));

    while (openSet.size > 0) {
      let current: string | null = null;
      let minF = Infinity;

      openSet.forEach(nodeId => {
        const f = fScore.get(nodeId) ?? Infinity;
        if (f < minF) {
          minF = f;
          current = nodeId;
        }
      });

      if (!current) break;

      if (current === endNode) {
        return this.reconstructPath(cameFrom, current, start, end, patroller, weather);
      }

      openSet.delete(current);

      const edges = this.edges.get(current) ?? [];
      for (const edge of edges) {
        if (!edge.slope.isOpen) continue;
        if (!patroller.specialties.includes(edge.slope.difficulty)) continue;

        const weatherPenalty = WEATHER_SPEED_PENALTY[weather];
        const skillBonus = 1 + (patroller.skillLevel - 2) * 0.1;
        const actualWeight = edge.weight / (patroller.speed * weatherPenalty * skillBonus);

        const tentativeG = (gScore.get(current) ?? 0) + actualWeight;

        if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
          cameFrom.set(edge.to, current);
          gScore.set(edge.to, tentativeG);
          fScore.set(edge.to, tentativeG + this.getDistance(this.nodes.get(edge.to)!.position, end));
          openSet.add(edge.to);
        }
      }
    }

    return null;
  }

  private reconstructPath(
    cameFrom: Map<string, string>,
    current: string,
    start: Position,
    end: Position,
    patroller: Patroller,
    weather: WeatherType
  ): { route: string[]; estimatedTime: number; slopeIds: string[] } {
    const path: string[] = [current];
    const slopeIds: string[] = [];
    let totalTime = 0;

    let curr = current;
    while (cameFrom.has(curr)) {
      const prev = cameFrom.get(curr)!;
      const edges = this.edges.get(prev) ?? [];
      const edge = edges.find(e => e.to === curr);

      if (edge) {
        const weatherPenalty = WEATHER_SPEED_PENALTY[weather];
        const skillBonus = 1 + (patroller.skillLevel - 2) * 0.1;
        totalTime += edge.weight / (patroller.speed * weatherPenalty * skillBonus);
        slopeIds.push(edge.slope.id);
      }

      curr = prev;
      path.unshift(curr);
    }

    return {
      route: path,
      estimatedTime: Math.ceil(totalTime * 2),
      slopeIds,
    };
  }
}
