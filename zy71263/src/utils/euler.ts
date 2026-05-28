import type { Quaternion, EulerAngles } from '@/types';
import { quatNormalize } from './quaternion';

export function eulerToQuaternion(euler: EulerAngles): Quaternion {
  const roll = euler.roll;
  const pitch = euler.pitch;
  const yaw = euler.yaw;

  const cr = Math.cos(roll / 2);
  const sr = Math.sin(roll / 2);
  const cp = Math.cos(pitch / 2);
  const sp = Math.sin(pitch / 2);
  const cy = Math.cos(yaw / 2);
  const sy = Math.sin(yaw / 2);

  let q: Quaternion;

  if (euler.sequence === 'ZYX') {
    q = {
      w: cr * cp * cy + sr * sp * sy,
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy - sr * sp * cy,
      source: 'computed',
    };
  } else if (euler.sequence === 'XYZ') {
    q = {
      w: cr * cp * cy - sr * sp * sy,
      x: sr * cp * cy + cr * sp * sy,
      y: cr * sp * cy - sr * cp * sy,
      z: cr * cp * sy + sr * sp * cy,
      source: 'computed',
    };
  } else {
    q = {
      w: cr * cp * cy - sr * sp * sy,
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy + sr * sp * cy,
      source: 'computed',
    };
  }

  return quatNormalize(q);
}

export function quaternionToEuler(q: Quaternion, sequence: EulerAngles['sequence'] = 'ZYX'): EulerAngles {
  const nq = quatNormalize(q);

  let roll: number, pitch: number, yaw: number;

  if (sequence === 'ZYX') {
    const sinp = 2 * (nq.w * nq.y - nq.z * nq.x);
    if (Math.abs(sinp) >= 1) {
      pitch = (Math.sign(sinp) * Math.PI) / 2;
    } else {
      pitch = Math.asin(sinp);
    }

    const sinr_cosp = 2 * (nq.w * nq.x + nq.y * nq.z);
    const cosr_cosp = 1 - 2 * (nq.x * nq.x + nq.y * nq.y);
    roll = Math.atan2(sinr_cosp, cosr_cosp);

    const siny_cosp = 2 * (nq.w * nq.z + nq.x * nq.y);
    const cosy_cosp = 1 - 2 * (nq.y * nq.y + nq.z * nq.z);
    yaw = Math.atan2(siny_cosp, cosy_cosp);
  } else if (sequence === 'XYZ') {
    const sinp = 2 * (nq.w * nq.x - nq.y * nq.z);
    if (Math.abs(sinp) >= 1) {
      pitch = (Math.sign(sinp) * Math.PI) / 2;
    } else {
      pitch = Math.asin(sinp);
    }

    const sinr_cosp = 2 * (nq.w * nq.y + nq.x * nq.z);
    const cosr_cosp = 1 - 2 * (nq.y * nq.y + nq.z * nq.z);
    roll = Math.atan2(sinr_cosp, cosr_cosp);

    const siny_cosp = 2 * (nq.w * nq.z + nq.x * nq.y);
    const cosy_cosp = 1 - 2 * (nq.x * nq.x + nq.z * nq.z);
    yaw = Math.atan2(siny_cosp, cosy_cosp);
  } else {
    const sinp = 2 * (nq.w * nq.z - nq.x * nq.y);
    if (Math.abs(sinp) >= 1) {
      pitch = (Math.sign(sinp) * Math.PI) / 2;
    } else {
      pitch = Math.asin(sinp);
    }

    const sinr_cosp = 2 * (nq.w * nq.x + nq.y * nq.z);
    const cosr_cosp = 1 - 2 * (nq.x * nq.x + nq.y * nq.y);
    roll = Math.atan2(sinr_cosp, cosr_cosp);

    const siny_cosp = 2 * (nq.w * nq.y + nq.x * nq.z);
    const cosy_cosp = 1 - 2 * (nq.x * nq.x + nq.z * nq.z);
    yaw = Math.atan2(siny_cosp, cosy_cosp);
  }

  return { roll, pitch, yaw, sequence, source: 'computed' };
}

export function isGimbalLock(euler: EulerAngles, delta = 0.1): boolean {
  if (euler.sequence === 'ZYX') {
    return Math.abs(euler.pitch - Math.PI / 2) < delta || Math.abs(euler.pitch + Math.PI / 2) < delta;
  }
  if (euler.sequence === 'XYZ') {
    return Math.abs(euler.roll - Math.PI / 2) < delta || Math.abs(euler.roll + Math.PI / 2) < delta;
  }
  return Math.abs(euler.yaw - Math.PI / 2) < delta || Math.abs(euler.yaw + Math.PI / 2) < delta;
}
