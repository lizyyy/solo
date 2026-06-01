import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { CorrosionPoint, Severity } from '@/types'
import { SEVERITY_COLORS } from '@/types'
import { useStore } from '@/store/useStore'

const SEVERITY_RADIUS: Record<Severity, number> = {
  none: 0.12,
  minor: 0.15,
  moderate: 0.18,
  severe: 0.22,
  critical: 0.26,
}

interface CorrosionPoint3DProps {
  point: CorrosionPoint
}

export default function CorrosionPoint3D({ point }: CorrosionPoint3DProps) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const selectedPointId = useStore((s) => s.selectedPointId)
  const selectPoint = useStore((s) => s.selectPoint)

  const isSelected = selectedPointId === point.id
  const color = SEVERITY_COLORS[point.severity]
  const radius = SEVERITY_RADIUS[point.severity]

  useFrame((state) => {
    if (!meshRef.current) return
    if (isSelected) {
      const t = state.clock.elapsedTime
      const scale = 1.0 + 0.3 * Math.sin(t * 3)
      meshRef.current.scale.setScalar(scale)
    } else if (hovered) {
      meshRef.current.scale.setScalar(1.2)
    } else {
      meshRef.current.scale.setScalar(1.0)
    }
  })

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
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.3}
        />
      </mesh>
      {point.status === 'exception' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius + 0.08, 0.02, 8, 32]} />
          <meshBasicMaterial color="#F97316" wireframe />
        </mesh>
      )}
    </group>
  )
}
