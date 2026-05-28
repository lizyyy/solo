import { useMemo } from 'react'
import * as THREE from 'three'

interface SupportConeProps {
  base: { width: number; depth: number; height: number }
  cog: { x: number; y: number; z: number }
  cogLimit: { radius: number }
}

export default function SupportCone({ base, cog, cogLimit }: SupportConeProps) {
  const cogOffset = Math.sqrt(cog.x ** 2 + cog.z ** 2)
  const isStable = cogOffset <= cogLimit.radius

  const coneHeight = Math.max(0.01, cog.y)
  const baseRadius = Math.max(0.01, Math.min(base.width, base.depth) / 2)

  const coneRotation = useMemo(() => {
    return [Math.PI, 0, 0] as [number, number, number]
  }, [])

  return (
    <group position={[0, 0, 0]}>
      <mesh
        position={[0, coneHeight / 2, 0]}
        rotation={coneRotation}
      >
        <coneGeometry args={[baseRadius, coneHeight, 32, 1, true]} />
        <meshStandardMaterial
          color={isStable ? '#22cc44' : '#ff2222'}
          transparent
          opacity={isStable ? 0.2 : 0.12}
          side={THREE.DoubleSide}
          emissive={isStable ? '#115522' : '#551111'}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  )
}
