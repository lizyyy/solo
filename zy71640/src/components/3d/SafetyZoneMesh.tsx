import type { SafetyZone, Artwork } from '@/types'
import { useExhibitionStore } from '@/store/useExhibitionStore'

interface SafetyZoneMeshProps {
  zone: SafetyZone
  artwork: Artwork | undefined
}

export default function SafetyZoneMesh({ zone, artwork }: SafetyZoneMeshProps) {
  const showSafetyZones = useExhibitionStore((s) => s.showSafetyZones)

  if (!showSafetyZones || !artwork) return null

  return (
    <mesh
      position={[artwork.posX, 0.02, artwork.posZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[zone.distance - 0.05, zone.distance + 0.05, 64]} />
      <meshBasicMaterial
        color="#06b6d4"
        transparent
        opacity={0.25}
        depthWrite={false}
        side={2}
      />
    </mesh>
  )
}
