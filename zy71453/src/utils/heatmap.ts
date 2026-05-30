import type { RobotTrajectory, Shelf } from './types'

export interface HeatmapCell {
  x: number
  z: number
  count: number
  intensity: number
}

export function computeHeatmap(
  trajectories: RobotTrajectory[],
  _shelves: Shelf[],
  gridSize: number,
  threshold: number,
): HeatmapCell[] {
  const cells: Map<string, HeatmapCell> = new Map()

  const activeTrajectories = trajectories.filter(
    (t) => t.status !== 'withdrawn' && t.status !== 'duplicate',
  )

  for (const traj of activeTrajectories) {
    for (const point of traj.points) {
      const cellX = Math.floor(point.x / gridSize) * gridSize
      const cellZ = Math.floor(point.z / gridSize) * gridSize
      const key = `${cellX},${cellZ}`
      const cell = cells.get(key)
      if (cell) {
        cell.count += 1
      } else {
        cells.set(key, { x: cellX, z: cellZ, count: 1, intensity: 0 })
      }
    }
  }

  const cellArray = Array.from(cells.values())
  const maxCount = Math.max(...cellArray.map((c) => c.count), 1)

  for (const cell of cellArray) {
    cell.intensity = cell.count / maxCount
  }

  return cellArray.filter((c) => c.intensity >= threshold)
}

export function heatmapColor(intensity: number): [number, number, number] {
  if (intensity < 0.25) return [0.0, 0.4, 1.0]
  if (intensity < 0.5) return [0.0, 0.9, 0.6]
  if (intensity < 0.75) return [1.0, 0.8, 0.0]
  return [1.0, 0.2, 0.0]
}
