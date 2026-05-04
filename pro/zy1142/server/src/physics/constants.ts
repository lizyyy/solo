export const g = 9.8;
export const PI = Math.PI;

export const unitConversions: { [key: string]: { [unit: string]: number } } = {
  mass: {
    'kg': 1,
    'g': 0.001,
    'mg': 0.000001,
  },
  length: {
    'm': 1,
    'cm': 0.01,
    'mm': 0.001,
    'km': 1000,
  },
  angle: {
    'rad': 1,
    'deg': PI / 180,
  },
  velocity: {
    'm/s': 1,
    'km/h': 1000 / 3600,
    'cm/s': 0.01,
  },
  acceleration: {
    'm/s²': 1,
    'cm/s²': 0.01,
  },
  force: {
    'N': 1,
    'kN': 1000,
    'gf': 0.0098,
  },
  springConstant: {
    'N/m': 1,
    'N/cm': 100,
    'kN/m': 1000,
  },
  time: {
    's': 1,
    'ms': 0.001,
    'min': 60,
    'h': 3600,
  },
};

export const defaultUnits: { [paramName: string]: { unit: string; category: string } } = {
  mass: { unit: 'kg', category: 'mass' },
  angle: { unit: 'deg', category: 'angle' },
  angleRad: { unit: 'rad', category: 'angle' },
  height: { unit: 'm', category: 'length' },
  distance: { unit: 'm', category: 'length' },
  velocity: { unit: 'm/s', category: 'velocity' },
  velocityX: { unit: 'm/s', category: 'velocity' },
  velocityY: { unit: 'm/s', category: 'velocity' },
  acceleration: { unit: 'm/s²', category: 'acceleration' },
  accelerationX: { unit: 'm/s²', category: 'acceleration' },
  accelerationY: { unit: 'm/s²', category: 'acceleration' },
  force: { unit: 'N', category: 'force' },
  springConstant: { unit: 'N/m', category: 'springConstant' },
  extension: { unit: 'm', category: 'length' },
  time: { unit: 's', category: 'time' },
  frictionCoeff: { unit: '', category: '' },
  amplitude: { unit: 'm', category: 'length' },
};
