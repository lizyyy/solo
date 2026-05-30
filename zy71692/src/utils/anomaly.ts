import type { Frame, AngleResult, AnomalyLogEntry, SkeletonDefinition, Vec3 } from '@/types'
import { vec3Distance, vec3Sub } from './angle'

export function detectMisconnections(
  frames: Frame[],
  skeletonDefinition: SkeletonDefinition,
  sigmaThreshold: number = 2
): AnomalyLogEntry[] {
  const anomalies: AnomalyLogEntry[] = []
  const boneLengths: Record<string, number[]> = {}

  for (const frame of frames) {
    for (const [from, to] of skeletonDefinition.bones) {
      const jFrom = frame.joints[from]
      const jTo = frame.joints[to]
      if (!jFrom || !jTo) continue
      const dist = vec3Distance(jFrom, jTo)
      const key = `${from}-${to}`
      if (!boneLengths[key]) boneLengths[key] = []
      boneLengths[key].push(dist)
    }
  }

  const boneStats: Record<string, { mean: number; std: number }> = {}
  for (const [key, lengths] of Object.entries(boneLengths)) {
    const mean = lengths.reduce((s, v) => s + v, 0) / lengths.length
    const variance = lengths.reduce((s, v) => s + (v - mean) ** 2, 0) / lengths.length
    boneStats[key] = { mean, std: Math.sqrt(variance) }
  }

  for (const frame of frames) {
    for (const [from, to] of skeletonDefinition.bones) {
      const jFrom = frame.joints[from]
      const jTo = frame.joints[to]
      if (!jFrom || !jTo) continue
      const dist = vec3Distance(jFrom, jTo)
      const key = `${from}-${to}`
      const stats = boneStats[key]
      if (!stats || stats.std === 0) continue
      const zScore = Math.abs(dist - stats.mean) / stats.std
      if (zScore > sigmaThreshold) {
        anomalies.push({
          frameIndex: frame.frameIndex,
          jointName: `${from}-${to}`,
          type: 'misconnect',
          detail: `骨骼${key}长度${dist.toFixed(2)}偏离均值${stats.mean.toFixed(2)}，z=${zScore.toFixed(2)}`
        })
      }
    }
  }

  return anomalies
}

export function detectAngleJumps(
  angleResults: AngleResult[],
  threshold: number = 15
): AnomalyLogEntry[] {
  const anomalies: AnomalyLogEntry[] = []
  const byJoint: Record<string, AngleResult[]> = {}

  for (const ar of angleResults) {
    if (!byJoint[ar.jointName]) byJoint[ar.jointName] = []
    byJoint[ar.jointName].push(ar)
  }

  for (const [jointName, results] of Object.entries(byJoint)) {
    const sorted = results.sort((a, b) => a.frameIndex - b.frameIndex)
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i].angle - sorted[i - 1].angle)
      if (diff > threshold) {
        anomalies.push({
          frameIndex: sorted[i].frameIndex,
          jointName,
          type: 'jump',
          detail: `${jointName}角度跳变${diff.toFixed(1)}°（${sorted[i - 1].angle.toFixed(1)}° → ${sorted[i].angle.toFixed(1)}°）`
        })
      }
    }
  }

  return anomalies
}

export function interpolateFrame(
  prevFrame: Frame,
  nextFrame: Frame,
  skeletonDefinition: SkeletonDefinition
): Record<string, Vec3> {
  const interpolated: Record<string, Vec3> = {}
  for (const joint of skeletonDefinition.joints) {
    const p = prevFrame.joints[joint]
    const n = nextFrame.joints[joint]
    if (p && n) {
      interpolated[joint] = {
        x: (p.x + n.x) / 2,
        y: (p.y + n.y) / 2,
        z: (p.z + n.z) / 2,
      }
    } else if (p) {
      interpolated[joint] = { ...p }
    } else if (n) {
      interpolated[joint] = { ...n }
    }
  }
  return interpolated
}

export function markAngleAnomalies(
  angleResults: AngleResult[],
  anomalies: AnomalyLogEntry[]
): AngleResult[] {
  const anomalyFrameJoints = new Set<string>()
  for (const a of anomalies) {
    if (a.type === 'jump') {
      anomalyFrameJoints.add(`${a.frameIndex}-${a.jointName}`)
    }
  }
  return angleResults.map((ar) => ({
    ...ar,
    isAnomaly: anomalyFrameJoints.has(`${ar.frameIndex}-${ar.jointName}`),
  }))
}
