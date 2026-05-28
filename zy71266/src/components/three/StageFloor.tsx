import { useMemo } from 'react'
import * as THREE from 'three'

interface StageFloorProps {
  width: number
  depth: number
}

export function StageFloor({ width, depth }: StageFloorProps) {
  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(Math.max(width, depth), Math.max(width, depth), 0x444466, 0x333355)
  }, [width, depth])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[width + 4, depth + 4]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#252540" />
      </mesh>

      <primitive object={gridHelper} position={[0, 0.001, 0]} />

      <mesh position={[width / 2 + 0.1, 0.5, 0]}>
        <boxGeometry args={[0.2, 1, depth]} />
        <meshStandardMaterial color="#3d3d5c" />
      </mesh>
      <mesh position={[-width / 2 - 0.1, 0.5, 0]}>
        <boxGeometry args={[0.2, 1, depth]} />
        <meshStandardMaterial color="#3d3d5c" />
      </mesh>
      <mesh position={[0, 0.5, depth / 2 + 0.1]}>
        <boxGeometry args={[width + 0.4, 1, 0.2]} />
        <meshStandardMaterial color="#3d3d5c" />
      </mesh>
      <mesh position={[0, 0.5, -depth / 2 - 0.1]}>
        <boxGeometry args={[width + 0.4, 1, 0.2]} />
        <meshStandardMaterial color="#3d3d5c" />
      </mesh>
    </group>
  )
}
