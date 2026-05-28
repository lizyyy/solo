import { useMemo } from 'react'
import * as THREE from 'three'
import type { Trajectory } from '@/types'

interface TrajectoryLineProps {
  trajectory: Trajectory
  selected: boolean
  currentTime: number
  color?: string
}

export function TrajectoryLine({ trajectory, selected, currentTime, color = '#00d4ff' }: TrajectoryLineProps) {
  const { linePoints, tubeGeometry, progressPoint } = useMemo(() => {
    if (!trajectory.waypoints || trajectory.waypoints.length < 2) {
      return { linePoints: null, tubeGeometry: null, progressPoint: null }
    }

    const sorted = [...trajectory.waypoints].sort((a, b) => a.time - b.time)
    const curvePoints = sorted.map(
      (wp) => new THREE.Vector3(wp.x, wp.y + 0.1, wp.z)
    )

    const curve = new THREE.CatmullRomCurve3(curvePoints)
    const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.03, 8, false)

    const linePoints = curvePoints.map((p) => [p.x, p.y, p.z] as [number, number, number])

    const totalTime = sorted[sorted.length - 1].time - sorted[0].time
    const progress = Math.max(0, Math.min(1, (currentTime - sorted[0].time) / totalTime))
    const progressPos = curve.getPointAt(progress)
    const progressPoint = progressPos ? ([progressPos.x, progressPos.y, progressPos.z] as [number, number, number]) : null

    return { linePoints, tubeGeometry, progressPoint }
  }, [trajectory.waypoints, currentTime])

  if (!linePoints || linePoints.length < 2) return null

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.9 : 0.5}
        />
      </mesh>

      {progressPoint && (
        <>
          <mesh position={progressPoint}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={progressPoint}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
          </mesh>
        </>
      )}

      {linePoints.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}
