import { useRef } from 'react'
import { Mesh, MeshStandardMaterial } from 'three'
import { ThreeEvent } from '@react-three/fiber'
import type { Wall } from '@/types'
import { useExhibitionStore } from '@/store/useExhibitionStore'

interface WallMeshProps {
  wall: Wall
}

export default function WallMesh({ wall }: WallMeshProps) {
  const meshRef = useRef<Mesh>(null)
  const selectObject = useExhibitionStore((s) => s.selectObject)
  const selectedId = useExhibitionStore((s) => s.selectedId)
  const isSelected = selectedId === wall.id

  const dx = wall.endX - wall.startX
  const dz = wall.endZ - wall.startZ
  const length = Math.sqrt(dx * dx + dz * dz)
  const height = wall.height
  const thickness = 0.15

  const centerX = (wall.startX + wall.endX) / 2
  const centerY = (wall.startY + wall.endY) / 2 + height / 2
  const centerZ = (wall.startZ + wall.endZ) / 2

  const rotationY = -Math.atan2(dz, dx)

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    selectObject(wall.id, 'wall')
  }

  const handlePointerOver = () => {
    if (meshRef.current) {
      (meshRef.current.material as MeshStandardMaterial).opacity = 0.9
    }
  }

  const handlePointerOut = () => {
    if (meshRef.current) {
      (meshRef.current.material as MeshStandardMaterial).opacity = isSelected ? 0.85 : 0.7
    }
  }

  return (
    <mesh
      ref={meshRef}
      position={[centerX, centerY, centerZ]}
      rotation={[0, rotationY, 0]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial
        color={isSelected ? '#e0e7ff' : '#ffffff'}
        transparent
        opacity={isSelected ? 0.85 : 0.7}
        side={2}
      />
    </mesh>
  )
}
