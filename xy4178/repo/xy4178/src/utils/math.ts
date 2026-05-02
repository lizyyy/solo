import { Vector3D } from '@/types'

export const vec3 = {
  create: (x: number = 0, y: number = 0, z: number = 0): Vector3D => ({ x, y, z }),

  clone: (v: Vector3D): Vector3D => ({ x: v.x, y: v.y, z: v.z }),

  add: (a: Vector3D, b: Vector3D): Vector3D => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  }),

  subtract: (a: Vector3D, b: Vector3D): Vector3D => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  }),

  multiply: (v: Vector3D, scalar: number): Vector3D => ({
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar
  }),

  divide: (v: Vector3D, scalar: number): Vector3D => ({
    x: v.x / scalar,
    y: v.y / scalar,
    z: v.z / scalar
  }),

  distance: (a: Vector3D, b: Vector3D): number => {
    const dx = a.x - b.x
    const dy = a.y - b.y
    const dz = a.z - b.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  },

  distance2D: (a: Vector3D, b: Vector3D): number => {
    const dx = a.x - b.x
    const dz = a.z - b.z
    return Math.sqrt(dx * dx + dz * dz)
  },

  length: (v: Vector3D): number => {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  },

  normalize: (v: Vector3D): Vector3D => {
    const len = vec3.length(v)
    if (len === 0) return { x: 0, y: 0, z: 0 }
    return vec3.divide(v, len)
  },

  dot: (a: Vector3D, b: Vector3D): number => {
    return a.x * b.x + a.y * b.y + a.z * b.z
  },

  cross: (a: Vector3D, b: Vector3D): Vector3D => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }),

  lerp: (a: Vector3D, b: Vector3D, t: number): Vector3D => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  }),

  angle: (a: Vector3D, b: Vector3D): number => {
    const dotProduct = vec3.dot(a, b)
    const lenA = vec3.length(a)
    const lenB = vec3.length(b)
    return Math.acos(dotProduct / (lenA * lenB))
  },

  projectOnPlane: (v: Vector3D, normal: Vector3D): Vector3D => {
    const n = vec3.normalize(normal)
    const dot = vec3.dot(v, n)
    return vec3.subtract(v, vec3.multiply(n, dot))
  }
}

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

export const degToRad = (degrees: number): number => {
  return degrees * (Math.PI / 180)
}

export const radToDeg = (radians: number): number => {
  return radians * (180 / Math.PI)
}

export const interpolateLinear = (t: number, values: number[]): number => {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]
  if (t <= 0) return values[0]
  if (t >= 1) return values[values.length - 1]

  const index = t * (values.length - 1)
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.min(lowerIndex + 1, values.length - 1)
  const localT = index - lowerIndex

  return values[lowerIndex] + (values[upperIndex] - values[lowerIndex]) * localT
}

export const getBoundingBoxCorners = (
  center: Vector3D,
  dimensions: { length: number; width: number; height: number }
): Vector3D[] => {
  const halfLength = dimensions.length / 2
  const halfWidth = dimensions.width / 2
  const halfHeight = dimensions.height / 2

  return [
    { x: center.x - halfLength, y: center.y - halfHeight, z: center.z - halfWidth },
    { x: center.x + halfLength, y: center.y - halfHeight, z: center.z - halfWidth },
    { x: center.x + halfLength, y: center.y - halfHeight, z: center.z + halfWidth },
    { x: center.x - halfLength, y: center.y - halfHeight, z: center.z + halfWidth },
    { x: center.x - halfLength, y: center.y + halfHeight, z: center.z - halfWidth },
    { x: center.x + halfLength, y: center.y + halfHeight, z: center.z - halfWidth },
    { x: center.x + halfLength, y: center.y + halfHeight, z: center.z + halfWidth },
    { x: center.x - halfLength, y: center.y + halfHeight, z: center.z + halfWidth }
  ]
}

export const isPointInBox = (
  point: Vector3D,
  center: Vector3D,
  dimensions: { length: number; width: number; height: number }
): boolean => {
  const halfLength = dimensions.length / 2
  const halfWidth = dimensions.width / 2
  const halfHeight = dimensions.height / 2

  return (
    point.x >= center.x - halfLength &&
    point.x <= center.x + halfLength &&
    point.y >= center.y - halfHeight &&
    point.y <= center.y + halfHeight &&
    point.z >= center.z - halfWidth &&
    point.z <= center.z + halfWidth
  )
}

export const boxBoxIntersection = (
  a: { center: Vector3D; dimensions: { length: number; width: number; height: number } },
  b: { center: Vector3D; dimensions: { length: number; width: number; height: number } },
  margin: number = 0
): boolean => {
  const aHalf = {
    length: a.dimensions.length / 2 + margin,
    width: a.dimensions.width / 2 + margin,
    height: a.dimensions.height / 2 + margin
  }
  const bHalf = {
    length: b.dimensions.length / 2,
    width: b.dimensions.width / 2,
    height: b.dimensions.height / 2
  }

  return (
    Math.abs(a.center.x - b.center.x) < aHalf.length + bHalf.length &&
    Math.abs(a.center.y - b.center.y) < aHalf.height + bHalf.height &&
    Math.abs(a.center.z - b.center.z) < aHalf.width + bHalf.width
  )
}
