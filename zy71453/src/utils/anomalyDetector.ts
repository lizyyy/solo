import type { RobotTrajectory, Shelf, TaskOrder, AnomalyRecord } from './types'

let anomalyCounter = 0
function nextAnomalyId(): string {
  anomalyCounter += 1
  return `ANM-${String(anomalyCounter).padStart(3, '0')}`
}

export function detectPathThroughShelf(
  trajectories: RobotTrajectory[],
  shelves: Shelf[],
): AnomalyRecord[] {
  const results: AnomalyRecord[] = []

  for (const traj of trajectories) {
    if (traj.status === 'withdrawn' || traj.status === 'duplicate') continue
    for (let i = 0; i < traj.points.length - 1; i++) {
      const p1 = traj.points[i]
      const p2 = traj.points[i + 1]
      for (const shelf of shelves) {
        if (lineIntersectsBox(
          { x: p1.x, z: p1.z },
          { x: p2.x, z: p2.z },
          {
            minX: shelf.position[0] - shelf.size[0] / 2,
            maxX: shelf.position[0] + shelf.size[0] / 2,
            minZ: shelf.position[2] - shelf.size[2] / 2,
            maxZ: shelf.position[2] + shelf.size[2] / 2,
          },
        )) {
          results.push({
            id: nextAnomalyId(),
            type: 'path_through_shelf',
            severity: 'critical',
            description: `${traj.robotId} 轨迹穿越货架 ${shelf.id}（${shelf.zoneCode}区）`,
            relatedId: traj.id,
            relatedType: 'trajectory',
            source: { ...traj.source, rawValue: `segment[${i}→${i + 1}] p1=(${p1.x},${p1.z}) p2=(${p2.x},${p2.z})` },
            status: 'pending',
            auditLog: [],
          })
        }
      }
    }
  }

  return results
}

function lineIntersectsBox(
  a: { x: number; z: number },
  b: { x: number; z: number },
  box: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  const steps = 10
  for (let t = 0; t <= steps; t++) {
    const frac = t / steps
    const px = a.x + (b.x - a.x) * frac
    const pz = a.z + (b.z - a.z) * frac
    if (px >= box.minX && px <= box.maxX && pz >= box.minZ && pz <= box.maxZ) {
      return true
    }
  }
  return false
}

export function detectBatteryDrop(
  trajectories: RobotTrajectory[],
  dropThreshold: number,
): AnomalyRecord[] {
  const results: AnomalyRecord[] = []

  for (const traj of trajectories) {
    if (traj.status === 'withdrawn' || traj.status === 'duplicate') continue
    for (let i = 1; i < traj.points.length; i++) {
      const prev = traj.points[i - 1]
      const curr = traj.points[i]
      const drop = prev.batteryLevel - curr.batteryLevel
      if (drop >= dropThreshold) {
        results.push({
          id: nextAnomalyId(),
          type: 'battery_drop',
          severity: drop >= 30 ? 'critical' : 'warning',
          description: `${traj.robotId} 电量突降 ${drop}%（${prev.batteryLevel}%→${curr.batteryLevel}%）`,
          relatedId: traj.id,
          relatedType: 'trajectory',
          source: { ...traj.source, rawValue: `point[${i}] battery: ${prev.batteryLevel}% → ${curr.batteryLevel}%` },
          status: 'pending',
          auditLog: [],
        })
      }
    }
  }

  return results
}

export function detectTimeMisalignment(
  tasks: TaskOrder[],
): AnomalyRecord[] {
  const results: AnomalyRecord[] = []

  for (const task of tasks) {
    if (task.status === 'withdrawn' || task.status === 'duplicate') continue
    if (task.endTime !== undefined && task.endTime < task.startTime) {
      results.push({
        id: nextAnomalyId(),
        type: 'time_misalignment',
        severity: 'critical',
        description: `${task.id}(${task.robotId}) 结束时间早于开始时间`,
        relatedId: task.id,
        relatedType: 'task',
        source: { ...task.source, rawValue: `startTime=${task.startTime}, endTime=${task.endTime}` },
        status: 'pending',
        auditLog: [],
      })
    }
  }

  return results
}

export function detectMissingFields(
  tasks: TaskOrder[],
  trajectories: RobotTrajectory[],
): AnomalyRecord[] {
  const results: AnomalyRecord[] = []

  for (const task of tasks) {
    if (task.status === 'withdrawn' || task.status === 'duplicate') continue
    if (task.missingFields && task.missingFields.length > 0) {
      results.push({
        id: nextAnomalyId(),
        type: 'missing_field',
        severity: 'warning',
        description: `${task.id}(${task.robotId}) 缺少字段: ${task.missingFields.join(', ')}`,
        relatedId: task.id,
        relatedType: 'task',
        source: task.source,
        status: 'pending',
        auditLog: [],
      })
    }
  }

  for (const traj of trajectories) {
    if (traj.status === 'withdrawn' || traj.status === 'duplicate') continue
    const pointsWithoutTask = traj.points.filter((p) => !p.taskId)
    if (pointsWithoutTask.length === traj.points.length) {
      results.push({
        id: nextAnomalyId(),
        type: 'missing_field',
        severity: 'info',
        description: `${traj.robotId} 整条轨迹无任务关联`,
        relatedId: traj.id,
        relatedType: 'trajectory',
        source: traj.source,
        status: 'pending',
        auditLog: [],
      })
    }
  }

  return results
}

export function detectAllAnomalies(
  trajectories: RobotTrajectory[],
  shelves: Shelf[],
  tasks: TaskOrder[],
  batteryDropThreshold: number,
): AnomalyRecord[] {
  anomalyCounter = 0
  return [
    ...detectPathThroughShelf(trajectories, shelves),
    ...detectBatteryDrop(trajectories, batteryDropThreshold),
    ...detectTimeMisalignment(tasks),
    ...detectMissingFields(tasks, trajectories),
  ]
}
