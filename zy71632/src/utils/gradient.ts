import { compile, derivative, evaluate } from 'mathjs'
import type { SurfaceConfig, GradientPoint } from '@/types'

const h = 1e-6

export function createEvaluator(expression: string): ((x: number, y: number) => number) | null {
  try {
    const compiled = compile(expression)
    return (x: number, y: number) => {
      const result = compiled.evaluate({ x, y })
      return typeof result === 'number' && isFinite(result) ? result : NaN
    }
  } catch {
    return null
  }
}

export function computeGradient(
  evaluator: (x: number, y: number) => number,
  x: number,
  y: number
): { dx: number; dy: number; magnitude: number } {
  const z = evaluator(x, y)
  if (!isFinite(z)) return { dx: 0, dy: 0, magnitude: 0 }

  const fx_plus = evaluator(x + h, y)
  const fx_minus = evaluator(x - h, y)
  const fy_plus = evaluator(x, y + h)
  const fy_minus = evaluator(x, y - h)

  if (!isFinite(fx_plus) || !isFinite(fx_minus) || !isFinite(fy_plus) || !isFinite(fy_minus)) {
    return { dx: 0, dy: 0, magnitude: 0 }
  }

  const dx = (fx_plus - fx_minus) / (2 * h)
  const dy = (fy_plus - fy_minus) / (2 * h)
  const magnitude = Math.sqrt(dx * dx + dy * dy)

  return { dx, dy, magnitude }
}

export function generateSurfaceGrid(
  config: SurfaceConfig
): { positions: Float32Array; indices: Uint32Array; normals: Float32Array } | null {
  const evaluator = createEvaluator(config.expression)
  if (!evaluator) return null

  const { xRange, yRange, resolution } = config
  const res = Math.max(4, Math.min(resolution, 100))
  const xStep = (xRange[1] - xRange[0]) / res
  const yStep = (yRange[1] - yRange[0]) / res

  const vertexCount = (res + 1) * (res + 1)
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)

  let idx = 0
  for (let i = 0; i <= res; i++) {
    for (let j = 0; j <= res; j++) {
      const x = xRange[0] + i * xStep
      const y = yRange[0] + j * yStep
      const z = evaluator(x, y)
      positions[idx] = x
      positions[idx + 1] = y
      positions[idx + 2] = isFinite(z) ? z : 0
      idx += 3
    }
  }

  let nIdx = 0
  for (let i = 0; i <= res; i++) {
    for (let j = 0; j <= res; j++) {
      const x = xRange[0] + i * xStep
      const y = yRange[0] + j * yStep
      const grad = computeGradient(evaluator, x, y)
      const mag = Math.sqrt(grad.dx * grad.dx + grad.dy * grad.dy + 1)
      normals[nIdx] = -grad.dx / mag
      normals[nIdx + 1] = -grad.dy / mag
      normals[nIdx + 2] = 1 / mag
      nIdx += 3
    }
  }

  const indices: number[] = []
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const a = i * (res + 1) + j
      const b = a + 1
      const c = a + (res + 1)
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  return {
    positions,
    indices: new Uint32Array(indices),
    normals,
  }
}

export function generateGradientField(
  config: SurfaceConfig,
  density: number
): GradientPoint[] {
  const evaluator = createEvaluator(config.expression)
  if (!evaluator) return []

  const { xRange, yRange } = config
  const xStep = (xRange[1] - xRange[0]) / density
  const yStep = (yRange[1] - yRange[0]) / density

  const points: GradientPoint[] = []
  for (let i = 0; i <= density; i++) {
    for (let j = 0; j <= density; j++) {
      const x = xRange[0] + i * xStep
      const y = yRange[0] + j * yStep
      const z = evaluator(x, y)
      if (!isFinite(z)) continue
      const grad = computeGradient(evaluator, x, y)
      points.push({ x, y, z, dx: grad.dx, dy: grad.dy, magnitude: grad.magnitude })
    }
  }
  return points
}

export function generateSkiPath(
  config: SurfaceConfig,
  startPoint: [number, number],
  stepSize: number,
  maxSteps: number
): { points: [number, number, number][]; anomalies: { type: 'ARROW_REVERSED' | 'PATH_BOUNDARY' | 'STEP_TOO_LARGE'; stepIndex: number }[] } {
  const evaluator = createEvaluator(config.expression)
  if (!evaluator) return { points: [], anomalies: [] }

  const { xRange, yRange } = config
  const domainWidth = xRange[1] - xRange[0]
  const domainHeight = yRange[1] - yRange[0]
  const maxStep = domainWidth / 5

  const points: [number, number, number][] = []
  const anomalies: { type: 'ARROW_REVERSED' | 'PATH_BOUNDARY' | 'STEP_TOO_LARGE'; stepIndex: number }[] = []

  let cx = startPoint[0]
  let cy = startPoint[1]
  let cz = evaluator(cx, cy)
  if (!isFinite(cz)) cz = 0
  points.push([cx, cy, cz])

  let prevDirX = 0
  let prevDirY = 0

  for (let step = 0; step < maxSteps; step++) {
    const grad = computeGradient(evaluator, cx, cy)

    if (grad.magnitude < 1e-10) break

    const dirX = -grad.dx
    const dirY = -grad.dy

    if (step > 0) {
      const dot = dirX * prevDirX + dirY * prevDirY
      if (dot < 0) {
        anomalies.push({ type: 'ARROW_REVERSED', stepIndex: step })
      }
    }

    if (stepSize > maxStep) {
      anomalies.push({ type: 'STEP_TOO_LARGE', stepIndex: step })
    }

    const nx = cx + dirX * stepSize
    const ny = cy + dirY * stepSize

    if (nx < xRange[0] || nx > xRange[1] || ny < yRange[0] || ny > yRange[1]) {
      anomalies.push({ type: 'PATH_BOUNDARY', stepIndex: step })
      const clampedX = Math.max(xRange[0], Math.min(xRange[1], nx))
      const clampedY = Math.max(yRange[0], Math.min(yRange[1], ny))
      const clampedZ = evaluator(clampedX, clampedY)
      if (isFinite(clampedZ)) {
        points.push([clampedX, clampedY, clampedZ])
      }
      break
    }

    const nz = evaluator(nx, ny)
    cx = nx
    cy = ny
    cz = isFinite(nz) ? nz : cz
    points.push([cx, cy, cz])

    prevDirX = dirX
    prevDirY = dirY
  }

  return { points, anomalies }
}

export function validateExpression(expr: string): boolean {
  try {
    const evaluator = createEvaluator(expr)
    if (!evaluator) return false
    const result = evaluator(0, 0)
    return isFinite(result)
  } catch {
    return false
  }
}
