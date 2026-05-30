import { Vector2D, MagneticDirection, ParticleConfig, TrajectoryPoint, MagneticField, SIMULATION_DT } from '../../types';

export function calculateLorentzForce(
  velocity: Vector2D,
  charge: number,
  magneticField: { strength: number; direction: MagneticDirection } | null
): Vector2D {
  if (!magneticField || magneticField.strength === 0) {
    return { x: 0, y: 0 };
  }

  const { strength, direction } = magneticField;
  const q = charge;
  const v = velocity;
  const B = strength;

  switch (direction) {
    case 'into':
      return {
        x: q * v.y * B,
        y: -q * v.x * B
      };
    case 'outof':
      return {
        x: -q * v.y * B,
        y: q * v.x * B
      };
    case 'left':
      return {
        x: 0,
        y: q * v.x * B
      };
    case 'right':
      return {
        x: 0,
        y: -q * v.x * B
      };
    case 'up':
      return {
        x: -q * v.y * B,
        y: 0
      };
    case 'down':
      return {
        x: q * v.y * B,
        y: 0
      };
    default:
      return { x: 0, y: 0 };
  }
}

export function getMagneticFieldAtPoint(
  position: Vector2D,
  magneticFields: MagneticField[]
): { strength: number; direction: MagneticDirection } | null {
  for (const field of magneticFields) {
    if (
      position.x >= field.x &&
      position.x <= field.x + field.width &&
      position.y >= field.y &&
      position.y <= field.y + field.height
    ) {
      return {
        strength: field.strength,
        direction: field.direction
      };
    }
  }
  return null;
}

export function updateParticleState(
  currentPosition: Vector2D,
  currentVelocity: Vector2D,
  force: Vector2D,
  mass: number,
  dt: number = SIMULATION_DT
): { position: Vector2D; velocity: Vector2D } {
  const ax = force.x / mass;
  const ay = force.y / mass;

  const newVelocity = {
    x: currentVelocity.x + ax * dt,
    y: currentVelocity.y + ay * dt
  };

  const newPosition = {
    x: currentPosition.x + newVelocity.x * dt * 1e6,
    y: currentPosition.y + newVelocity.y * dt * 1e6
  };

  return { position: newPosition, velocity: newVelocity };
}

export function calculateKineticEnergy(velocity: Vector2D, mass: number): number {
  const speedSq = velocity.x * velocity.x + velocity.y * velocity.y;
  return 0.5 * mass * speedSq;
}

export function calculateSpeed(velocity: Vector2D): number {
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
}

export function calculateGyroradius(
  velocity: Vector2D,
  charge: number,
  mass: number,
  magneticStrength: number
): number {
  if (magneticStrength === 0) return Infinity;
  const speed = calculateSpeed(velocity);
  return Math.abs((mass * speed) / (charge * magneticStrength));
}

export function simulateStep(
  currentPoint: TrajectoryPoint,
  particleConfig: ParticleConfig,
  magneticFields: MagneticField[],
  frame: number
): TrajectoryPoint {
  const magneticField = getMagneticFieldAtPoint(currentPoint.position, magneticFields);
  const force = calculateLorentzForce(currentPoint.velocity, particleConfig.charge, magneticField);
  const { position, velocity } = updateParticleState(
    currentPoint.position,
    currentPoint.velocity,
    force,
    particleConfig.mass
  );

  return {
    frame,
    timestamp: performance.now(),
    position,
    velocity,
    force,
    magneticField,
    inTrack: false
  };
}

export function createInitialTrajectoryPoint(
  particleConfig: ParticleConfig,
  magneticFields: MagneticField[]
): TrajectoryPoint {
  const magneticField = getMagneticFieldAtPoint(particleConfig.startPosition, magneticFields);
  const force = calculateLorentzForce(particleConfig.initialVelocity, particleConfig.charge, magneticField);

  return {
    frame: 0,
    timestamp: performance.now(),
    position: { ...particleConfig.startPosition },
    velocity: { ...particleConfig.initialVelocity },
    force,
    magneticField,
    inTrack: true
  };
}

export function runFullSimulation(
  particleConfig: ParticleConfig,
  magneticFields: MagneticField[],
  maxFrames: number,
  checkCollision: (point: TrajectoryPoint) => { collision: boolean; point: Vector2D | null },
  checkSuccess: (point: TrajectoryPoint) => boolean,
  checkInTrack: (point: TrajectoryPoint) => boolean
): { trajectory: TrajectoryPoint[]; result: { success: boolean; collision: boolean; collisionPoint: Vector2D | null; maxFramesReached: boolean } } {
  const trajectory: TrajectoryPoint[] = [];
  let currentPoint = createInitialTrajectoryPoint(particleConfig, magneticFields);
  currentPoint.inTrack = checkInTrack(currentPoint);
  trajectory.push(currentPoint);

  for (let frame = 1; frame < maxFrames; frame++) {
    const collisionCheck = checkCollision(currentPoint);
    if (collisionCheck.collision) {
      return {
        trajectory,
        result: {
          success: false,
          collision: true,
          collisionPoint: collisionCheck.point,
          maxFramesReached: false
        }
      };
    }

    if (checkSuccess(currentPoint)) {
      return {
        trajectory,
        result: {
          success: true,
          collision: false,
          collisionPoint: null,
          maxFramesReached: false
        }
      };
    }

    currentPoint = simulateStep(currentPoint, particleConfig, magneticFields, frame);
    currentPoint.inTrack = checkInTrack(currentPoint);
    trajectory.push(currentPoint);

    if (currentPoint.position.x < -100 || currentPoint.position.x > 2000 ||
        currentPoint.position.y < -100 || currentPoint.position.y > 2000) {
      return {
        trajectory,
        result: {
          success: false,
          collision: false,
          collisionPoint: { ...currentPoint.position },
          maxFramesReached: false
        }
      };
    }
  }

  return {
    trajectory,
    result: {
      success: false,
      collision: false,
      collisionPoint: null,
      maxFramesReached: true
    }
  };
}
