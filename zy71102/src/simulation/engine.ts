import {
  Passenger,
  StationScene,
  Bottleneck,
  Statistics,
  TimePoint,
  PassengerStatus,
  BottleneckSeverity,
  Point,
  PASSENGER_RADIUS,
  BOTTLENECK_THRESHOLD
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
          
          const exit = this.findNearestExit(batch.spawnX, batch.spawnY);
          if (!exit) continue;

          const path = this.pathFinder.findPath(
            batch.spawnX + offsetX,
            batch.spawnY + offsetY,
            exit.x,
            exit.y
          );

          if (path.length > 0) {
            const passenger: Passenger = {
              id: `p-${this.passengerCounter++}`,
              x: batch.spawnX + offsetX,
              y: batch.spawnY + offsetY,
              targetX: exit.x,
              targetY: exit.y,
              status: 'moving',
              speed: batch.speed * (0.8 + Math.random() * 0.4),
              path,
              pathIndex: 0,
              waitTime: 0,
              spawnTime: this.currentTime,
              exitTime: null,
              exitId: exit.id
            };
            this.passengers.push(passenger);
          }
        }
        this.spawnedBatches.add(batch.id);
      }
    }
  }

  private findNearestExit(x: number, y: number): { x: number; y: number; id: string } | null {
    const exits = this.scene.layout.exits;
    if (exits.length === 0) return null;

    let nearest = exits[0];
    let minDist = Infinity;

    for (const exit of exits) {
      const dist = Math.sqrt((exit.x - x) ** 2 + (exit.y - y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearest = exit;
      }
    }

    return { x: nearest.x, y: nearest.y, id: nearest.id };
  }

  private updatePassengers(deltaTime: number): void {
    const activePassengers = this.passengers.filter(p => p.status !== 'exited');

    for (const passenger of activePassengers) {
      if (passenger.pathIndex >= passenger.path.length) {
        passenger.status = 'exited';
        passenger.exitTime = this.currentTime;
        continue;
      }

      const target = passenger.path[passenger.pathIndex];
      const dx = target.x - passenger.x;
      const dy = target.y - passenger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.2) {
        passenger.pathIndex++;
        continue;
      }

      const collision = this.checkCollision(passenger);
      
      if (collision) {
        passenger.status = 'waiting';
        passenger.waitTime += deltaTime;
      } else {
        passenger.status = 'moving';
        const moveSpeed = passenger.speed * deltaTime;
        passenger.x += (dx / dist) * moveSpeed;
        passenger.y += (dy / dist) * moveSpeed;
      }

      if (passenger.waitTime > 10) {
        passenger.status = 'stuck';
      }
    }
  }

  private checkCollision(passenger: Passenger): boolean {
    const checkRadius = PASSENGER_RADIUS * 2;
    
    for (const other of this.passengers) {
      if (other.id === passenger.id || other.status === 'exited') continue;
      
      const dx = other.x - passenger.x;
      const dy = other.y - passenger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < checkRadius) {
        if (other.status === 'waiting' || other.status === 'stuck') {
          return true;
        }
        if (Math.random() < 0.3) {
          return true;
        }
      }
    }
    
    return false;
  }

  private detectBottlenecks(): void {
    this.bottlenecks = [];

    for (const stair of this.scene.layout.stairs) {
      const count = this.countPassengersInArea(
        stair.x - stair.width / 2 - 1,
        stair.y - stair.height / 2 - 1,
        stair.width + 2,
        stair.height + 2
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
        gate.x - 2,
        gate.y - 2,
        4,
        4
      );

      if (count >= BOTTLENECK_THRESHOLD.low) {
        this.bottlenecks.push({
          id: `bottleneck-gate-${gate.id}`,
          type: 'gate',
          x: gate.x,
          y: gate.y,
          severity: this.getSeverity(count),
          queueLength: count,
          avgWaitTime: this.getAvgWaitTimeInArea(gate.x - 2, gate.y - 2, 4, 4),
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

    this.timeSeriesData.push({
      time: this.currentTime,
      totalPassengers: this.passengers.length,
      exitedCount,
      waitingCount,
      stuckCount
    });
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
