import {
  ExhibitionConfig,
  TimeSlot,
  Visitor,
  HeatZone,
  RiskLevel,
  RiskType,
  RiskSummary,
  SimulationResult,
  Position,
} from '../types';
import { PathFinder } from './PathFinder';

const SIMULATION_STEPS = 100;
const VISITOR_SPEED = 0.05;
const VIEW_DURATION = 15;
const GRID_SIZE = 1;

const DENSITY_THRESHOLDS = {
  low: 0.5,
  medium: 1.5,
  high: 3.0,
  critical: 5.0,
};

const STAGNATION_THRESHOLD = 3;

export class SimulationEngine {
  private config: ExhibitionConfig;
  private timeSlot: TimeSlot;
  private pathFinder: PathFinder;
  private visitors: Map<string, Visitor> = new Map();
  private gridSize: number;
  
  private stepCount = 0;
  private isRunning = false;
  
  private entranceElements: Position[] = [];
  private exitElements: Position[] = [];
  private exhibitElements: { id: string; position: Position; name: string }[] = [];

  constructor(config: ExhibitionConfig, timeSlot: TimeSlot, gridSize: number = GRID_SIZE) {
    this.config = config;
    this.timeSlot = timeSlot;
    this.gridSize = gridSize;
    this.pathFinder = new PathFinder(config, gridSize);
    
    this.extractElements();
    this.initializeVisitors();
  }

  private extractElements(): void {
    for (const element of this.config.elements) {
      if (element.type === 'entrance') {
        this.entranceElements.push({
          x: element.position.x,
          z: element.position.z,
        });
      } else if (element.type === 'exit') {
        this.exitElements.push({
          x: element.position.x,
          z: element.position.z,
        });
      } else if (element.type === 'exhibit') {
        this.exhibitElements.push({
          id: element.id,
          position: {
            x: element.position.x,
            z: element.position.z,
          },
          name: element.name,
        });
      }
    }
  }

  private initializeVisitors(): void {
    this.visitors.clear();
    
    const visitorCount = Math.min(this.timeSlot.visitorCount, 200);
    
    for (let i = 0; i < visitorCount; i++) {
      const visitor = this.createVisitor(i);
      this.visitors.set(visitor.id, visitor);
    }
  }

  private createVisitor(index: number): Visitor {
    const entrance = this.entranceElements[Math.floor(Math.random() * this.entranceElements.length)];
    
    const offsetX = (Math.random() - 0.5) * 2;
    const offsetZ = (Math.random() - 0.5) * 2;
    
    const startPosition = {
      x: entrance.x + offsetX,
      z: entrance.z + offsetZ,
    };
    
    const nextExhibit = this.getNextExhibitTarget([]);
    
    return {
      id: `visitor_${index}_${Date.now()}`,
      position: startPosition,
      targetPosition: nextExhibit?.position || null,
      visitedExhibits: [],
      status: 'entering',
      speed: VISITOR_SPEED * (0.8 + Math.random() * 0.4),
      angle: Math.random() * Math.PI * 2,
      targetExhibitId: nextExhibit?.id || null,
    };
  }

  private getNextExhibitTarget(visited: string[]): { id: string; position: Position; name: string } | null {
    const available = this.exhibitElements.filter(e => !visited.includes(e.id));
    
    if (available.length === 0) {
      return null;
    }
    
    const preference = Math.random();
    
    if (preference < 0.7) {
      return available[Math.floor(Math.random() * available.length)];
    }
    
    if (visited.length === 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    
    let nearest = available[0];
    let minDist = Infinity;
    
    for (const exhibit of available) {
      const lastVisited = visited[visited.length - 1];
      const lastExhibit = this.exhibitElements.find(e => e.id === lastVisited);
      
      if (lastExhibit) {
        const dist = Math.abs(exhibit.position.x - lastExhibit.position.x) +
                    Math.abs(exhibit.position.z - lastExhibit.position.z);
        if (dist < minDist) {
          minDist = dist;
          nearest = exhibit;
        }
      }
    }
    
    return nearest;
  }

  private getExitTarget(): Position {
    return this.exitElements[Math.floor(Math.random() * this.exitElements.length)];
  }

  step(): void {
    if (!this.isRunning) return;
    
    this.stepCount++;
    
    for (const visitor of this.visitors.values()) {
      this.updateVisitor(visitor);
    }
  }

  private updateVisitor(visitor: Visitor): void {
    switch (visitor.status) {
      case 'entering':
        this.handleEntering(visitor);
        break;
      case 'moving':
        this.handleMoving(visitor);
        break;
      case 'viewing':
        this.handleViewing(visitor);
        break;
      case 'exiting':
        this.handleExiting(visitor);
        break;
    }
  }

  private handleEntering(visitor: Visitor): void {
    if (!visitor.targetPosition) {
      const nextExhibit = this.getNextExhibitTarget(visitor.visitedExhibits);
      if (nextExhibit) {
        visitor.targetPosition = nextExhibit.position;
        visitor.targetExhibitId = nextExhibit.id;
        visitor.status = 'moving';
      } else {
        visitor.targetPosition = this.getExitTarget();
        visitor.status = 'exiting';
      }
      return;
    }
    
    visitor.status = 'moving';
    this.handleMoving(visitor);
  }

  private handleMoving(visitor: Visitor): void {
    if (!visitor.targetPosition) {
      visitor.status = 'exiting';
      visitor.targetPosition = this.getExitTarget();
      return;
    }
    
    const dx = visitor.targetPosition.x - visitor.position.x;
    const dz = visitor.targetPosition.z - visitor.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < 0.5) {
      if (visitor.status === 'exiting') {
        const entrance = this.entranceElements[Math.floor(Math.random() * this.entranceElements.length)];
        visitor.position = { x: entrance.x, z: entrance.z };
        visitor.visitedExhibits = [];
        visitor.status = 'entering';
        visitor.targetPosition = null;
        visitor.targetExhibitId = null;
      } else if (visitor.targetExhibitId) {
        visitor.visitedExhibits.push(visitor.targetExhibitId);
        visitor.status = 'viewing';
      }
      return;
    }
    
    const path = this.pathFinder.findPath(visitor.position, visitor.targetPosition);
    
    if (path && path.length > 1) {
      const nextPoint = path[1];
      const stepDx = nextPoint.x - visitor.position.x;
      const stepDz = nextPoint.z - visitor.position.z;
      const stepDist = Math.sqrt(stepDx * stepDx + stepDz * stepDz);
      
      if (stepDist > 0) {
        const moveX = (stepDx / stepDist) * visitor.speed;
        const moveZ = (stepDz / stepDist) * visitor.speed;
        
        visitor.position.x += moveX;
        visitor.position.z += moveZ;
        visitor.angle = Math.atan2(stepDx, stepDz);
      }
    } else {
      const moveX = (dx / dist) * visitor.speed;
      const moveZ = (dz / dist) * visitor.speed;
      
      visitor.position.x += moveX;
      visitor.position.z += moveZ;
      visitor.angle = Math.atan2(dx, dz);
    }
  }

  private handleViewing(visitor: Visitor): void {
    const stayTime = Math.floor(Math.random() * VIEW_DURATION) + 5;
    
    if (this.stepCount % stayTime === 0) {
      const nextExhibit = this.getNextExhibitTarget(visitor.visitedExhibits);
      
      if (nextExhibit) {
        visitor.targetPosition = nextExhibit.position;
        visitor.targetExhibitId = nextExhibit.id;
        visitor.status = 'moving';
      } else {
        visitor.targetPosition = this.getExitTarget();
        visitor.targetExhibitId = null;
        visitor.status = 'exiting';
      }
    }
  }

  private handleExiting(visitor: Visitor): void {
    if (!visitor.targetPosition) {
      visitor.targetPosition = this.getExitTarget();
    }
    
    this.handleMoving(visitor);
  }

  run(steps: number = SIMULATION_STEPS): SimulationResult {
    this.isRunning = true;
    
    for (let i = 0; i < steps; i++) {
      this.step();
    }
    
    return this.getResult();
  }

  start(): void {
    this.isRunning = true;
  }

  pause(): void {
    this.isRunning = false;
  }

  reset(): void {
    this.isRunning = false;
    this.stepCount = 0;
    this.initializeVisitors();
  }

  getHeatZones(): HeatZone[] {
    const heatMap = new Map<string, {
      visitorCount: number;
      positions: Position[];
      angles: number[];
    }>();
    
    for (const visitor of this.visitors.values()) {
      const gridX = Math.round(visitor.position.x / this.gridSize) * this.gridSize;
      const gridZ = Math.round(visitor.position.z / this.gridSize) * this.gridSize;
      const key = `${gridX},${gridZ}`;
      
      if (!heatMap.has(key)) {
        heatMap.set(key, {
          visitorCount: 0,
          positions: [],
          angles: [],
        });
      }
      
      const zone = heatMap.get(key)!;
      zone.visitorCount++;
      zone.positions.push(visitor.position);
      zone.angles.push(visitor.angle);
    }
    
    const heatZones: HeatZone[] = [];
    const gridArea = this.gridSize * this.gridSize;
    
    for (const [key, data] of heatMap.entries()) {
      const [x, z] = key.split(',').map(Number);
      const density = data.visitorCount / gridArea;
      
      const riskLevel = this.calculateRiskLevel(density);
      const riskTypes = this.calculateRiskTypes(data, density);
      
      heatZones.push({
        x,
        z,
        visitorCount: data.visitorCount,
        riskLevel,
        riskType: riskTypes,
        density,
      });
    }
    
    const minX = -this.config.floor.width / 2;
    const maxX = this.config.floor.width / 2;
    const minZ = -this.config.floor.depth / 2;
    const maxZ = this.config.floor.depth / 2;
    
    for (let x = minX; x <= maxX; x += this.gridSize) {
      for (let z = minZ; z <= maxZ; z += this.gridSize) {
        const key = `${x},${z}`;
        if (!heatMap.has(key)) {
          heatZones.push({
            x,
            z,
            visitorCount: 0,
            riskLevel: 'low',
            riskType: [],
            density: 0,
          });
        }
      }
    }
    
    return heatZones;
  }

  private calculateRiskLevel(density: number): RiskLevel {
    if (density >= DENSITY_THRESHOLDS.critical) return 'critical';
    if (density >= DENSITY_THRESHOLDS.high) return 'high';
    if (density >= DENSITY_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  private calculateRiskTypes(
    data: { visitorCount: number; positions: Position[]; angles: number[] },
    density: number
  ): RiskType[] {
    const riskTypes: RiskType[] = [];
    
    if (density >= DENSITY_THRESHOLDS.medium) {
      riskTypes.push('congestion');
    }
    
    if (data.visitorCount >= STAGNATION_THRESHOLD) {
      const angleVariance = this.calculateAngleVariance(data.angles);
      if (angleVariance < 0.5) {
        riskTypes.push('stagnation');
      }
    }
    
    if (data.visitorCount >= 2) {
      const hasRetrograde = this.checkRetrograde(data.angles);
      if (hasRetrograde) {
        riskTypes.push('retrograde');
      }
    }
    
    if (density >= DENSITY_THRESHOLDS.high && data.visitorCount >= 5) {
      riskTypes.push('bottleneck');
    }
    
    return riskTypes;
  }

  private calculateAngleVariance(angles: number[]): number {
    if (angles.length < 2) return 0;
    
    const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
    const variance = angles.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / angles.length;
    
    return variance;
  }

  private checkRetrograde(angles: number[]): boolean {
    if (angles.length < 2) return false;
    
    for (let i = 0; i < angles.length - 1; i++) {
      for (let j = i + 1; j < angles.length; j++) {
        const angleDiff = Math.abs(angles[i] - angles[j]);
        if (angleDiff > Math.PI / 2 && angleDiff < Math.PI * 1.5) {
          return true;
        }
      }
    }
    
    return false;
  }

  getRiskSummary(heatZones: HeatZone[]): RiskSummary {
    let criticalZones = 0;
    let highZones = 0;
    let mediumZones = 0;
    let lowZones = 0;
    let congestionCount = 0;
    let stagnationCount = 0;
    let retrogradeCount = 0;
    let bottleneckCount = 0;
    let totalDensity = 0;
    let maxDensity = 0;
    let totalZones = 0;
    
    for (const zone of heatZones) {
      totalZones++;
      totalDensity += zone.density;
      
      if (zone.density > maxDensity) {
        maxDensity = zone.density;
      }
      
      switch (zone.riskLevel) {
        case 'critical': criticalZones++; break;
        case 'high': highZones++; break;
        case 'medium': mediumZones++; break;
        case 'low': lowZones++; break;
      }
      
      if (zone.riskType.includes('congestion')) congestionCount++;
      if (zone.riskType.includes('stagnation')) stagnationCount++;
      if (zone.riskType.includes('retrograde')) retrogradeCount++;
      if (zone.riskType.includes('bottleneck')) bottleneckCount++;
    }
    
    return {
      totalVisitors: this.visitors.size,
      criticalZones,
      highZones,
      mediumZones,
      lowZones,
      congestionCount,
      stagnationCount,
      retrogradeCount,
      bottleneckCount,
      averageDensity: totalZones > 0 ? totalDensity / totalZones : 0,
      maxDensity,
    };
  }

  getResult(): SimulationResult {
    const heatZones = this.getHeatZones();
    const riskSummary = this.getRiskSummary(heatZones);
    
    return {
      timeSlotId: this.timeSlot.id,
      timeSlot: this.timeSlot,
      visitors: Array.from(this.visitors.values()),
      heatZones,
      riskSummary,
      timestamp: Date.now(),
    };
  }

  getVisitors(): Visitor[] {
    return Array.from(this.visitors.values());
  }

  updateConfig(config: ExhibitionConfig): void {
    this.config = config;
    this.pathFinder.updateGrid(config);
    this.extractElements();
  }
}
