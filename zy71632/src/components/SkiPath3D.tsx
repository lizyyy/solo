import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { SkiPath } from '@/types'

interface SkiPath3DProps {
  path: SkiPath
  isReplaying: boolean
  replayProgress: number
}

const START_COLOR = new THREE.Color('#66bb6a')
const END_COLOR = new THREE.Color('#e8eaf6')

function toThree(p: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(p[0], p[2], p[1])
}

export default function SkiPath3D({ path, isReplaying, replayProgress }: SkiPath3DProps) {
  const skierRef = useRef<THREE.Mesh>(null)
  const skierLightRef = useRef<THREE.PointLight>(null)
  const progressRef = useRef(replayProgress)

  useFrame(() => {
    if (isReplaying) {
      progressRef.current = replayProgress
      const points = path.points
      if (points.length < 2 || !skierRef.current) return

      const totalSegments = points.length - 1
      const currentSegment = progressRef.current * totalSegments
      const segIndex = Math.min(Math.floor(currentSegment), totalSegments - 1)
      const segFraction = currentSegment - segIndex

      const p1 = toThree(points[segIndex])
      const p2 = toThree(points[Math.min(segIndex + 1, points.length - 1)])
      const pos = p1.lerp(p2, segFraction)

      skierRef.current.position.copy(pos)
      if (skierLightRef.current) {
        skierLightRef.current.position.copy(pos)
      }
    }
  })

  const { visiblePoints, vertexColors } = useMemo(() => {
    const points = path.points
    if (points.length < 2) {
      return {
        visiblePoints: [toThree(points[0])] as THREE.Vector3[],
        vertexColors: [START_COLOR] as THREE.Color[],
      }
    }

    if (!isReplaying) {
      const pts = points.map((p) => toThree(p))
      const colors = points.map((_, i) => {
        const t = i / (points.length - 1)
        return START_COLOR.clone().lerp(END_COLOR, t)
      })
      return { visiblePoints: pts, vertexColors: colors }
    }

    const totalSegments = points.length - 1
    const currentSegment = replayProgress * totalSegments
    const segIndex = Math.min(Math.floor(currentSegment), totalSegments - 1)
    const segFraction = currentSegment - segIndex

    const pts: THREE.Vector3[] = []
    const colors: THREE.Color[] = []

    for (let i = 0; i <= segIndex; i++) {
      pts.push(toThree(points[i]))
      const t = i / totalSegments
      colors.push(START_COLOR.clone().lerp(END_COLOR, t))
    }

    if (segFraction > 0 && segIndex < totalSegments) {
      const p1 = toThree(points[segIndex])
      const p2 = toThree(points[segIndex + 1])
      const interp = p1.clone().lerp(p2, segFraction)
      pts.push(interp)
      const t = currentSegment / totalSegments
      colors.push(START_COLOR.clone().lerp(END_COLOR, t))
    }

    return { visiblePoints: pts, vertexColors: colors }
  }, [path.points, isReplaying, replayProgress])

  if (path.points.length < 2) return null

  const startPoint = toThree(path.points[0])
  const endPoint = toThree(path.points[path.points.length - 1])

  return (
    <group>
      <Line points={visiblePoints} vertexColors={vertexColors} lineWidth={3} />

      <mesh position={startPoint}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#66bb6a" emissive="#66bb6a" emissiveIntensity={2} />
      </mesh>

      {!isReplaying && (
        <mesh position={endPoint}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#e8eaf6" emissive="#e8eaf6" emissiveIntensity={1.5} />
        </mesh>
      )}

      {isReplaying && (
        <>
          <mesh ref={skierRef}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#66ff66" emissiveIntensity={3} />
          </mesh>
          <pointLight
            ref={skierLightRef}
            color="#aaffaa"
            intensity={4}
            distance={5}
            decay={2}
          />
        </>
      )}
    </group>
  )
}
