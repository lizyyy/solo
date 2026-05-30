import { StoneParams, TrajectoryPoint, Vector2D, GRAVITY, ICE_SHEET_WIDTH, ICE_SHEET_LENGTH, STONE_RADIUS } from '../types';

const TIME_STEP = 0.01;
const MAX_SIMULATION_TIME = 30;
const VELOCITY_THRESHOLD = 0.01;

function calculateFrictionForce(velocity: Vector2D, frictionCoeff: number, mass: number): Vector2D {
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  if (speed < VELOCITY_THRESHOLD) return { x: 0, y: 0 };
  
  const frictionMagnitude = frictionCoeff * mass * GRAVITY;
  return {
    x: -(velocity.x / speed) * frictionMagnitude,
    y: -(velocity.y / speed) * frictionMagnitude
  };
}

function calculateCurlForce(
  velocity: Vector2D,
  rotationDirection: 'clockwise' | 'counterclockwise',
  rotationSpeed: number,
  frictionCoeff: number
): Vector2D {
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  if (speed < VELOCITY_THRESHOLD || rotationSpeed < 0.1) return { x: 0, y: 0 };

  const direction = rotationDirection === 'clockwise' ? 1 : -1;
  const curlStrength = 0.0008 * rotationSpeed * frictionCoeff;
  
  return {
    x: direction * velocity.y * curlStrength,
    y: -direction * velocity.x * curlStrength
  };
}

function integrateStep(
  position: Vector2D,
  velocity: Vector2D,
  stone: StoneParams,
  dt: number
): { position: Vector2D; velocity: Vector2D } {
  const mass = 19.1;
  
  const frictionForce = calculateFrictionForce(velocity, stone.friction, mass);
  const curlForce = calculateCurlForce(
    velocity,
    stone.rotation.direction,
    stone.rotation.speed,
    stone.friction
  );
  
  const totalForce = {
    x: frictionForce.x + curlForce.x,
    y: frictionForce.y + curlForce.y
  };
  
  const acceleration = {
    x: totalForce.x / mass,
    y: totalForce.y / mass
  };
  
  const newVelocity = {
    x: velocity.x + acceleration.x * dt,
    y: velocity.y + acceleration.y * dt
  };
  
  const newSpeed = Math.sqrt(newVelocity.x * newVelocity.x + newVelocity.y * newVelocity.y);
  if (newSpeed < VELOCITY_THRESHOLD) {
    return { position, velocity: { x: 0, y: 0 } };
  }
  
  const newPosition = {
    x: position.x + velocity.x * dt + 0.5 * acceleration.x * dt * dt,
    y: position.y + velocity.y * dt + 0.5 * acceleration.y * dt * dt
  };
  
  return { position: newPosition, velocity: newVelocity };
}

export function calculateTrajectory(stone: StoneParams): TrajectoryPoint[] {
  const trajectory: TrajectoryPoint[] = [];
  let position = { ...stone.initialPosition };
  let velocity = { ...stone.initialVelocity };
  let time = 0;
  
  trajectory.push({
    position: { ...position },
    velocity: { ...velocity },
    timestamp: time
  });
  
  while (time < MAX_SIMULATION_TIME) {
    const result = integrateStep(position, velocity, stone, TIME_STEP);
    
    position = result.position;
    velocity = result.velocity;
    time += TIME_STEP;
    
    trajectory.push({
      position: { ...position },
      velocity: { ...velocity },
      timestamp: time
    });
    
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (speed < VELOCITY_THRESHOLD) break;
    
    if (position.x < -ICE_SHEET_WIDTH / 2 || position.x > ICE_SHEET_WIDTH / 2 ||
        position.y < -ICE_SHEET_LENGTH / 2 || position.y > ICE_SHEET_LENGTH / 2) {
      break;
    }
  }
  
  return trajectory;
}

export function getPositionAtTime(trajectory: TrajectoryPoint[], time: number): TrajectoryPoint {
  if (trajectory.length === 0) {
    return { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, timestamp: 0 };
  }
  
  if (time <= trajectory[0].timestamp) return trajectory[0];
  if (time >= trajectory[trajectory.length - 1].timestamp) return trajectory[trajectory.length - 1];
  
  for (let i = 1; i < trajectory.length; i++) {
    if (trajectory[i].timestamp >= time) {
      const t0 = trajectory[i - 1].timestamp;
      const t1 = trajectory[i].timestamp;
      const alpha = (time - t0) / (t1 - t0);
      
      return {
        position: {
          x: trajectory[i - 1].position.x + alpha * (trajectory[i].position.x - trajectory[i - 1].position.x),
          y: trajectory[i - 1].position.y + alpha * (trajectory[i].position.y - trajectory[i - 1].position.y)
        },
        velocity: {
          x: trajectory[i - 1].velocity.x + alpha * (trajectory[i].velocity.x - trajectory[i - 1].velocity.x),
          y: trajectory[i - 1].velocity.y + alpha * (trajectory[i].velocity.y - trajectory[i - 1].velocity.y)
        },
        timestamp: time
      };
    }
  }
  
  return trajectory[trajectory.length - 1];
}

export function checkWallCollision(position: Vector2D): { collided: boolean; wall: 'left' | 'right' | 'top' | 'bottom' | null } {
  const halfWidth = ICE_SHEET_WIDTH / 2 - STONE_RADIUS;
  const halfLength = ICE_SHEET_LENGTH / 2 - STONE_RADIUS;
  
  if (position.x < -halfWidth) return { collided: true, wall: 'left' };
  if (position.x > halfWidth) return { collided: true, wall: 'right' };
  if (position.y < -halfLength) return { collided: true, wall: 'bottom' };
  if (position.y > halfLength) return { collided: true, wall: 'top' };
  
  return { collided: false, wall: null };
}
