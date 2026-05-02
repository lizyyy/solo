import {
  LightingScenario,
  Point3D,
  PlantTray,
  LightFixture,
  LightModel,
  TrayCoverage,
  PointCoverage,
} from '../models/types.js';

export interface CalculationConfig {
  samplingDensity: number;
  referenceDistance: number;
  minLuxThreshold: number;
}

const DEFAULT_CONFIG: CalculationConfig = {
  samplingDensity: 0.1,
  referenceDistance: 1.0,
  minLuxThreshold: 1,
};

export class IlluminanceCalculator {
  private config: CalculationConfig;

  constructor(config?: Partial<CalculationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  calculateTrayCoverage(
    scenario: LightingScenario,
    tray: PlantTray
  ): TrayCoverage {
    const samplePoints = this.generateSamplePoints(tray);
    const pointCoverages: PointCoverage[] = [];

    for (const point of samplePoints) {
      const coverage = this.calculatePointIlluminance(
        scenario,
        point,
        tray.minLuxRequired
      );
      pointCoverages.push(coverage);
    }

    const coveredPoints = pointCoverages.filter(p => p.meetsRequirement).length;
    const totalPoints = pointCoverages.length;
    const darkZones = pointCoverages
      .filter(p => !p.meetsRequirement)
      .map(p => ({ x: p.x, y: p.y, z: p.z }));

    const luxValues = pointCoverages.map(p => p.totalLux);
    const minLux = Math.min(...luxValues);
    const maxLux = Math.max(...luxValues);
    const avgLux = luxValues.reduce((a, b) => a + b, 0) / luxValues.length;

    return {
      trayId: tray.id,
      trayName: tray.name,
      totalPoints,
      coveredPoints,
      coverageRatio: coveredPoints / totalPoints,
      minLux,
      maxLux,
      avgLux,
      darkZones,
      samplePoints: pointCoverages,
      meetsRequirement: coveredPoints === totalPoints,
    };
  }

  calculateAllTrayCoverages(
    scenario: LightingScenario
  ): TrayCoverage[] {
    return scenario.plantTrays.map(tray => 
      this.calculateTrayCoverage(scenario, tray)
    );
  }

  private generateSamplePoints(tray: PlantTray): Point3D[] {
    const points: Point3D[] = [];
    const { x, y, width, depth } = tray.position;
    const z = tray.height;
    const step = this.config.samplingDensity;

    for (let px = x + step / 2; px < x + width; px += step) {
      for (let py = y + step / 2; py < y + depth; py += step) {
        points.push({ x: px, y: py, z });
      }
    }

    if (points.length === 0) {
      points.push({ x: x + width / 2, y: y + depth / 2, z });
    }

    return points;
  }

  private calculatePointIlluminance(
    scenario: LightingScenario,
    point: Point3D,
    requiredLux: number
  ): PointCoverage {
    let totalLux = 0;
    const contributingLights: string[] = [];

    for (const fixture of scenario.fixtures) {
      const model = scenario.lightModels.find(m => m.id === fixture.modelId);
      if (!model) continue;

      const lux = this.calculateLightAtPoint(fixture, model, point);
      
      if (lux >= this.config.minLuxThreshold) {
        totalLux += lux;
        contributingLights.push(fixture.id);
      }
    }

    return {
      x: point.x,
      y: point.y,
      z: point.z,
      totalLux,
      contributingLights,
      meetsRequirement: totalLux >= requiredLux,
      requiredLux,
    };
  }

  calculateLightAtPoint(
    fixture: LightFixture,
    model: LightModel,
    point: Point3D
  ): number {
    const dx = point.x - fixture.position.x;
    const dy = point.y - fixture.position.y;
    const dz = point.z - fixture.position.z;

    const horizontalDistance = Math.sqrt(dx * dx + dy * dy);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 0.001) return model.baseLux;

    const halfBeamAngle = (model.beamAngle / 2) * (Math.PI / 180);
    const maxRadius = Math.abs(dz) * Math.tan(halfBeamAngle);

    if (horizontalDistance > maxRadius) {
      const edgeAngle = Math.atan2(horizontalDistance, Math.abs(dz));
      const intensityRatio = this.calculateIntensityRatio(edgeAngle, halfBeamAngle);
      
      const referenceDistance = this.config.referenceDistance;
      const distanceFactor = Math.pow(referenceDistance / distance, 2);
      
      return model.baseLux * distanceFactor * intensityRatio;
    }

    const angle = Math.atan2(horizontalDistance, Math.abs(dz));
    const intensityRatio = this.calculateIntensityRatio(angle, halfBeamAngle);

    const referenceDistance = this.config.referenceDistance;
    const distanceFactor = Math.pow(referenceDistance / distance, 2);

    return model.baseLux * distanceFactor * intensityRatio;
  }

  private calculateIntensityRatio(angle: number, halfBeamAngle: number): number {
    if (angle <= halfBeamAngle) {
      const normalizedAngle = angle / halfBeamAngle;
      return 1 - 0.5 * Math.pow(normalizedAngle, 2);
    }

    const falloffStart = halfBeamAngle;
    const falloffEnd = halfBeamAngle * 1.5;

    if (angle >= falloffEnd) {
      return 0.05;
    }

    const t = (angle - falloffStart) / (falloffEnd - falloffStart);
    return 0.5 * (1 - t) + 0.05 * t;
  }

  getLightCoverageRadius(
    fixture: LightFixture,
    model: LightModel,
    targetHeight: number
  ): number {
    const dz = Math.abs(fixture.position.z - targetHeight);
    const halfBeamAngle = (model.beamAngle / 2) * (Math.PI / 180);
    return dz * Math.tan(halfBeamAngle);
  }

  checkLightOverlap(
    fixture1: LightFixture,
    fixture2: LightFixture,
    model1: LightModel,
    model2: LightModel,
    targetHeight: number
  ): boolean {
    const radius1 = this.getLightCoverageRadius(fixture1, model1, targetHeight);
    const radius2 = this.getLightCoverageRadius(fixture2, model2, targetHeight);

    const dx = fixture1.position.x - fixture2.position.x;
    const dy = fixture1.position.y - fixture2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < radius1 + radius2;
  }
}
