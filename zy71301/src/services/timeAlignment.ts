import type { AccelerationSample, FrameSample, PoseSample, PlayerFeedback } from '../types';

interface AlignedDataPoint {
  timestamp: number;
  acceleration?: AccelerationSample;
  frame?: FrameSample;
  pose?: PoseSample;
}

function linearInterpolate<T>(
  samples: T[],
  targetTime: number,
  getTime: (s: T) => number,
  interpolate: (a: T, b: T, t: number) => T
): T | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return samples[0];

  let left = 0;
  let right = samples.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (getTime(samples[mid]) < targetTime) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (left === 0) return samples[0];
  if (left >= samples.length) return samples[samples.length - 1];

  const before = samples[left - 1];
  const after = samples[left];
  const beforeTime = getTime(before);
  const afterTime = getTime(after);

  if (afterTime === beforeTime) return before;

  const t = (targetTime - beforeTime) / (afterTime - beforeTime);
  return interpolate(before, after, t);
}

function interpolateVector3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number
): { x: number; y: number; z: number } {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function interpolateAcceleration(
  a: AccelerationSample,
  b: AccelerationSample,
  t: number
): AccelerationSample {
  return {
    timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
    linearAccel: interpolateVector3(a.linearAccel, b.linearAccel, t),
    angularVel: interpolateVector3(a.angularVel, b.angularVel, t),
    jerk: interpolateVector3(a.jerk, b.jerk, t),
    magnitude: a.magnitude + (b.magnitude - a.magnitude) * t,
  };
}

function interpolateFrame(a: FrameSample, b: FrameSample, t: number): FrameSample {
  return {
    timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
    fps: Math.round(a.fps + (b.fps - a.fps) * t),
    frameTime: a.frameTime + (b.frameTime - a.frameTime) * t,
    droppedFrames: Math.round(a.droppedFrames + (b.droppedFrames - a.droppedFrames) * t),
  };
}

function interpolatePose(a: PoseSample, b: PoseSample, t: number): PoseSample {
  return {
    timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
    position: interpolateVector3(a.position, b.position, t),
    rotation: {
      pitch: a.rotation.pitch + (b.rotation.pitch - a.rotation.pitch) * t,
      yaw: a.rotation.yaw + (b.rotation.yaw - a.rotation.yaw) * t,
      roll: a.rotation.roll + (b.rotation.roll - a.rotation.roll) * t,
    },
  };
}

export function alignDatasets(
  accelerationData: AccelerationSample[],
  frameData: FrameSample[],
  poseData: PoseSample[],
  targetSampleRate: number = 60
): AlignedDataPoint[] {
  const result: AlignedDataPoint[] = [];

  if (accelerationData.length === 0) return result;

  const startTime = accelerationData[0].timestamp;
  const endTime = accelerationData[accelerationData.length - 1].timestamp;
  const interval = 1 / targetSampleRate;

  for (let t = startTime; t <= endTime; t += interval) {
    const point: AlignedDataPoint = { timestamp: t };

    point.acceleration = linearInterpolate(
      accelerationData,
      t,
      (s) => s.timestamp,
      interpolateAcceleration
    ) || undefined;

    point.frame = linearInterpolate(
      frameData,
      t,
      (s) => s.timestamp,
      interpolateFrame
    ) || undefined;

    point.pose = linearInterpolate(
      poseData,
      t,
      (s) => s.timestamp,
      interpolatePose
    ) || undefined;

    result.push(point);
  }

  return result;
}

export function applyFeedbackOffsets(
  feedbacks: PlayerFeedback[]
): PlayerFeedback[] {
  return feedbacks.map((fb) => ({
    ...fb,
    timestamp: fb.timestamp + fb.syncOffset,
  }));
}

export function findNearestSample<T>(
  samples: T[],
  targetTime: number,
  getTime: (s: T) => number,
  maxDistance: number = 0.1
): T | null {
  if (samples.length === 0) return null;

  let nearest = samples[0];
  let minDist = Math.abs(getTime(nearest) - targetTime);

  for (let i = 1; i < samples.length; i++) {
    const dist = Math.abs(getTime(samples[i]) - targetTime);
    if (dist < minDist) {
      minDist = dist;
      nearest = samples[i];
    }
  }

  return minDist <= maxDistance ? nearest : null;
}
