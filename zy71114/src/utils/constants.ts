export const RISK_THRESHOLDS = {
  DANGER: 0.3,
  WARNING: 0.5,
} as const;

export const COLORS = {
  PRIMARY: '#165DFF',
  DANGER: '#F53F3F',
  WARNING: '#FF7D00',
  SUCCESS: '#00B42A',
  NEUTRAL: '#86909C',
  WHITE: '#FFFFFF',
  BLACK: '#1D2129',
  GARAGE_FLOOR: '#4E5969',
  GARAGE_WALL: '#272E3B',
  RAMP: '#86909C',
  BEAM: '#C9CDD4',
} as const;

export const SIMULATION_CONFIG = {
  DEFAULT_SPEED: 0.3,
  MIN_SPEED: 0.1,
  MAX_SPEED: 1.0,
  SAMPLE_POINTS: 20,
} as const;

export const UNIT_CONVERSION = {
  M_TO_CM: 100,
  CM_TO_M: 0.01,
} as const;

export const LABELS = {
  RISK_LEVEL: {
    safe: '安全',
    warning: '警告',
    danger: '危险',
  },
  VEHICLE_TYPE: {
    car: '轿车',
    suv: 'SUV',
    van: '面包车',
    truck: '货车',
  },
} as const;
