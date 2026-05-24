import type { SceneData, Conflict, SignalPhase, VehicleTrajectory, PedestrianTrajectory } from '../types'

export function detectConflicts(data: SceneData): Conflict[] {
  const conflicts: Conflict[] = []

  conflicts.push(...detectPhaseOffsets(data.signalPhases))
  conflicts.push(...detectPedestrianConflicts(data.vehicles, data.pedestrians))
  conflicts.push(...detectTrajectoryAsync(data.vehicles, data.pedestrians))

  return conflicts.sort((a, b) => a.time - b.time)
}

function detectPhaseOffsets(phases: SignalPhase[]): Conflict[] {
  const conflicts: Conflict[] = []

  phases.forEach((phase) => {
    phase.timing.forEach((timing, index) => {
      if (index > 0) {
        const prevTiming = phase.timing[index - 1]
        const gap = timing.startTime - prevTiming.endTime
        if (gap > 1) {
          conflicts.push({
            id: `phase-offset-${phase.id}-${index}`,
            time: prevTiming.endTime,
            type: 'phase_offset',
            description: `${phase.name}信号灯存在${gap.toFixed(1)}秒相位间隙`,
            severity: gap > 3 ? 'high' : 'medium',
            x: 0,
            y: 0,
            involvedElements: [phase.id],
          })
        }
      }
    })
  })

  return conflicts
}

function detectPedestrianConflicts(
  vehicles: VehicleTrajectory[],
  pedestrians: PedestrianTrajectory[]
): Conflict[] {
  const conflicts: Conflict[] = []
  const distanceThreshold = 3
  const timeThreshold = 2

  pedestrians.forEach((ped) => {
    vehicles.forEach((veh) => {
      ped.points.forEach((pedPoint) => {
        veh.points.forEach((vehPoint) => {
          const timeDiff = Math.abs(pedPoint.time - vehPoint.time)
          if (timeDiff < timeThreshold) {
            const distance = Math.sqrt(
              Math.pow(pedPoint.x - vehPoint.x, 2) + Math.pow(pedPoint.y - vehPoint.y, 2)
            )
            if (distance < distanceThreshold) {
              const exists = conflicts.some(
                (c) =>
                  c.type === 'pedestrian_conflict' &&
                  c.involvedElements?.includes(ped.id) &&
                  c.involvedElements?.includes(veh.id)
              )
              if (!exists) {
                conflicts.push({
                  id: `ped-conflict-${ped.id}-${veh.id}`,
                  time: Math.min(pedPoint.time, vehPoint.time),
                  type: 'pedestrian_conflict',
                  description: `${ped.name || ped.id}与${veh.plateNumber || veh.id}存在潜在冲突风险`,
                  severity: distance < 2 ? 'high' : 'medium',
                  x: (pedPoint.x + vehPoint.x) / 2,
                  y: (pedPoint.y + vehPoint.y) / 2,
                  involvedElements: [ped.id, veh.id],
                })
              }
            }
          }
        })
      })
    })
  })

  return conflicts
}

function detectTrajectoryAsync(
  vehicles: VehicleTrajectory[],
  pedestrians: PedestrianTrajectory[]
): Conflict[] {
  const conflicts: Conflict[] = []
  const maxTimeGap = 5

  vehicles.forEach((veh) => {
    for (let i = 1; i < veh.points.length; i++) {
      const timeGap = veh.points[i].time - veh.points[i - 1].time
      if (timeGap > maxTimeGap) {
        conflicts.push({
          id: `traj-async-${veh.id}-${i}`,
          time: veh.points[i - 1].time,
          type: 'trajectory_async',
          description: `车辆${veh.plateNumber || veh.id}轨迹数据存在${timeGap.toFixed(1)}秒时间间隔`,
          severity: timeGap > 8 ? 'high' : timeGap > 6 ? 'medium' : 'low',
          x: veh.points[i - 1].x,
          y: veh.points[i - 1].y,
          involvedElements: [veh.id],
        })
      }
    }
  })

  pedestrians.forEach((ped) => {
    for (let i = 1; i < ped.points.length; i++) {
      const timeGap = ped.points[i].time - ped.points[i - 1].time
      if (timeGap > maxTimeGap) {
        conflicts.push({
          id: `traj-async-${ped.id}-${i}`,
          time: ped.points[i - 1].time,
          type: 'trajectory_async',
          description: `行人${ped.name || ped.id}轨迹数据存在${timeGap.toFixed(1)}秒时间间隔`,
          severity: timeGap > 8 ? 'high' : timeGap > 6 ? 'medium' : 'low',
          x: ped.points[i - 1].x,
          y: ped.points[i - 1].y,
          involvedElements: [ped.id],
        })
      }
    }
  })

  return conflicts
}

export function getLightStateAtTime(
  phase: SignalPhase,
  time: number
): 'red' | 'yellow' | 'green' {
  const timing = phase.timing.find((t) => time >= t.startTime && time < t.endTime)
  return timing?.state || 'red'
}

export function getPositionAtTime<T extends { time: number; x: number; y: number; angle?: number }>(
  points: T[],
  time: number
): { x: number; y: number; angle: number } | null {
  if (points.length === 0) return null

  if (time <= points[0].time) {
    return { x: points[0].x, y: points[0].y, angle: points[0].angle || 0 }
  }
  if (time >= points[points.length - 1].time) {
    return null
  }

  for (let i = 1; i < points.length; i++) {
    if (time < points[i].time) {
      const prev = points[i - 1]
      const next = points[i]
      const t = (time - prev.time) / (next.time - prev.time)
      return {
        x: prev.x + (next.x - prev.x) * t,
        y: prev.y + (next.y - prev.y) * t,
        angle: prev.angle ?? (next.angle ?? 0),
      }
    }
  }

  return null
}
