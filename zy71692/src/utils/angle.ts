import type { Vec3, AngleJointDef, AngleResult, Frame } from '@/types'

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

export function vec3Distance(a: Vec3, b: Vec3): number {
  return vec3Length(vec3Sub(a, b))
}

export function calculateAngle(from: Vec3, center: Vec3, to: Vec3): number {
  const v1 = vec3Sub(from, center)
  const v2 = vec3Sub(to, center)
  const dot = vec3Dot(v1, v2)
  const len1 = vec3Length(v1)
  const len2 = vec3Length(v2)
  if (len1 === 0 || len2 === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)))
  return Math.acos(cosAngle) * (180 / Math.PI)
}

export function computeAnglesForFrame(
  frame: Frame,
  angleJoints: AngleJointDef[]
): AngleResult[] {
  return angleJoints.map((def) => {
    const from = frame.joints[def.from]
    const center = frame.joints[def.center]
    const to = frame.joints[def.to]
    if (!from || !center || !to) {
      return { jointName: def.name, frameIndex: frame.frameIndex, angle: 0, isAnomaly: false }
    }
    const angle = calculateAngle(from, center, to)
    return { jointName: def.name, frameIndex: frame.frameIndex, angle, isAnomaly: false }
  })
}

export function computeAllAngles(
  frames: Frame[],
  angleJoints: AngleJointDef[]
): AngleResult[] {
  return frames.flatMap((f) => computeAnglesForFrame(f, angleJoints))
}
