import { SimulationParams, MARS_GRAVITY, DRAG_COEFFICIENT_PROBE, DRAG_COEFFICIENT_PARACHUTE } from '../types';

const PROBE_REFERENCE_AREA = 15;

export class MarsDragModel {
  calculateDrag(
    velocity: number,
    parachuteDeployed: boolean,
    params: SimulationParams
  ): number {
    const Cd = parachuteDeployed ? DRAG_COEFFICIENT_PARACHUTE : DRAG_COEFFICIENT_PROBE;
    const area = parachuteDeployed ? params.parachuteArea : PROBE_REFERENCE_AREA;
    const density = params.atmosphericDensity;
    
    return 0.5 * Cd * density * area * velocity * velocity;
  }

  calculateAcceleration(
    velocity: number,
    altitude: number,
    parachuteDeployed: boolean,
    params: SimulationParams
  ): { acceleration: number; dragForce: number } {
    const dragForce = this.calculateDrag(velocity, parachuteDeployed, params);
    const gravityForce = params.probeMass * MARS_GRAVITY;
    const netForce = gravityForce - dragForce * Math.sign(velocity);
    const acceleration = netForce / params.probeMass;
    
    return { acceleration, dragForce };
  }

  checkParachuteDeployment(
    currentAltitude: number,
    parachuteAlreadyDeployed: boolean,
    params: SimulationParams
  ): boolean {
    if (parachuteAlreadyDeployed) {
      return true;
    }
    return currentAltitude <= params.deploymentAltitude;
  }

  calculateTerminalVelocity(
    parachuteDeployed: boolean,
    params: SimulationParams
  ): number {
    const Cd = parachuteDeployed ? DRAG_COEFFICIENT_PARACHUTE : DRAG_COEFFICIENT_PROBE;
    const area = parachuteDeployed ? params.parachuteArea : PROBE_REFERENCE_AREA;
    const density = params.atmosphericDensity;
    
    if (density <= 0 || area <= 0) {
      return Infinity;
    }
    
    return Math.sqrt((2 * params.probeMass * MARS_GRAVITY) / (Cd * density * area));
  }
}

export const createDragModel = () => new MarsDragModel();
