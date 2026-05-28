import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface BaseOutlineProps {
  base: { width: number; depth: number; height: number }
  baseMinRequired: { width: number; depth: number }
}

export default function BaseOutline({ base, baseMinRequired }: BaseOutlineProps) {
  const undersize = base.width < baseMinRequired.width || base.depth < baseMinRequired.depth
  const pulseRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (undersize && pulseRef.current) {
      const mat = pulseRef.current.material as THREE.MeshStandardMaterial
      const pulse = Math.sin(clock.elapsedTime * 4) * 0.3 + 0.7
      mat.emissiveIntensity = pulse
      mat.opacity = 0.3 + pulse * 0.2
    }
  })

  return (
    <group>
      <mesh
        ref={pulseRef}
        position={[0, base.height / 2, 0]}
      >
        <boxGeometry args={[base.width, base.height, base.depth]} />
        <meshStandardMaterial
          color={undersize ? '#ff3333' : '#3388ff'}
          transparent
          opacity={0.3}
          emissive={undersize ? '#ff0000' : '#000000'}
          emissiveIntensity={undersize ? 0.5 : 0}
        />
      </mesh>

      <mesh position={[0, base.height / 2, 0]}>
        <boxGeometry args={[baseMinRequired.width, base.height, baseMinRequired.depth]} />
        <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  )
}
