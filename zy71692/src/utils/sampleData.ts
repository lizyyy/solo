import type { Frame, MotionClip, Vec3, AngleResult, AnomalyLogEntry } from '@/types'
import { DEFAULT_SKELETON } from '@/types'
import { computeAllAngles } from './angle'
import { detectMisconnections, detectAngleJumps, markAngleAnomalies } from './anomaly'

function generateSquatFrames(count: number): Frame[] {
  const frames: Frame[] = []
  for (let i = 0; i < count; i++) {
    const t = i / count
    const squatDepth = Math.sin(t * Math.PI * 2) * 0.3
    const forwardLean = Math.sin(t * Math.PI * 2) * 0.15
    const jitter = () => (Math.random() - 0.5) * 0.005

    const baseJoints: Record<string, Vec3> = {
      head: { x: jitter(), y: 1.75 - squatDepth * 0.3, z: -forwardLean * 0.5 + jitter() },
      neck: { x: jitter(), y: 1.6 - squatDepth * 0.25, z: -forwardLean * 0.3 + jitter() },
      leftShoulder: { x: -0.2 + jitter(), y: 1.55 - squatDepth * 0.2, z: -forwardLean * 0.2 + jitter() },
      rightShoulder: { x: 0.2 + jitter(), y: 1.55 - squatDepth * 0.2, z: -forwardLean * 0.2 + jitter() },
      leftElbow: { x: -0.35 + jitter(), y: 1.35 - squatDepth * 0.15, z: -forwardLean * 0.1 + jitter() },
      rightElbow: { x: 0.35 + jitter(), y: 1.35 - squatDepth * 0.15, z: -forwardLean * 0.1 + jitter() },
      leftWrist: { x: -0.4 + jitter(), y: 1.2 - squatDepth * 0.1, z: jitter() },
      rightWrist: { x: 0.4 + jitter(), y: 1.2 - squatDepth * 0.1, z: jitter() },
      spine: { x: jitter(), y: 1.3 - squatDepth * 0.2, z: -forwardLean * 0.15 + jitter() },
      hip: { x: jitter(), y: 1.0 - squatDepth * 0.5, z: -forwardLean * 0.1 + jitter() },
      leftHip: { x: -0.15 + jitter(), y: 0.95 - squatDepth * 0.5, z: -forwardLean * 0.1 + jitter() },
      rightHip: { x: 0.15 + jitter(), y: 0.95 - squatDepth * 0.5, z: -forwardLean * 0.1 + jitter() },
      leftKnee: { x: -0.18 + jitter(), y: 0.55 - squatDepth * 0.15, z: squatDepth * 0.3 + jitter() },
      rightKnee: { x: 0.18 + jitter(), y: 0.55 - squatDepth * 0.15, z: squatDepth * 0.3 + jitter() },
      leftAnkle: { x: -0.18 + jitter(), y: 0.08, z: squatDepth * 0.15 + jitter() },
      rightAnkle: { x: 0.18 + jitter(), y: 0.08, z: squatDepth * 0.15 + jitter() },
    }

    if (i === Math.floor(count * 0.4)) {
      baseJoints.leftKnee = { x: -0.18, y: 0.55, z: 0.8 }
    }
    if (i === Math.floor(count * 0.7)) {
      baseJoints.rightHip = { x: 0.15, y: 0.5, z: -0.3 }
    }

    frames.push({
      frameIndex: i,
      timestamp: i / 30,
      joints: baseJoints,
    })
  }
  return frames
}

export function generateSampleData(): { clip: MotionClip; projectId: string } {
  const projectId = 'demo-project-001'
  const clipId = 'demo-clip-001'
  const frames = generateSquatFrames(120)
  const angleResults = computeAllAngles(frames, DEFAULT_SKELETON.angleJoints)
  const misconnectAnomalies = detectMisconnections(frames, DEFAULT_SKELETON, 2)
  const jumpAnomalies = detectAngleJumps(angleResults, 15)
  const allAnomalies = [...misconnectAnomalies, ...jumpAnomalies]
  const markedAngles = markAngleAnomalies(angleResults, jumpAnomalies)

  const clip: MotionClip = {
    id: clipId,
    projectId,
    studentId: 'student-001',
    name: '深蹲动作示范',
    startFrame: 0,
    endFrame: 119,
    frames,
    angleResults: markedAngles,
    anomalyLog: allAnomalies,
  }

  return { clip, projectId }
}
