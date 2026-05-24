import { Garage, Vehicle, RiskPoint, Measurement, Vector3 } from '../types';
import { RISK_THRESHOLDS } from '../utils/constants';

export class HeightChecker {
  private garage: Garage;
  private vehicle: Vehicle;

  constructor(garage: Garage, vehicle: Vehicle) {
    this.garage = garage;
    this.vehicle = vehicle;
  }

  public getVehicleHeightInMeters(): number {
    if (this.vehicle.unit === 'cm') {
      return this.vehicle.height / 100;
    }
    return this.vehicle.height;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpVector3(v1: Vector3, v2: Vector3, t: number): Vector3 {
    return [this.lerp(v1[0], v2[0], t), this.lerp(v1[1], v2[1], t), this.lerp(v1[2], v2[2], t)];
  }

  private getGroundHeightAtPosition(position: Vector3): number {
    for (const ramp of this.garage.ramps) {
      const points = ramp.points;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        const minZ = Math.min(p1[2], p2[2]);
        const maxZ = Math.max(p1[2], p2[2]);

        if (position[2] >= minZ && position[2] <= maxZ) {
          const t = maxZ === minZ ? 0 : (position[2] - minZ) / (maxZ - minZ);
          const groundY = this.lerp(p1[1], p2[1], t);
          return groundY;
        }
      }
    }
    return 0;
  }

  private getCeilingHeightAtPosition(position: Vector3): number {
    let minCeilingHeight = Infinity;

    for (const beam of this.garage.beams) {
      const beamX = beam.position[0];
      const beamZ = beam.position[2];
      const halfWidth = beam.size[0] / 2;
      const halfDepth = beam.size[2] / 2;

      if (
        position[0] >= beamX - halfWidth &&
        position[0] <= beamX + halfWidth &&
        position[2] >= beamZ - halfDepth &&
        position[2] <= beamZ + halfDepth
      ) {
        if (beam.bottomHeight < minCeilingHeight) {
          minCeilingHeight = beam.bottomHeight;
        }
      }
    }

    return minCeilingHeight === Infinity ? 6 : minCeilingHeight;
  }

  private calculateClearHeight(position: Vector3): number {
    const groundHeight = this.getGroundHeightAtPosition(position);
    const ceilingHeight = this.getCeilingHeightAtPosition(position);
    return ceilingHeight - groundHeight;
  }

  private checkPoint(position: Vector3, location: string): RiskPoint | null {
    const clearHeight = this.calculateClearHeight(position);
    const vehicleHeight = this.getVehicleHeightInMeters();
    const delta = clearHeight - vehicleHeight;

    if (delta < RISK_THRESHOLDS.WARNING) {
      return {
        id: `risk-${location}-${position[0].toFixed(1)}`,
        location,
        position,
        clearHeight,
        vehicleHeight,
        delta,
        level: delta < RISK_THRESHOLDS.DANGER ? 'danger' : 'warning',
        description:
          delta < RISK_THRESHOLDS.DANGER
            ? `净高不足！净空${clearHeight.toFixed(2)}m，车高${vehicleHeight.toFixed(2)}m`
            : `净高警告！净空${clearHeight.toFixed(2)}m，接近车高${vehicleHeight.toFixed(2)}m`,
      };
    }
    return null;
  }

  public checkRamp(rampIndex: number = 0): RiskPoint[] {
    const riskPoints: RiskPoint[] = [];
    const ramp = this.garage.ramps[rampIndex];

    if (!ramp) return riskPoints;

    for (const tp of ramp.transitionPoints) {
      const risk = this.checkPoint(tp.position, '坡道转折处');
      if (risk) {
        riskPoints.push(risk);
      }
    }

    const sampleCount = 10;
    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const totalSegments = ramp.points.length - 1;
      const exactIndex = t * totalSegments;
      const segmentIndex = Math.floor(exactIndex);
      const segmentT = exactIndex - segmentIndex;

      if (segmentIndex < totalSegments) {
        const p1 = ramp.points[segmentIndex];
        const p2 = ramp.points[segmentIndex + 1];
        const position = this.lerpVector3(p1, p2, segmentT);

        const risk = this.checkPoint(position, `坡道${Math.round(t * 100)}%处`);
        if (risk) {
          const exists = riskPoints.some(
            (rp) => Math.abs(rp.position[2] - position[2]) < 1
          );
          if (!exists) {
            riskPoints.push(risk);
          }
        }
      }
    }

    return riskPoints.sort((a, b) => a.delta - b.delta);
  }

  public checkEntrance(entranceId: string): RiskPoint | null {
    const entrance = this.garage.entrances.find((e) => e.id === entranceId);
    if (!entrance) return null;

    return this.checkPoint(entrance.position, `入口${entrance.name}`);
  }

  public checkAllEntrances(): RiskPoint[] {
    const riskPoints: RiskPoint[] = [];
    for (const entrance of this.garage.entrances) {
      const risk = this.checkEntrance(entrance.id);
      if (risk) {
        riskPoints.push(risk);
      }
    }
    return riskPoints;
  }

  public getMeasurementsAlongRamp(rampIndex: number = 0): Measurement[] {
    const measurements: Measurement[] = [];
    const ramp = this.garage.ramps[rampIndex];

    if (!ramp) return measurements;

    const sampleCount = 20;
    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const totalSegments = ramp.points.length - 1;
      const exactIndex = t * totalSegments;
      const segmentIndex = Math.floor(exactIndex);
      const segmentT = exactIndex - segmentIndex;

      if (segmentIndex < totalSegments) {
        const p1 = ramp.points[segmentIndex];
        const p2 = ramp.points[segmentIndex + 1];
        const position = this.lerpVector3(p1, p2, segmentT);

        const groundHeight = this.getGroundHeightAtPosition(position);
        const ceilingHeight = this.getCeilingHeightAtPosition(position);
        const clearHeight = ceilingHeight - groundHeight;

        measurements.push({
          id: `meas-${i}`,
          position,
          clearHeight,
          groundHeight,
          ceilingHeight,
        });
      }
    }

    return measurements;
  }

  public getMissingSigns(): string[] {
    return this.garage.entrances
      .filter((e) => !e.hasSign)
      .map((e) => e.name);
  }

  public runFullCheck(): {
    riskPoints: RiskPoint[];
    measurements: Measurement[];
    missingSigns: string[];
    overallResult: 'pass' | 'fail' | 'warning';
  } {
    const rampRisks = this.checkRamp(0);
    const entranceRisks = this.checkAllEntrances();
    const allRisks = [...rampRisks, ...entranceRisks];
    const measurements = this.getMeasurementsAlongRamp(0);
    const missingSigns = this.getMissingSigns();

    const hasDanger = allRisks.some((r) => r.level === 'danger');
    const hasWarning = allRisks.some((r) => r.level === 'warning');

    let overallResult: 'pass' | 'fail' | 'warning' = 'pass';
    if (hasDanger) {
      overallResult = 'fail';
    } else if (hasWarning || missingSigns.length > 0) {
      overallResult = 'warning';
    }

    return {
      riskPoints: allRisks,
      measurements,
      missingSigns,
      overallResult,
    };
  }
}
