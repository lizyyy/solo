import * as THREE from 'three'
import { useRef } from 'react'

function CranePart({
  position,
  size,
  color = '#2A3F52',
  label,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color?: string
  label: string
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.35}
          wireframe={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial
          color="#4A6278"
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh position={[0, size[1] / 2 + 0.2, 0]}>
        <planeGeometry args={[Math.max(size[0], 2), 0.3]} />
        <meshBasicMaterial color="#5B6B7D" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export default function CraneModel() {
  return (
    <group>
      <CranePart position={[0, 10, 0]} size={[14, 1.2, 2]} label="主梁" />
      <CranePart position={[-6, 5, 0]} size={[2, 10, 2]} color="#1E3246" label="左立柱" />
      <CranePart position={[6, 5, 0]} size={[2, 10, 2]} color="#1E3246" label="右立柱" />
      <CranePart position={[0, 10, 8]} size={[10, 1, 1.8]} color="#1E3246" label="前大梁" />
      <CranePart position={[0, 10, -6]} size={[8, 1, 1.8]} color="#1E3246" label="后大梁" />
      <CranePart position={[0, 11, 3]} size={[4, 0.8, 1.5]} color="#3A4F62" label="小车" />

      <mesh position={[-6, 0, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.8, 0.5, 8]} />
        <meshStandardMaterial color="#1B2B3A" transparent opacity={0.5} />
      </mesh>
      <mesh position={[6, 0, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.8, 0.5, 8]} />
        <meshStandardMaterial color="#1B2B3A" transparent opacity={0.5} />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#0A1520" transparent opacity={0.8} />
      </mesh>
      <gridHelper args={[40, 40, '#1B2B3A', '#0F1923']} position={[0, 0.01, 0]} />
    </group>
  )
}
