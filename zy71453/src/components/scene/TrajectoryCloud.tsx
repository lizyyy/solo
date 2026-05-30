import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useStore } from '../../store/useStore'

const STATUS_COLORS: Record<string, string> = {
  normal: '#00f0ff',
  supplementary: '#a855f7',
  withdrawn: '#6b7280',
  duplicate: '#f59e0b',
}

export default function TrajectoryCloud() {
  const trajectories = useStore((s) => s.trajectories)
  const filterState = useStore((s) => s.filterState)
  const replayProgress = useStore((s) => s.replayProgress)
  const selectedTrajectoryId = useStore((s) => s.selectedTrajectoryId)

  const filtered = useMemo(
    () =>
      trajectories.filter((t) => {
        if (!filterState.statusFilter.includes(t.status)) return false
        if (filterState.robotIds.length > 0 && !filterState.robotIds.includes(t.robotId))
          return false
        return true
      }),
    [trajectories, filterState],
  )

  return (
    <group>
      {filtered.map((traj) => (
        <TrajectoryLine
          key={traj.id}
          trajectory={traj}
          isSelected={traj.id === selectedTrajectoryId}
          replayProgress={replayProgress}
        />
      ))}
    </group>
  )
}

function TrajectoryLine({
  trajectory,
  isSelected,
  replayProgress,
}: {
  trajectory: { id: string; points: { x: number; y: number; z: number }[]; status: string }
  isSelected: boolean
  replayProgress: number
}) {
  const points = useMemo(
    () => trajectory.points.map((p) => [p.x, 0.5, p.z] as [number, number, number]),
    [trajectory.points],
  )

  const color = STATUS_COLORS[trajectory.status] || '#00f0ff'
  const lineWidth = isSelected ? 3 : 1.5
  const opacity = trajectory.status === 'duplicate' ? 0.5 : isSelected ? 1 : 0.8

  const replayPoint = useMemo(() => {
    if (replayProgress <= 0 || replayProgress > 1 || points.length < 2) return null
    const totalLength = points.length - 1
    const idx = Math.min(Math.floor(replayProgress * totalLength), totalLength - 1)
    const frac = replayProgress * totalLength - idx
    const p0 = points[idx]
    const p1 = points[idx + 1]
    return [
      p0[0] + (p1[0] - p0[0]) * frac,
      0.5,
      p0[2] + (p1[2] - p0[2]) * frac,
    ] as [number, number, number]
  }, [replayProgress, points])

  const isWithdrawn = trajectory.status === 'withdrawn'

  return (
    <group>
      {isWithdrawn ? (
        <Line
          points={points}
          color={color}
          lineWidth={lineWidth}
          dashed
          dashSize={0.5}
          gapSize={0.3}
          transparent
          opacity={opacity}
        />
      ) : (
        <Line
          points={points}
          color={color}
          lineWidth={lineWidth}
          transparent
          opacity={opacity}
        />
      )}
      {isSelected && (
        <Line
          points={points}
          color={color}
          lineWidth={lineWidth + 2}
          transparent
          opacity={0.3}
        />
      )}
      {replayPoint && (
        <mesh position={replayPoint}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}
