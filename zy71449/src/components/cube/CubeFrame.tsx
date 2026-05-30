import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCubeStore } from '@/store/useCubeStore'

export default function CubeFrame() {
  const groupRef = useRef<THREE.Group>(null)

  const edges = useMemo(() => {
    const s = 8
    const h = s / 2
    const pts: [number, number, number][] = [
      [-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h],
      [-h, s, -h], [h, s, -h], [h, s, h], [-h, s, h],
    ]
    const lines: number[][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ]
    return lines.map(([a, b]) => ({
      start: new THREE.Vector3(...pts[a]),
      end: new THREE.Vector3(...pts[b]),
    }))
  }, [])

  const timeSlice = useCubeStore(s => s.timeSlicePosition)

  const sliceY = useMemo(() => {
    if (timeSlice === null) return -1
    return (timeSlice / 100) * 8
  }, [timeSlice])

  return (
    <group ref={groupRef}>
      {edges.map((edge, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                edge.start.x, edge.start.y, edge.start.z,
                edge.end.x, edge.end.y, edge.end.z,
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#00D4FF" transparent opacity={0.25} />
        </line>
      ))}

      {sliceY >= 0 && sliceY <= 8 && (
        <mesh position={[0, sliceY, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[8, 8]} />
          <meshBasicMaterial
            color="#00D4FF"
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {[
        { pos: [0, -0.3, 0] as [number, number, number], label: '时间 →' },
        { pos: [-4.5, 4, 0] as [number, number, number], label: '地区' },
        { pos: [0, 8.4, 0] as [number, number, number], label: '赔付额' },
      ].map((axis, i) => (
        <group key={i} position={axis.pos}>
          <mesh>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#00D4FF" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
