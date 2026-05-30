export const AIR_DENSITY = 1.225;
export const GRAVITY = 9.81;
export const PHYSICS_DT = 0.016;
export const MAX_SPEED = 120;

export const THRESHOLDS = {
  HIGH_DRAG: 4000,
  LOW_GRIP: 0.65,
  CORNER_SPEED_LIMIT: 0.88,
  SEVERITY_WEIGHTS: {
    high_drag: 1.2,
    low_grip: 1.5,
    corner_loss: 2.0
  } as const
};

export const DEFAULT_CAR = {
  mass: 750,
  power: 450000,
  baseDragCoeff: 0.35,
  baseLiftCoeff: 0.1,
  frontalArea: 1.8,
  tireGrip: 1.2
};

export const DEFAULT_WING = {
  angle: -8,
  dragFactor: 1.25,
  liftFactor: 0.64
};

export const DEFAULT_WIND = {
  speed: 50,
  direction: 0
};

export const wingAngleToFactors = (angle: number) => {
  const dragFactor = 1 + 0.018 * Math.abs(angle) + 0.0008 * angle * angle;
  const liftFactor = -0.08 * angle;
  return { dragFactor, liftFactor };
};

export const TRACK_WIDTH = 200;
export const TRACK_HEIGHT = 150;
export const SCALE = 3;
