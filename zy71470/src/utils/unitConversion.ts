export const degToRad = (deg: number): number => {
  return (deg * Math.PI) / 180;
};

export const radToDeg = (rad: number): number => {
  return (rad * 180) / Math.PI;
};

export const toRadians = (angle: number, unit: 'degree' | 'radian'): number => {
  return unit === 'degree' ? degToRad(angle) : angle;
};

export const toDisplayAngle = (angle: number, unit: 'degree' | 'radian'): number => {
  return unit === 'degree' ? radToDeg(angle) : angle;
};

export const nmToM = (nm: number): number => {
  return nm * 1e-9;
};

export const mToNm = (m: number): number => {
  return m * 1e9;
};
