import { useMemo } from 'react'
import { Vector3 } from 'three'
import { Line } from '@react-three/drei'
import { ThreeEvent } from '@react-three/fiber'
import type { VisitorPath, PathPoint } from '@/types'
import { useExhibitionStore } from '@/store/useExhibitionStore'

interface PathLineProps {
  path: VisitorPath
  isConflict: boolean
  isSelected: boolean
  currentTime: number
}

function interpolatePosition(points: PathPoint[], time: number): Vector3 {
  if (points.length === 0) return new Vector3(0, 0, 0)
  if (points.length === 1) return new Vector3(points[0].x, points[0].y, points[0].z)

  const totalDuration = points[points.length - 1].time
  const clampedTime = ((time % totalDuration) + totalDuration) % totalDuration

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    if (clampedTime >= p0.time && clampedTime <= p1.time) {
      const t = (clampedTime - p0.time) / (p1.time - p0.time)
      return new Vector3(
        p0.x + (p1.x - p0.x) * t,
        p0.y + (p1.y - p0.y) * t,
        p0.z + (p1.z - p0.z) * t
      )
    }
  }

  const last = points[points.length - 1]
  return new Vector3(last.x, last.y, last.z)
}

function findBackflowSegments(points: PathPoint[]): number[] {
  const segments: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      const dx = points[j + 1].x - points[j].x
      const dz = points[j + 1].z - points[j].z
      const prevDx = points[i + 1].x - points[i].x
      const prevDz = points[i + 1].z - points[i].z
      const dot = dx * prevDx + dz * prevDz
      const lenA = Math.sqrt(dx * dx + dz * dz)
      const lenB = Math.sqrt(prevDx * prevDx + prevDz * prevDz)
      if (lenA > 0 && lenB > 0 && dot / (lenA * lenB) < -0.5) {
        if (!segments.includes(j)) segments.push(j)
      }
    }
  }
  return segments
}

export default function PathLine({ path, isConflict, isSelected, currentTime }: PathLineProps) {
  const selectObject = useExhibitionStore((s) => s.selectObject)

  const linePoints = useMemo(() => {
    return path.points.map((p) => new Vector3(p.x, p.y, p.z))
  }, [path.points])

  const backflowIndices = useMemo(() => {
    if (!isConflict) return []
    return findBackflowSegments(path.points)
  }, [isConflict, path.points])

  const visitorPos = useMemo(() => {
    return interpolatePosition(path.points, currentTime)
  }, [path.points, currentTime])

  const baseColor = isConflict ? '#ef4444' : '#3b82f6'
  const lineWidth = isSelected ? 3 : 1.5

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    selectObject(path.id, 'path')
  }

  return (
    <group onClick={handleClick}>
      <Line
        points={linePoints}
        color={baseColor}
        lineWidth={lineWidth}
      />

      {backflowIndices.map((idx) => {
        if (idx >= path.points.length - 1) return null
        const p0 = path.points[idx]
        const p1 = path.points[idx + 1]
        return (
          <Line
            key={`backflow-${idx}`}
            points={[new Vector3(p0.x, p0.y, p0.z), new Vector3(p1.x, p1.y, p1.z)]}
            color="#ef4444"
            lineWidth={4}
          />
        )
      })}

      <mesh position={visitorPos}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>
    </group>
  )
}
