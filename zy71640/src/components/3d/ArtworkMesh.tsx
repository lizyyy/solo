import { useRef, useState } from 'react'
import { Mesh, Group, Vector3 } from 'three'
import { Html, DragControls } from '@react-three/drei'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import type { Artwork } from '@/types'
import { useExhibitionStore } from '@/store/useExhibitionStore'

interface ArtworkMeshProps {
  artwork: Artwork
  isConflict: boolean
  isSelected: boolean
}

export default function ArtworkMesh({ artwork, isConflict, isSelected }: ArtworkMeshProps) {
  const meshRef = useRef<Mesh>(null)
  const wireRef = useRef<Mesh>(null)
  const groupRef = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const selectObject = useExhibitionStore((s) => s.selectObject)
  const updateArtworkPosition = useExhibitionStore((s) => s.updateArtworkPosition)
  const walls = useExhibitionStore((s) => s.walls)

  const wall = walls.find((w) => w.id === artwork.wallId)

  useFrame(() => {
    if (wireRef.current && isConflict) {
      wireRef.current.scale.setScalar(1 + 0.03 * Math.sin(Date.now() * 0.005))
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    selectObject(artwork.id, 'artwork')
  }

  const handleDragEnd = () => {
    if (!groupRef.current) return
    const pos = groupRef.current.position
    if (wall) {
      const dx = wall.endX - wall.startX
      const dz = wall.endZ - wall.startZ
      const wallLen = Math.sqrt(dx * dx + dz * dz)
      const wallDirX = dx / wallLen
      const wallDirZ = dz / wallLen
      const wallNormalX = -wallDirZ
      const wallNormalZ = wallDirX

      const dot = pos.x * wallNormalX + pos.z * wallNormalZ
      const wallMidDot = ((wall.startX + wall.endX) / 2) * wallNormalX + ((wall.startZ + wall.endZ) / 2) * wallNormalZ
      const offset = dot - wallMidDot

      const clampedX = pos.x - offset * wallNormalX
      const clampedZ = pos.z - offset * wallNormalZ
      updateArtworkPosition(artwork.id, clampedX, pos.y, clampedZ)
    } else {
      updateArtworkPosition(artwork.id, pos.x, pos.y, pos.z)
    }
  }

  const baseColor = isConflict ? '#ef4444' : isSelected ? '#22d3ee' : '#f8f4e8'
  const emissiveColor = isSelected ? '#22d3ee' : isConflict ? '#ef4444' : '#000000'
  const emissiveIntensity = isSelected ? 0.3 : isConflict ? 0.2 : 0

  return (
    <DragControls onDragEnd={handleDragEnd}>
      <group ref={groupRef} position={[artwork.posX, artwork.posY, artwork.posZ]} rotation={[0, artwork.rotY, 0]}>
        <mesh
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[artwork.width, artwork.height, artwork.depth]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
          />
        </mesh>

        {isConflict && (
          <mesh ref={wireRef}>
            <boxGeometry args={[artwork.width + 0.1, artwork.height + 0.1, artwork.depth + 0.1]} />
            <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.6} />
          </mesh>
        )}

        {(hovered || isSelected) && (
          <Html position={[0, artwork.height / 2 + 0.3, 0]} center distanceFactor={8}>
            <div style={{
              background: 'rgba(0,0,0,0.75)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              {artwork.title}
            </div>
          </Html>
        )}
      </group>
    </DragControls>
  )
}
