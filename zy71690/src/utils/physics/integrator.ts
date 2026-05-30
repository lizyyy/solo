import type { Body, Marble, Vector2, PhysicsParams, ErrorMark } from '@/types';
import { calculateNetGravity, checkVelocityOverflow } from './gravity';

interface State {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function derivatives(
  state: State,
  bodies: Body[],
  params: PhysicsParams,
  frame: number,
  errors: ErrorMark[]
): { dx: number; dy: number; dvx: number; dvy: number; errors: ErrorMark[] } {
  const gravityResult = calculateNetGravity(
    { x: state.x, y: state.y },
    bodies,
    params.gravitationalConstant,
    frame,
    errors
  );

  const ax = gravityResult.force.x;
  const ay = gravityResult.force.y;

  return {
    dx: state.vx,
    dy: state.vy,
    dvx: ax,
    dvy: ay,
    errors: gravityResult.errors,
  };
}

export function rk4Step(
  marble: Marble,
  bodies: Body[],
  params: PhysicsParams,
  frame: number,
  errorMarks: ErrorMark[]
): { marble: Marble; errors: ErrorMark[] } {
  const dt = params.timeStep;
  let currentErrors = [...errorMarks];

  const initialState: State = {
    x: marble.x,
    y: marble.y,
    vx: marble.vx,
    vy: marble.vy,
  };

  const k1 = derivatives(initialState, bodies, params, frame, currentErrors);
  currentErrors = k1.errors;

  const state2: State = {
    x: marble.x + (k1.dx * dt) / 2,
    y: marble.y + (k1.dy * dt) / 2,
    vx: marble.vx + (k1.dvx * dt) / 2,
    vy: marble.vy + (k1.dvy * dt) / 2,
  };
  const k2 = derivatives(state2, bodies, params, frame, currentErrors);
  currentErrors = k2.errors;

  const state3: State = {
    x: marble.x + (k2.dx * dt) / 2,
    y: marble.y + (k2.dy * dt) / 2,
    vx: marble.vx + (k2.dvx * dt) / 2,
    vy: marble.vy + (k2.dvy * dt) / 2,
  };
  const k3 = derivatives(state3, bodies, params, frame, currentErrors);
  currentErrors = k3.errors;

  const state4: State = {
    x: marble.x + k3.dx * dt,
    y: marble.y + k3.dy * dt,
    vx: marble.vx + k3.dvx * dt,
    vy: marble.vy + k3.dvy * dt,
  };
  const k4 = derivatives(state4, bodies, params, frame, currentErrors);
  currentErrors = k4.errors;

  let newVx = marble.vx + (dt * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx)) / 6;
  let newVy = marble.vy + (dt * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy)) / 6;

  newVx *= 1 - params.damping;
  newVy *= 1 - params.damping;

  const velCheck = checkVelocityOverflow(newVx, newVy, frame, currentErrors);
  newVx = velCheck.velocity.x;
  newVy = velCheck.velocity.y;
  currentErrors = velCheck.errors;

  const newX = marble.x + (dt * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx)) / 6;
  const newY = marble.y + (dt * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy)) / 6;

  const newTrail = [...marble.trail, { x: marble.x, y: marble.y }];
  if (newTrail.length > 500) {
    newTrail.shift();
  }

  return {
    marble: {
      ...marble,
      x: newX,
      y: newY,
      vx: newVx,
      vy: newVy,
      trail: newTrail,
    },
    errors: currentErrors,
  };
}

export function calculateEscapeVelocity(
  position: Vector2,
  bodies: Body[],
  G: number
): number {
  let totalPotential = 0;

  for (const body of bodies) {
    const dx = body.x - position.x;
    const dy = body.y - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      totalPotential += (2 * G * body.mass) / distance;
    }
  }

  return Math.sqrt(totalPotential);
}
