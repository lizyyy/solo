import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Severity } from '../../types'

interface ConflictMarkerProps {
  position: [number, number, number]
  severity: Severity
  visible: boolean
}

function ConflictMarker({ position, severity, visible }: ConflictMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const colors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#3b82f6',
  }

  useFrame(({ clock }) => {
    if (meshRef.current && visible) {
      const scale = 1 + Math.sin(clock.elapsedTime * 4) * 0.2
      meshRef.current.scale.setScalar(scale)
    }
  })

  if (!visible) return null

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <ringGeometry args={[0.5, 1, 32]} />
        <meshBasicMaterial color={colors[severity]} transparent opacity={0.7} side={2} />
      </mesh>

      <mesh position={[0, 0.5, 0]}>
        <dodecahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color={colors[severity]} />
      </mesh>
    </group>
  )
}

export default ConflictMarker
