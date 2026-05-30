import { Vector3, SwingFrame } from '@/types';

export const vector3 = (x: number, y: number, z: number): Vector3 => ({ x, y, z });

export const addVectors = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

export const subtractVectors = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const multiplyVector = (v: Vector3, scalar: number): Vector3 => ({
  x: v.x * scalar,
  y: v.y * scalar,
  z: v.z * scalar,
});

export const vectorLength = (v: Vector3): number => 
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

export const normalizeVector = (v: Vector3): Vector3 => {
  const len = vectorLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return multiplyVector(v, 1 / len);
};

export const distance = (a: Vector3, b: Vector3): number => 
  vectorLength(subtractVectors(a, b));

export const dotProduct = (a: Vector3, b: Vector3): number => 
  a.x * b.x + a.y * b.y + a.z * b.z;

export const crossProduct = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const lerp = (a: number, b: number, t: number): number => 
  a + (b - a) * t;

export const lerpVector = (a: Vector3, b: Vector3, t: number): Vector3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});

export const computeVelocity = (frames: SwingFrame[], index: number): number => {
  if (index < 1 || index >= frames.length) return 0;
  const prev = frames[index - 1];
  const curr = frames[index];
  const dt = (curr.timestamp - prev.timestamp) / 1000;
  if (dt === 0) return 0;
  return distance(curr.position, prev.position) / dt;
};

export const computeAcceleration = (frames: SwingFrame[], index: number): number => {
  if (index < 2 || index >= frames.length) return 0;
  const v1 = computeVelocity(frames, index - 1);
  const v2 = computeVelocity(frames, index);
  const dt = (frames[index].timestamp - frames[index - 1].timestamp) / 1000;
  if (dt === 0) return 0;
  return (v2 - v1) / dt;
};

export const computeJerk = (frames: SwingFrame[], index: number): number => {
  if (index < 3 || index >= frames.length) return 0;
  const a1 = computeAcceleration(frames, index - 1);
  const a2 = computeAcceleration(frames, index);
  const dt = (frames[index].timestamp - frames[index - 1].timestamp) / 1000;
  if (dt === 0) return 0;
  return (a2 - a1) / dt;
};

export const computeStandardDeviation = (values: number[]): number => {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
};

export const findImpactFrame = (frames: SwingFrame[]): number => {
  if (frames.length < 3) return Math.floor(frames.length / 2);
  
  let maxVelocity = 0;
  let impactIndex = Math.floor(frames.length * 0.7);
  
  for (let i = 1; i < frames.length - 1; i++) {
    const v = computeVelocity(frames, i);
    const nextV = computeVelocity(frames, i + 1);
    if (v > maxVelocity && v > nextV) {
      maxVelocity = v;
      impactIndex = i;
    }
  }
  
  return impactIndex;
};

export const computeFaceAngleChangeRate = (frames: SwingFrame[], startIndex: number, endIndex: number): number => {
  if (startIndex < 0 || endIndex >= frames.length || startIndex >= endIndex) return 0;
  
  const startAngle = frames[startIndex].faceAngle;
  const endAngle = frames[endIndex].faceAngle;
  const dt = (frames[endIndex].timestamp - frames[startIndex].timestamp) / 1000;
  
  if (dt === 0) return 0;
  
  const angleDiff = Math.abs(endAngle.z - startAngle.z);
  return angleDiff / dt;
};

export const smoothFrames = (frames: SwingFrame[], windowSize: number = 3): SwingFrame[] => {
  if (windowSize < 1 || frames.length < windowSize) return frames;
  
  const halfWindow = Math.floor(windowSize / 2);
  
  return frames.map((frame, index) => {
    let sumX = 0, sumY = 0, sumZ = 0;
    let count = 0;
    
    for (let i = Math.max(0, index - halfWindow); i <= Math.min(frames.length - 1, index + halfWindow); i++) {
      sumX += frames[i].position.x;
      sumY += frames[i].position.y;
      sumZ += frames[i].position.z;
      count++;
    }
    
    return {
      ...frame,
      position: {
        x: sumX / count,
        y: sumY / count,
        z: sumZ / count,
      },
    };
  });
};

export const generateSplinePoints = (frames: SwingFrame[], segmentsPerFrame: number = 5): Vector3[] => {
  const points: Vector3[] = [];
  
  for (let i = 0; i < frames.length - 1; i++) {
    const p0 = frames[i].position;
    const p1 = frames[i + 1].position;
    
    for (let t = 0; t < segmentsPerFrame; t++) {
      const alpha = t / segmentsPerFrame;
      points.push(lerpVector(p0, p1, alpha));
    }
  }
  
  if (frames.length > 0) {
    points.push(frames[frames.length - 1].position);
  }
  
  return points;
};

export const toRadians = (degrees: number): number => 
  degrees * (Math.PI / 180);

export const toDegrees = (radians: number): number => 
  radians * (180 / Math.PI);
