import type { Vector3, TimelineKeyframe } from '@/types';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function distance3D(a: Vector3, b: Vector3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function vector3Lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function interpolateKeyframes(
  keyframes: TimelineKeyframe[],
  time: number
): Vector3 & { rotation: number } {
  if (keyframes.length === 0) {
    return { x: 0, y: 0, z: 0, rotation: 0 };
  }

  if (keyframes.length === 1) {
    return {
      ...keyframes[0].position,
      rotation: keyframes[0].rotation || 0,
    };
  }

  if (time <= keyframes[0].time) {
    return {
      ...keyframes[0].position,
      rotation: keyframes[0].rotation || 0,
    };
  }

  if (time >= keyframes[keyframes.length - 1].time) {
    const last = keyframes[keyframes.length - 1];
    return {
      ...last.position,
      rotation: last.rotation || 0,
    };
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];

    if (time >= k1.time && time <= k2.time) {
      const t = (time - k1.time) / (k2.time - k1.time);
      const position = vector3Lerp(k1.position, k2.position, t);
      const rotation = lerp(k1.rotation || 0, k2.rotation || 0, t);
      return { ...position, rotation };
    }
  }

  const last = keyframes[keyframes.length - 1];
  return { ...last.position, rotation: last.rotation || 0 };
}

export function interpolateSimpleKeyframes<T extends { time: number }>(
  keyframes: T[],
  time: number,
  valueKey: keyof Omit<T, 'time' | 'note'>
): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0][valueKey] as number;
  if (time <= keyframes[0].time) return keyframes[0][valueKey] as number;
  if (time >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1][valueKey] as number;
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];

    if (time >= k1.time && time <= k2.time) {
      const t = (time - k1.time) / (k2.time - k1.time);
      return lerp(k1[valueKey] as number, k2[valueKey] as number, t);
    }
  }

  return keyframes[keyframes.length - 1][valueKey] as number;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
