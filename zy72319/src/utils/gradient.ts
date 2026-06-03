import type { GradientConfig, GradientPoint } from "../types"

function computeGradient(x: number, y: number, funcType: GradientConfig["funcType"]): [number, number] {
  switch (funcType) {
    case "quadratic":
      return [2 * x, 2 * y]
    case "rosenbrock":
      return [
        -2 * (1 - x) - 400 * x * (y - x * x),
        200 * (y - x * x),
      ]
    case "rastrigin":
      return [
        2 * x + 20 * Math.PI * Math.sin(2 * Math.PI * x),
        2 * y + 20 * Math.PI * Math.sin(2 * Math.PI * y),
      ]
  }
}

export function runGradientDescent(config: GradientConfig): GradientPoint[] {
  const path: GradientPoint[] = [{ x: config.startX, y: config.startY }]
  let cx = config.startX
  let cy = config.startY

  for (let i = 0; i < config.maxSteps; i++) {
    const [gx, gy] = computeGradient(cx, cy, config.funcType)

    const nx = cx - config.learningRate * gx
    const ny = cy - config.learningRate * gy

    if (Math.abs(nx) > 100 || Math.abs(ny) > 100 || !Number.isFinite(nx) || !Number.isFinite(ny)) {
      break
    }

    cx = nx
    cy = ny
    path.push({ x: cx, y: cy })

    const gradMag = Math.sqrt(gx * gx + gy * gy)
    if (gradMag < 1e-8) {
      break
    }
  }

  return path
}
