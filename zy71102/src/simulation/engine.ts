import {
  Passenger,
  StationScene,
  Bottleneck,
  Statistics,
  TimePoint,
  BottleneckSeverity,
  PASSENGER_RADIUS,
  BOTTLENECK_THRESHOLD,
  Point
} from './types';
import { PathFinder } from './pathfinding';

export class SimulationEngine {
  private scene: StationScene;
  private passengers: Passenger[] = [];
  private bottlenecks: Bottleneck[] = [];
  private timeSeriesData: TimePoint[] = [];
  private pathFinder: PathFinder;
  private currentTime: number = 0;
  private spawnedBatches: Set<string> = new Set();
  private passengerCounter: number = 0;

  constructor(scene: StationScene) {
    this.scene = scene;
    this.pathFinder = new PathFinder(
      scene.layout.width,
      scene.layout.height,
      scene.layout.walls,
      scene.closedAreas,
      scene.layout.gates
    );
  }

  public reset(): void {
    this.passengers = [];
    this.bottlenecks = [];
    this.timeSeriesData = [];
    this.currentTime = 0;
    this.spawnedBatches = new Set();
    this.passengerCounter = 0;
  }

  public getPassengers(): Passenger[] {
    return this.passengers;
  }

  public getBottlenecks(): Bottleneck[] {
    return this.bottlenecks;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getStatistics(): Statistics {
    const totalPassengers = this.scene.passengerBatches.reduce((sum, b) => sum + b.count, 0);
    const exitedPassengers = this.passengers.filter(p => p.status === 'exited');
    const waitingCount = this.passengers.filter(p => p.status === 'waiting').length;
    const stuckCount = this.passengers.filter(p => p.status === 'stuck').length;

    const evacuationTimes = exitedPassengers
      .filter(p => p.exitTime !== null)
      .map(p => (p.exitTime as number) - p.spawnTime);

    const avgEvacuationTime = evacuationTimes.length > 0
      ? evacuationTimes.reduce((a, b) => a + b, 0) / evacuationTimes.length
      : 0;

    const maxWaitTime = Math.max(0, ...this.passengers.map(p => p.waitTime));

    const bottleneckRanking = [...this.bottlenecks].sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity] || b.queueLength - a.queueLength;
    });

    return {
      totalPassengers,
      exitedCount: exitedPassengers.length,
      waitingCount,
      stuckCount,
      avgEvacuationTime,
      maxWaitTime,
      bottleneckRanking,
      timeSeriesData: this.timeSeriesData,
      completionRate: totalPassengers > 0 ? exitedPassengers.length / totalPassengers : 0
    };
  }

  public step(deltaTime: number): void {
    this.currentTime += deltaTime;

    this.spawnPassengers();
    this.updatePassengers(deltaTime);
    this.detectBottlenecks();
    this.recordTimePoint();
  }

  private spawnPassengers(): void {
    for (const batch of this.scene.passengerBatches) {
      if (!this.spawnedBatches.has(batch.id) && this.currentTime >= batch.startTime) {
        for (let i = 0; i < batch.count; i++) {
          const offsetX = (Math.random() - 0.5) * 3;
          const offsetY = (Math.random() - 0.5) * 3;
          
          const spawnX = batch.spawnX + offsetX;
          const spawnY = batch.spawnY + offsetY;
          
          const targetExit = this.findBestExit(spawnX, spawnY);
          
          const path = this.calculatePath(spawnX, spawnY, targetExit.x, targetExit.y);

          const passenger: Passenger = {
            id: `p-${this.passengerCounter++}`,
            x: spawnX,
            y: spawnY,
            targetX: targetExit.x,
            targetY: targetExit.y,
            status: 'moving',
            speed: batch.speed * (0.85 + Math.random() * 0.3),
            path,
            pathIndex: 0,
            waitTime: 0,
            spawnTime: this.currentTime,
            exitTime: null,
            exitId: targetExit.id
          };
          this.passengers.push(passenger);
        }
        this.spawnedBatches.add(batch.id);
      }
    }
  }

  private findBestExit(x: number, y: number): { x: number; y: number; id: string } {
    const openGates = this.scene.layout.gates.filter(g => g.status === 'open' && g.type !== 'entry');
    if (openGates.length === 0) {
      const nearest = this.scene.layout.exits[0];
      return { x: nearest.x, y: nearest.y, id: nearest.id };
    }

    let bestGate = openGates[0];
    let bestScore = Infinity;

    for (const gate of openGates) {
      const directDist = Math.sqrt((gate.x - x) ** 2 + (gate.y - y) ** 2);
      const path = this.pathFinder.findPath(x, y, gate.x, gate.y);
      const pathLength = path.length > 0 ? path.length * 0.5 : directDist;
      const score = pathLength * (1 / gate.speed);
      
      if (score < bestScore) {
        bestScore = score;
        bestGate = gate;
      }
    }

    const matchingExit = this.scene.layout.exits.find(e => 
      Math.abs(e.y - bestGate.y) < 3
    ) || this.scene.layout.exits[0];

    return { x: matchingExit.x, y: matchingExit.y, id: matchingExit.id };
  }

  private calculatePath(startX: number, startY: number, endX: number, endY: number): Point[] {
    const aStarPath = this.pathFinder.findPath(startX, startY, endX, endY);
    if (aStarPath.length > 0) {
      return aStarPath;
    }

    const path: Point[] = [];
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      path.push({
        x: startX + (endX - startX) * (i / steps),
        y: startY + (endY - startY) * (i / steps)
      });
    }
    return path;
  }

  private updatePassengers(deltaTime: number): void {
    const activePassengers = this.passengers.filter(p => p.status !== 'exited');

    for (const passenger of activePassengers) {
      const distToExit = Math.sqrt(
        (passenger.x - passenger.targetX) ** 2 + 
        (passenger.y - passenger.targetY) ** 2
      );

      if (distToExit < 1.0) {
        passenger.status = 'exited';
        passenger.exitTime = this.currentTime;
        continue;
      }

      if (passenger.pathIndex >= passenger.path.length) {
        const newPath = this.calculatePath(passenger.x, passenger.y, passenger.targetX, passenger.targetY);
        passenger.path = newPath;
        passenger.pathIndex = 0;
      }

      const target = passenger.path[passenger.pathIndex];
      const dx = target.x - passenger.x;
      const dy = target.y - passenger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.4) {
        passenger.pathIndex++;
        continue;
      }

      const collision = this.checkCollision(passenger);
      
      if (collision) {
        passenger.status = 'waiting';
        passenger.waitTime += deltaTime;
        
        if (Math.random() < 0.3) {
          const angle = Math.random() * Math.PI * 2;
          const sidestep = 0.1;
          passenger.x += Math.cos(angle) * sidestep;
          passenger.y += Math.sin(angle) * sidestep;
        }
      } else {
        passenger.status = 'moving';
        const moveSpeed = passenger.speed * deltaTime;
        passenger.x += (dx / dist) * moveSpeed;
        passenger.y += (dy / dist) * moveSpeed;
      }

      if (passenger.waitTime > 45) {
        passenger.status = 'stuck';
      } else if (passenger.waitTime > 8 && Math.random() < 0.05) {
        const newExit = this.findBestExit(passenger.x, passenger.y);
        if (newExit.id !== passenger.exitId) {
          passenger.targetX = newExit.x;
          passenger.targetY = newExit.y;
          passenger.exitId = newExit.id;
          passenger.path = this.calculatePath(passenger.x, passenger.y, newExit.x, newExit.y);
          passenger.pathIndex = 0;
        }
      }
    }
  }

  private checkCollision(passenger: Passenger): boolean {
    const checkRadius = PASSENGER_RADIUS * 1.5;
    let nearbyCount = 0;
    
    for (const other of this.passengers) {
      if (other.id === passenger.id || other.status === 'exited') continue;
      
      const dx = other.x - passenger.x;
      const dy = other.y - passenger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < checkRadius) {
        nearbyCount++;
        if (other.status === 'stuck') {
          return true;
        }
      }
    }
    
    if (nearbyCount >= 3) {
      return Math.random() < 0.4;
    }
    
    return false;
  }

  private detectBottlenecks(): void {
    this.bottlenecks = [];

    for (const stair of this.scene.layout.stairs) {
      const count = this.countPassengersInArea(
        stair.x - stair.width / 2 - 1.5,
        stair.y - stair.height / 2 - 1.5,
        stair.width + 3,
        stair.height + 3
      );

      if (count >= BOTTLENECK_THRESHOLD.low) {
        this.bottlenecks.push({
          id: `bottleneck-stair-${stair.id}`,
          type: 'stair',
          x: stair.x,
          y: stair.y,
          severity: this.getSeverity(count),
          queueLength: count,
          avgWaitTime: this.getAvgWaitTimeInArea(
            stair.x - stair.width / 2,
            stair.y - stair.height / 2,
            stair.width,
            stair.height
          ),
          relatedId: stair.id
        });
      }
    }

    for (const gate of this.scene.layout.gates) {
      if (gate.status === 'closed') continue;
      
      const count = this.countPassengersInArea(
        gate.x - 2.5,
        gate.y - 2.5,
        5,
        5
      );

      if (count >= BOTTLENECK_THRESHOLD.low) {
        this.bottlenecks.push({
          id: `bottleneck-gate-${gate.id}`,
          type: 'gate',
          x: gate.x,
          y: gate.y,
          severity: this.getSeverity(count),
          queueLength: count,
          avgWaitTime: this.getAvgWaitTimeInArea(gate.x - 2.5, gate.y - 2.5, 5, 5),
          relatedId: gate.id
        });
      }
    }
  }

  private countPassengersInArea(x: number, y: number, width: number, height: number): number {
    return this.passengers.filter(p => 
      p.status !== 'exited' &&
      p.x >= x && p.x <= x + width &&
      p.y >= y && p.y <= y + height
    ).length;
  }

  private getAvgWaitTimeInArea(x: number, y: number, width: number, height: number): number {
    const passengersInArea = this.passengers.filter(p =>
      p.status !== 'exited' &&
      p.x >= x && p.x <= x + width &&
      p.y >= y && p.y <= y + height
    );

    if (passengersInArea.length === 0) return 0;
    return passengersInArea.reduce((sum, p) => sum + p.waitTime, 0) / passengersInArea.length;
  }

  private getSeverity(count: number): BottleneckSeverity {
    if (count >= BOTTLENECK_THRESHOLD.high) return 'high';
    if (count >= BOTTLENECK_THRESHOLD.medium) return 'medium';
    return 'low';
  }

  private recordTimePoint(): void {
    const exitedCount = this.passengers.filter(p => p.status === 'exited').length;
    const waitingCount = this.passengers.filter(p => p.status === 'waiting').length;
    const stuckCount = this.passengers.filter(p => p.status === 'stuck').length;

    if (this.timeSeriesData.length === 0 || 
        this.currentTime - this.timeSeriesData[this.timeSeriesData.length - 1].time >= 0.5) {
      this.timeSeriesData.push({
        time: this.currentTime,
        totalPassengers: this.passengers.length,
        exitedCount,
        waitingCount,
        stuckCount
      });
    }
  }

  public isComplete(): boolean {
    const totalExpected = this.scene.passengerBatches.reduce((sum, b) => sum + b.count, 0);
    const allSpawned = this.scene.passengerBatches.every(b => 
      this.spawnedBatches.has(b.id)
    );
    const allExited = this.passengers.every(p => p.status === 'exited');
    
    return allSpawned && allExited && this.passengers.length === totalExpected;
  }

  public updateScene(scene: StationScene): void {
    this.scene = scene;
    this.pathFinder = new PathFinder(
      scene.layout.width,
      scene.layout.height,
      scene.layout.walls,
      scene.closedAreas,
      scene.layout.gates
    );
    this.reset();
  }
}
