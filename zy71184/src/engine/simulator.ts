import { CONFIG } from './config';
import type { Drain, GameState, Lowland, Pump, ScoreBreakdown } from './types';

export class DrainageSimulator {
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  simulateTurn(): { events: string[]; scoreDelta: number } {
    const events: string[] = [];
    let scoreDelta = 0;

    this.applyRainfall(events);
    this.calculateWaterFlow();
    this.calculateDrainCollection(events);
    this.calculatePumpOperation(events);
    this.updateLowlandWaterLevels(events);
    this.updateFacilityStatus();

    scoreDelta += this.calculateScore(events);
    this.checkGameOver(events);

    return { events, scoreDelta };
  }

  private applyRainfall(events: string[]): void {
    const { turn, rainEvents } = this.state;
    
    const activeRain = rainEvents.find(
      r => turn >= r.startTurn && turn < r.startTurn + r.duration
    );

    if (activeRain) {
      this.state.currentRain = activeRain;
      const rainData = CONFIG.RAIN_INTENSITY_MAP[activeRain.intensity];
      events.push(`降雨警报: ${rainData.name}`);

      activeRain.affectedArea.forEach(area => {
        for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
          for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            const dist = Math.sqrt((x - area.x) ** 2 + (y - area.y) ** 2);
            if (dist <= area.radius) {
              const cell = this.state.grid[y][x];
              if (cell.type !== 'building') {
                cell.waterDepth += rainData.rainfall * (1 - dist / area.radius / 2);
              }
            }
          }
        }
      });
    } else {
      this.state.currentRain = null;
    }

    this.state.forecast = rainEvents.filter(r => r.startTurn > turn && r.startTurn <= turn + 2);
  }

  private calculateWaterFlow(): void {
    const { grid } = this.state;
    const flowRate = CONFIG.WATER_FLOW_RATE;

    for (let i = 0; i < 3; i++) {
      const waterChanges: number[][] = Array(CONFIG.GRID_SIZE).fill(null).map(() => Array(CONFIG.GRID_SIZE).fill(0));

      for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
          const cell = grid[y][x];
          if (cell.waterDepth <= 0 || cell.type === 'building') continue;

          const neighbors = this.getNeighbors(x, y);
          neighbors.forEach(([nx, ny]) => {
            const neighbor = grid[ny][nx];
            if (neighbor.type === 'building') return;

            const heightDiff = (cell.elevation + cell.waterDepth) - (neighbor.elevation + neighbor.waterDepth);
            if (heightDiff > 0.5) {
              const flow = Math.min(cell.waterDepth * flowRate * 0.3, heightDiff * 0.5);
              waterChanges[y][x] -= flow;
              waterChanges[ny][nx] += flow;
            }
          });
        }
      }

      for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
          grid[y][x].waterDepth = Math.max(0, grid[y][x].waterDepth + waterChanges[y][x]);
        }
      }
    }
  }

  private getNeighbors(x: number, y: number): [number, number][] {
    const neighbors: [number, number][] = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    directions.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < CONFIG.GRID_SIZE && ny >= 0 && ny < CONFIG.GRID_SIZE) {
        neighbors.push([nx, ny]);
      }
    });
    return neighbors;
  }

  private calculateDrainCollection(events: string[]): void {
    const { grid, facilities } = this.state;
    const drains = facilities.filter(f => f.type === 'drain') as Drain[];

    drains.forEach(drain => {
      if (drain.status === 'broken') return;

      const efficiency = Math.max(0.1, 1 - drain.blockage * 0.8);
      drain.efficiency = efficiency;

      let collected = 0;
      const drainCell = grid[drain.y][drain.x];

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = drain.y + dy;
          const nx = drain.x + dx;
          if (nx >= 0 && nx < CONFIG.GRID_SIZE && ny >= 0 && ny < CONFIG.GRID_SIZE) {
            const cell = grid[ny][nx];
            if (cell.waterDepth > 0 && cell.type !== 'building') {
              const collect = Math.min(cell.waterDepth * 0.5 * efficiency, drain.capacity - collected);
              cell.waterDepth -= collect;
              collected += collect;
            }
          }
        }
      }

      const directCollect = Math.min(drainCell.waterDepth * efficiency, drain.capacity - collected);
      drainCell.waterDepth -= directCollect;
      collected += directCollect;

      drain.collectedWater = collected;
      drain.inflow = collected;

      if (drain.blockage > 0) {
        drain.blockage = Math.min(1, drain.blockage + CONFIG.BLOCKAGE_GROWTH_RATE * 0.1);
      }
      if (drain.blockage > 0.7 && drain.status !== 'danger') {
        drain.status = 'danger';
        events.push(`雨水口 ${drain.id} 严重堵塞!`);
      } else if (drain.blockage > 0.4 && drain.status !== 'warning') {
        drain.status = 'warning';
      }
    });
  }

  private calculatePumpOperation(events: string[]): void {
    const { facilities } = this.state;
    const pumps = facilities.filter(f => f.type === 'pump') as Pump[];
    const drains = facilities.filter(f => f.type === 'drain') as Drain[];

    pumps.forEach(pump => {
      if (pump.status === 'broken') return;

      let totalInflow = 0;
      pump.connectedDrains.forEach(drainId => {
        const drain = drains.find(d => d.id === drainId);
        if (drain) {
          totalInflow += drain.collectedWater;
        }
      });

      const pumpCapacity = pump.maxPower * pump.power;
      const pumped = Math.min(totalInflow, pumpCapacity);
      pump.pumpedWater = pumped;
      pump.currentLoad = pumped / pump.maxPower;

      if (pump.currentLoad > CONFIG.OVERLOAD_THRESHOLD) {
        pump.overloadCount++;
        pump.status = 'danger';
        events.push(`泵站 ${pump.id} 超载运行!`);

        if (pump.overloadCount >= CONFIG.OVERLOAD_DAMAGE_THRESHOLD) {
          pump.status = 'broken';
          events.push(`泵站 ${pump.id} 因持续超载损坏!`);
        }
      } else if (pump.currentLoad > 0.6) {
        pump.status = 'warning';
        pump.overloadCount = Math.max(0, pump.overloadCount - 1);
      } else {
        pump.status = 'normal';
        pump.overloadCount = Math.max(0, pump.overloadCount - 1);
      }

      const overflow = totalInflow - pumped;
      if (overflow > 0) {
        const overflowPerDrain = overflow / pump.connectedDrains.length;
        pump.connectedDrains.forEach(drainId => {
          const drain = drains.find(d => d.id === drainId);
          if (drain) {
            const cell = this.state.grid[drain.y][drain.x];
            cell.waterDepth += overflowPerDrain;
          }
        });
      }
    });
  }

  private updateLowlandWaterLevels(events: string[]): void {
    const { grid, facilities } = this.state;
    const lowlands = facilities.filter(f => f.type === 'lowland') as Lowland[];

    lowlands.forEach(lowland => {
      const cell = grid[lowland.y][lowland.x];

      if (lowland.temporaryDrainRemaining > 0) {
        const drained = Math.min(cell.waterDepth, 3);
        cell.waterDepth -= drained;
        lowland.temporaryDrainRemaining--;
        if (drained > 0) {
          events.push(`低洼点 ${lowland.id} 临时排水生效, 排出 ${drained.toFixed(1)} 水量`);
        }
      }

      lowland.waterLevel = cell.waterDepth;

      if (cell.waterDepth > lowland.maxSafeLevel) {
        lowland.dangerCount++;
        lowland.status = 'danger';
        events.push(`低洼点 ${lowland.id} 水位超标! 水位: ${cell.waterDepth.toFixed(1)}`);
      } else if (cell.waterDepth > lowland.warningThreshold) {
        lowland.status = 'warning';
        lowland.dangerCount = Math.max(0, lowland.dangerCount - 1);
      } else {
        lowland.status = 'normal';
        lowland.dangerCount = Math.max(0, lowland.dangerCount - 1);
      }
    });
  }

  private updateFacilityStatus(): void {
    const { facilities } = this.state;
    
    facilities.forEach(facility => {
      if (facility.type === 'drain') {
        const drain = facility as Drain;
        if (drain.blockage > 0.3 && Math.random() > 0.7) {
          drain.blockage = Math.min(1, drain.blockage + 0.1);
        }
      }
    });
  }

  private calculateScore(events: string[]): number {
    let score = CONFIG.SCORE_PER_TURN;
    const { grid } = this.state;

    let floodedCells = 0;
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        if (grid[y][x].waterDepth > 2) {
          floodedCells++;
        }
      }
    }

    score += floodedCells * CONFIG.SCORE_FLOOD_PENALTY;
    if (floodedCells > 0) {
      events.push(`${floodedCells} 个区域积水, 扣 ${floodedCells * Math.abs(CONFIG.SCORE_FLOOD_PENALTY)} 分`);
    }

    return score;
  }

  private checkGameOver(events: string[]): void {
    const { facilities, grid, turn, maxTurns } = this.state;

    if (turn >= maxTurns - 1) {
      this.state.isVictory = true;
      this.state.isGameOver = true;
      events.push('恭喜! 成功度过所有降雨回合!');
      return;
    }

    const lowlands = facilities.filter(f => f.type === 'lowland') as Lowland[];
    for (const lowland of lowlands) {
      if (lowland.dangerCount >= CONFIG.LOWLAND_FAIL_THRESHOLD) {
        this.state.isGameOver = true;
        this.state.isVictory = false;
        this.state.failReason = `低洼点 ${lowland.id} 持续积水 ${CONFIG.LOWLAND_FAIL_THRESHOLD} 回合`;
        events.push(this.state.failReason);
        return;
      }
    }

    const pumps = facilities.filter(f => f.type === 'pump') as Pump[];
    const brokenPumps = pumps.filter(p => p.status === 'broken').length;
    if (brokenPumps === pumps.length) {
      this.state.isGameOver = true;
      this.state.isVictory = false;
      this.state.failReason = '所有泵站均已损坏';
      events.push(this.state.failReason);
      return;
    }

    let floodedCells = 0;
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        if (grid[y][x].waterDepth > 3) {
          floodedCells++;
        }
      }
    }
    const floodPercent = floodedCells / (CONFIG.GRID_SIZE * CONFIG.GRID_SIZE);
    if (floodPercent >= CONFIG.FLOOD_FAIL_PERCENT) {
      this.state.isGameOver = true;
      this.state.isVictory = false;
      this.state.failReason = `城市 ${(floodPercent * 100).toFixed(0)}% 区域被淹`;
      events.push(this.state.failReason);
      return;
    }

    if (this.state.score < -500) {
      this.state.isGameOver = true;
      this.state.isVictory = false;
      this.state.failReason = '分数过低, 防涝失败';
      events.push(this.state.failReason);
    }
  }

  clearDrainBlockage(drainId: string): boolean {
    const drain = this.state.facilities.find(
      f => f.id === drainId && f.type === 'drain'
    ) as Drain | undefined;

    if (drain && drain.blockage > 0) {
      drain.blockage = 0;
      drain.status = 'normal';
      this.state.score += CONFIG.SCORE_CLEAR_BLOCKAGE;
      return true;
    }
    return false;
  }

  adjustPumpPower(pumpId: string, power: number): boolean {
    const pump = this.state.facilities.find(
      f => f.id === pumpId && f.type === 'pump'
    ) as Pump | undefined;

    if (pump && pump.status !== 'broken') {
      pump.power = Math.max(0.1, Math.min(1, power));
      return true;
    }
    return false;
  }

  setLowlandWarningThreshold(lowlandId: string, threshold: number): boolean {
    const lowland = this.state.facilities.find(
      f => f.id === lowlandId && f.type === 'lowland'
    ) as Lowland | undefined;

    if (lowland) {
      lowland.warningThreshold = Math.max(1, Math.min(lowland.maxSafeLevel, threshold));
      return true;
    }
    return false;
  }

  activateTemporaryDrain(lowlandId: string): boolean {
    const lowland = this.state.facilities.find(
      f => f.id === lowlandId && f.type === 'lowland'
    ) as Lowland | undefined;

    if (lowland && lowland.temporaryDrainRemaining === 0 && this.state.score >= 100) {
      lowland.temporaryDrainRemaining = 2;
      this.state.score -= 100;
      return true;
    }
    return false;
  }

  getState(): GameState {
    return this.state;
  }

  calculateScoreBreakdown(): ScoreBreakdown {
    const { facilities, turn } = this.state;
    const drains = facilities.filter(f => f.type === 'drain') as Drain[];
    const pumps = facilities.filter(f => f.type === 'pump') as Pump[];

    let waterPenalty = 0;
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        if (this.state.grid[y][x].waterDepth > 2) {
          waterPenalty += CONFIG.SCORE_FLOOD_PENALTY;
        }
      }
    }

    const brokenPumps = pumps.filter(p => p.status === 'broken').length;
    const brokenDrains = drains.filter(d => d.status === 'broken').length;

    return {
      baseScore: turn * CONFIG.SCORE_PER_TURN,
      drainMaintenance: drains.filter(d => d.blockage < 0.3).length * 50,
      pumpEfficiency: pumps.filter(p => p.currentLoad > 0.3 && p.currentLoad < 0.8).length * 30,
      waterPenalty,
      facilityDamage: -(brokenPumps + brokenDrains) * 200,
      bonus: this.state.isVictory ? 500 : 0,
    };
  }
}
