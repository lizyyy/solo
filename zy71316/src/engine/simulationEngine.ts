import { SimulationParams, TrajectoryPoint, SimulationResult, TraceRecord, MIN_SAFE_LANDING_VELOCITY } from '../types';
import { RK4Integrator } from './numericIntegration';
import { MarsDragModel } from './dragModel';
import { RiskDetector } from './riskDetector';

export class SimulationEngine {
  private integrator: RK4Integrator;
  private dragModel: MarsDragModel;
  private riskDetector: RiskDetector;

  constructor(stepSize: number = 0.1) {
    this.integrator = new RK4Integrator(stepSize);
    this.dragModel = new MarsDragModel();
    this.riskDetector = new RiskDetector();
  }

  run(params: SimulationParams): SimulationResult {
    this.riskDetector.reset();
    
    const trajectory: TrajectoryPoint[] = [];
    const traceRecords: TraceRecord[] = [];
    let parachuteDeployed = false;
    let stepSize = 0.1;

    let currentState = {
      altitude: params.initialAltitude,
      velocity: params.initialVelocity
    };

    let currentTime = 0;
    const maxTime = 1000;

    while (currentState.altitude > 0 && currentTime < maxTime) {
      const shouldDeploy = this.dragModel.checkParachuteDeployment(
        currentState.altitude,
        parachuteDeployed,
        params
      );
      
      if (shouldDeploy && !parachuteDeployed) {
        parachuteDeployed = true;
      }

      const { acceleration, dragForce } = this.dragModel.calculateAcceleration(
        currentState.velocity,
        currentState.altitude,
        parachuteDeployed,
        params
      );

      const point: TrajectoryPoint = {
        time: currentTime,
        altitude: currentState.altitude,
        velocity: currentState.velocity,
        acceleration,
        dragForce,
        parachuteDeployed,
        risks: []
      };

      const risks = this.riskDetector.detect(point, params, trajectory);
      point.risks = risks;

      risks.forEach(risk => {
        const existingRecord = traceRecords.find(r => r.riskType === risk);
        if (!existingRecord) {
          traceRecords.push(
            this.riskDetector.createTraceRecord(trajectory.length, risk, params)
          );
        }
      });

      trajectory.push(point);

      const k1 = { altitude: -currentState.velocity, velocity: acceleration };
      const k2State = {
        altitude: currentState.altitude - currentState.velocity * stepSize / 2,
        velocity: currentState.velocity + acceleration * stepSize / 2
      };
      const { acceleration: a2 } = this.dragModel.calculateAcceleration(
        k2State.velocity, k2State.altitude, parachuteDeployed, params
      );
      const k2 = { altitude: -k2State.velocity, velocity: a2 };

      const k3State = {
        altitude: currentState.altitude - k2State.velocity * stepSize / 2,
        velocity: currentState.velocity + a2 * stepSize / 2
      };
      const { acceleration: a3 } = this.dragModel.calculateAcceleration(
        k3State.velocity, k3State.altitude, parachuteDeployed, params
      );
      const k3 = { altitude: -k3State.velocity, velocity: a3 };

      const k4State = {
        altitude: currentState.altitude - k3State.velocity * stepSize,
        velocity: currentState.velocity + a3 * stepSize
      };
      const { acceleration: a4 } = this.dragModel.calculateAcceleration(
        k4State.velocity, k4State.altitude, parachuteDeployed, params
      );
      const k4 = { altitude: -k4State.velocity, velocity: a4 };

      currentState = {
        altitude: currentState.altitude + (k1.altitude + 2*k2.altitude + 2*k3.altitude + k4.altitude) * stepSize / 6,
        velocity: currentState.velocity + (k1.velocity + 2*k2.velocity + 2*k3.velocity + k4.velocity) * stepSize / 6
      };

      currentTime += stepSize;

      if (currentState.altitude <= 0) {
        currentState.altitude = 0;
        const finalPoint: TrajectoryPoint = {
          time: currentTime,
          altitude: 0,
          velocity: currentState.velocity,
          acceleration,
          dragForce,
          parachuteDeployed,
          risks: []
        };
        trajectory.push(finalPoint);
        break;
      }
    }

    const finalVelocity = trajectory[trajectory.length - 1]?.velocity || 0;
    const totalTime = trajectory[trajectory.length - 1]?.time || 0;
    const landedSafely = finalVelocity <= MIN_SAFE_LANDING_VELOCITY;

    return {
      params,
      trajectory,
      risks: traceRecords,
      finalVelocity,
      totalTime,
      landedSafely
    };
  }

  getRiskExplanation = (riskType: string) => {
    return this.riskDetector.getRiskExplanation(riskType as any);
  };
}

export const createSimulationEngine = (stepSize?: number) => new SimulationEngine(stepSize);
