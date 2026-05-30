import {
  KitchenLayout,
  GridCell,
  SimulationResult,
  DetectionPointResult,
  SimulationStats,
  Point2D,
} from '../types';
import { normalizeToMeters, PHYSICAL_CONSTANTS, CONCENTRATION_LIMITS } from '../utils/units';
import { validateLayout } from '../validation/rules';

interface SimulationConfig {
  maxIterations: number;
  convergenceThreshold: number;
  diffusionFactor: number;
  advectionFactor: number;
}

const DEFAULT_CONFIG: SimulationConfig = {
  maxIterations: 100,
  convergenceThreshold: 0.001,
  diffusionFactor: 0.8,
  advectionFactor: 0.9,
};

export class FumeSimulationEngine {
  private config: SimulationConfig;
  private layout: KitchenLayout;
  private gridWidth: number;
  private gridHeight: number;
  private resolution: number;
  private concentrationGrid: number[][];
  private velocityGrid: Point2D[][];
  private temperatureGrid: number[][];
  private obstacleMask: boolean[][];

  constructor(layout: KitchenLayout, config?: Partial<SimulationConfig>) {
    this.layout = layout;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.resolution = layout.gridResolution;
    
    const kitchenWidth = normalizeToMeters(layout.dimensions.width, layout.dimensions.unit);
    const kitchenHeight = normalizeToMeters(layout.dimensions.height, layout.dimensions.unit);
    
    this.gridWidth = Math.ceil(kitchenWidth / this.resolution);
    this.gridHeight = Math.ceil(kitchenHeight / this.resolution);
    
    this.concentrationGrid = this.createGrid(0);
    this.velocityGrid = this.createGrid({ x: 0, y: 0 });
    this.temperatureGrid = this.createGrid(PHYSICAL_CONSTANTS.STANDARD_TEMPERATURE);
    this.obstacleMask = this.createGrid(false);
    
    this.initializeObstacles();
  }

  private createGrid<T>(initialValue: T): T[][] {
    const grid: T[][] = [];
    for (let y = 0; y < this.gridHeight; y++) {
      grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        grid[y][x] = initialValue;
      }
    }
    return grid;
  }

  private initializeObstacles(): void {
    for (const obstacle of this.layout.obstacles) {
      const x = Math.floor(normalizeToMeters(obstacle.position.x, obstacle.position.unit) / this.resolution);
      const y = Math.floor(normalizeToMeters(obstacle.position.y, obstacle.position.unit) / this.resolution);
      const w = Math.ceil(normalizeToMeters(obstacle.dimensions.width, obstacle.dimensions.unit) / this.resolution);
      const h = Math.ceil(normalizeToMeters(obstacle.dimensions.height, obstacle.dimensions.unit) / this.resolution);
      
      for (let dy = 0; dy < h && y + dy < this.gridHeight; dy++) {
        for (let dx = 0; dx < w && x + dx < this.gridWidth; dx++) {
          if (obstacle.permeability < 0.5) {
            this.obstacleMask[y + dy][x + dx] = true;
          }
        }
      }
    }
  }

  private getStoveEmissions(): Array<{ x: number; y: number; rate: number; heat: number }> {
    const emissions: Array<{ x: number; y: number; rate: number; heat: number }> = [];
    
    for (const stove of this.layout.stoves) {
      if (!stove.enabled) continue;
      
      const sx = normalizeToMeters(stove.position.x, stove.position.unit);
      const sy = normalizeToMeters(stove.position.y, stove.position.unit);
      const sw = normalizeToMeters(stove.dimensions.width, stove.dimensions.unit);
      const sh = normalizeToMeters(stove.dimensions.height, stove.dimensions.unit);
      
      const centerX = (sx + sw / 2) / this.resolution;
      const centerY = (sy + sh / 2) / this.resolution;
      
      emissions.push({
        x: Math.floor(centerX),
        y: Math.floor(centerY),
        rate: stove.fumeEmissionRate,
        heat: stove.heatOutput,
      });
    }
    
    return emissions;
  }

  private getExhaustVents(): Array<{ x: number; y: number; airflow: number; efficiency: number }> {
    const vents: Array<{ x: number; y: number; airflow: number; efficiency: number }> = [];
    
    for (const vent of this.layout.exhaustVents) {
      if (!vent.enabled) continue;
      
      const vx = normalizeToMeters(vent.position.x, vent.position.unit);
      const vy = normalizeToMeters(vent.position.y, vent.position.unit);
      const vw = normalizeToMeters(vent.dimensions.width, vent.dimensions.unit);
      const vh = normalizeToMeters(vent.dimensions.height, vent.dimensions.unit);
      
      const centerX = (vx + vw / 2) / this.resolution;
      const centerY = (vy + vh / 2) / this.resolution;
      
      vents.push({
        x: Math.floor(centerX),
        y: Math.floor(centerY),
        airflow: vent.airflowRate,
        efficiency: vent.captureEfficiency,
      });
    }
    
    return vents;
  }

  private initializeVelocityField(vents: Array<{ x: number; y: number; airflow: number; efficiency: number }>): void {
    const totalAirflow = vents.reduce((sum, v) => sum + v.airflow, 0);
    if (totalAirflow === 0) return;

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.obstacleMask[y][x]) continue;
        
        let vx = 0, vy = 0;
        
        for (const vent of vents) {
          const dx = vent.x - x;
          const dy = vent.y - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const strength = (vent.airflow / totalAirflow) * vent.efficiency / Math.max(distance, 1);
            vx += (dx / distance) * strength;
            vy += (dy / distance) * strength;
          }
        }
        
        this.velocityGrid[y][x] = { x: vx * 0.5, y: vy * 0.5 };
      }
    }
  }

  private addBuoyancyEffect(emissions: Array<{ x: number; y: number; rate: number; heat: number }>): void {
    for (const emission of emissions) {
      const radius = 3;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = emission.x + dx;
          const y = emission.y + dy;
          
          if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) continue;
          if (this.obstacleMask[y][x]) continue;
          
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const effect = (1 - distance / radius) * 0.3;
            this.velocityGrid[y][x].y -= effect;
            this.temperatureGrid[y][x] += emission.heat / 1000 * (1 - distance / radius);
          }
        }
      }
    }
  }

  private diffuse(): void {
    const newGrid = this.createGrid(0);
    const factor = this.config.diffusionFactor * 0.2;
    
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.obstacleMask[y][x]) continue;
        
        let sum = 0;
        let count = 0;
        
        for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < this.gridHeight && nx >= 0 && nx < this.gridWidth) {
            if (!this.obstacleMask[ny][nx]) {
              sum += this.concentrationGrid[ny][nx];
              count++;
            }
          }
        }
        
        if (count > 0) {
          const avg = sum / count;
          newGrid[y][x] = this.concentrationGrid[y][x] * (1 - factor) + avg * factor;
        } else {
          newGrid[y][x] = this.concentrationGrid[y][x];
        }
      }
    }
    
    this.concentrationGrid = newGrid;
  }

  private advect(): void {
    const newGrid = this.createGrid(0);
    
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.obstacleMask[y][x]) continue;
        
        const vel = this.velocityGrid[y][x];
        const srcX = x - vel.x * this.config.advectionFactor;
        const srcY = y - vel.y * this.config.advectionFactor;
        
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        
        const fx = srcX - x0;
        const fy = srcY - y0;
        
        const getConcentration = (gx: number, gy: number): number => {
          if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) return 0;
          if (this.obstacleMask[gy][gx]) return 0;
          return this.concentrationGrid[gy][gx];
        };
        
        const c00 = getConcentration(x0, y0);
        const c01 = getConcentration(x0, y1);
        const c10 = getConcentration(x1, y0);
        const c11 = getConcentration(x1, y1);
        
        newGrid[y][x] = c00 * (1 - fx) * (1 - fy) +
                       c10 * fx * (1 - fy) +
                       c01 * (1 - fx) * fy +
                       c11 * fx * fy;
      }
    }
    
    this.concentrationGrid = newGrid;
  }

  private addEmissions(emissions: Array<{ x: number; y: number; rate: number; heat: number }>): void {
    for (const emission of emissions) {
      const radius = 2;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = emission.x + dx;
          const y = emission.y + dy;
          
          if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) continue;
          if (this.obstacleMask[y][x]) continue;
          
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const emissionFactor = (1 - distance / radius) * emission.rate / 100;
            this.concentrationGrid[y][x] += emissionFactor;
          }
        }
      }
    }
  }

  private applyExhaust(vents: Array<{ x: number; y: number; airflow: number; efficiency: number }>): void {
    const totalAirflow = vents.reduce((sum, v) => sum + v.airflow, 0);
    if (totalAirflow === 0) return;
    
    for (const vent of vents) {
      const radius = 4;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = vent.x + dx;
          const y = vent.y + dy;
          
          if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) continue;
          if (this.obstacleMask[y][x]) continue;
          
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const extractionRate = vent.efficiency * (1 - distance / radius) * (vent.airflow / totalAirflow) * 0.5;
            this.concentrationGrid[y][x] *= (1 - extractionRate);
          }
        }
      }
    }
  }

  private calculateConvergence(oldGrid: number[][]): number {
    let maxDiff = 0;
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const diff = Math.abs(this.concentrationGrid[y][x] - oldGrid[y][x]);
        maxDiff = Math.max(maxDiff, diff);
      }
    }
    return maxDiff;
  }

  private copyGrid(grid: number[][]): number[][] {
    return grid.map(row => [...row]);
  }

  public run(): SimulationResult {
    const startTime = Date.now();
    const anomalies = validateLayout(this.layout);
    
    const emissions = this.getStoveEmissions();
    const vents = this.getExhaustVents();
    
    this.initializeVelocityField(vents);
    this.addBuoyancyEffect(emissions);
    
    let iteration = 0;
    let convergence = Infinity;
    
    while (iteration < this.config.maxIterations && convergence > this.config.convergenceThreshold) {
      const oldGrid = this.copyGrid(this.concentrationGrid);
      
      this.addEmissions(emissions);
      this.diffuse();
      this.advect();
      this.applyExhaust(vents);
      
      convergence = this.calculateConvergence(oldGrid);
      iteration++;
    }
    
    const cells: GridCell[] = [];
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        cells.push({
          x,
          y,
          concentration: this.concentrationGrid[y][x],
          velocity: this.velocityGrid[y][x],
          temperature: this.temperatureGrid[y][x],
        });
      }
    }
    
    const detectionPointResults = this.calculateDetectionPoints();
    const overallStats = this.calculateStats(cells, emissions, vents);
    
    const concentrationAnomalies = this.checkConcentrationThresholds(detectionPointResults);
    anomalies.push(...concentrationAnomalies);
    
    return {
      layoutId: this.layout.id,
      layoutName: this.layout.name,
      version: this.layout.version.version,
      timestamp: new Date().toISOString(),
      gridSize: { width: this.gridWidth, height: this.gridHeight },
      gridResolution: this.resolution,
      cells,
      detectionPointResults,
      overallStats,
      anomalies,
      simulationTime: Date.now() - startTime,
    };
  }

  private calculateDetectionPoints(): DetectionPointResult[] {
    const results: DetectionPointResult[] = [];
    
    for (const point of this.layout.detectionPoints) {
      const x = Math.floor(normalizeToMeters(point.position.x, point.position.unit) / this.resolution);
      const y = Math.floor(normalizeToMeters(point.position.y, point.position.unit) / this.resolution);
      
      let concentration = 0;
      if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
        concentration = this.concentrationGrid[y][x];
      }
      
      results.push({
        id: point.id,
        name: point.name,
        position: point.position,
        concentration,
        threshold: point.threshold,
        exceeded: point.threshold !== undefined && concentration > point.threshold,
      });
    }
    
    return results;
  }

  private checkConcentrationThresholds(results: DetectionPointResult[]) {
    const anomalies = [];
    
    for (const result of results) {
      if (result.concentration > CONCENTRATION_LIMITS.LEGAL_LIMIT_MG_M3) {
        anomalies.push({
          id: 'anomaly_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          category: 'rule' as const,
          severity: 'error' as const,
          field: `detectionPoints.${result.id}.concentration`,
          message: `检测点"${result.name}"浓度(${result.concentration.toFixed(2)}mg/m³)超过法定限值`,
          suggestion: '请调整排风方案，确保油烟浓度在法定限值内',
          value: result.concentration.toFixed(2) + 'mg/m³',
          expected: `<= ${CONCENTRATION_LIMITS.LEGAL_LIMIT_MG_M3}mg/m³`,
        });
      } else if (result.concentration > CONCENTRATION_LIMITS.WARNING_THRESHOLD_MG_M3) {
        anomalies.push({
          id: 'anomaly_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          category: 'rule' as const,
          severity: 'warning' as const,
          field: `detectionPoints.${result.id}.concentration`,
          message: `检测点"${result.name}"浓度(${result.concentration.toFixed(2)}mg/m³)接近法定限值`,
          suggestion: '建议优化排风方案，提高油烟捕集效率',
          value: result.concentration.toFixed(2) + 'mg/m³',
          expected: `<= ${CONCENTRATION_LIMITS.WARNING_THRESHOLD_MG_M3}mg/m³`,
        });
      }
    }
    
    return anomalies;
  }

  private calculateStats(
    cells: GridCell[],
    emissions: Array<{ x: number; y: number; rate: number; heat: number }>,
    vents: Array<{ x: number; y: number; airflow: number; efficiency: number }>,
  ): SimulationStats {
    const concentrations = cells.map(c => c.concentration);
    const maxConcentration = Math.max(...concentrations);
    const minConcentration = Math.min(...concentrations);
    const avgConcentration = concentrations.reduce((a, b) => a + b, 0) / concentrations.length;
    
    const variance = concentrations.reduce((sum, c) => sum + Math.pow(c - avgConcentration, 2), 0) / concentrations.length;
    const concentrationStdDev = Math.sqrt(variance);
    
    const totalEmission = emissions.reduce((sum, e) => sum + e.rate, 0);
    const totalAirflow = vents.reduce((sum, v) => sum + v.airflow, 0);
    
    const avgEfficiency = vents.length > 0 
      ? vents.reduce((sum, v) => sum + v.efficiency, 0) / vents.length 
      : 0;
    const airflowFactor = totalAirflow > 0 ? Math.min(totalAirflow / 5000, 1.5) : 0;
    const exhaustEfficiency = avgEfficiency * airflowFactor * 0.7;
    
    return {
      maxConcentration,
      avgConcentration,
      minConcentration,
      concentrationStdDev,
      exhaustEfficiency,
      totalAirflow,
      totalEmission,
    };
  }
}

export function runSimulation(layout: KitchenLayout, config?: Partial<SimulationConfig>): SimulationResult {
  const engine = new FumeSimulationEngine(layout, config);
  return engine.run();
}
