import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '@/store/useStore'
import { InspectionPoint as InspectionPointType, PointStatus } from '@/types'

const STATUS_COLORS: Record<PointStatus, string> = {
  normal: '#00E5A0',
  anomaly: '#FF4757',
  conflict: '#FFA502',
  pending: '#5B6B7D',
}

function AnomalyPulse({ position, color }: { position: [number, number, number]; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.getElapsedTime()
      const scale = 1 + 0.3 * Math.sin(t * 3)
      ringRef.current.scale.set(scale, scale, 1)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.3 * Math.sin(t * 3)
    }
  })

  return (
    <mesh ref={ringRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.6, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function InspectionPointMarker({ point }: { point: InspectionPointType }) {
  const { selectPoint, selectedPointId, filterStatus } = useStore()
  const meshRef = useRef<THREE.Mesh>(null)
  const isSelected = selectedPointId === point.id

  const isVisible = filterStatus === 'all' || point.status === filterStatus

  const color = STATUS_COLORS[point.status]
  const isAnomaly = point.status === 'anomaly' || point.status === 'conflict'

  useFrame(({ clock }) => {
    if (meshRef.current && isAnomaly) {
      const t = clock.getElapsedTime()
      const scale = 1 + 0.15 * Math.sin(t * 4 + point.x)
      meshRef.current.scale.set(scale, scale, scale)
    }
  })

  if (!isVisible) return null

  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          selectPoint(point.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      >
        <sphereGeometry args={[isSelected ? 0.35 : 0.25, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : isAnomaly ? 0.5 : 0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {isAnomaly && <AnomalyPulse position={[0, 0, 0]} color={color} />}

      <pointLight
        position={[0, 0, 0]}
        color={color}
        intensity={isAnomaly ? 2 : 0}
        distance={3}
      />
    </group>
  )
}
