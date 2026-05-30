import { ThreeEvent } from '@react-three/fiber'
import type { Light } from '@/types'
import { useExhibitionStore } from '@/store/useExhibitionStore'

interface LightFixtureProps {
  light: Light
  isConflict: boolean
  isSelected: boolean
}

export default function LightFixture({ light, isConflict, isSelected }: LightFixtureProps) {
  const selectObject = useExhibitionStore((s) => s.selectObject)
  const showLightRanges = useExhibitionStore((s) => s.showLightRanges)

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    selectObject(light.id, 'light')
  }

  const sphereColor = isConflict ? '#ef4444' : light.color
  const emissiveColor = isConflict ? '#ef4444' : light.color

  return (
    <group position={[light.posX, light.posY, light.posZ]}>
      <mesh onClick={handleClick}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={sphereColor}
          emissive={emissiveColor}
          emissiveIntensity={isSelected ? 1.5 : 0.8}
        />
      </mesh>

      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial color={sphereColor} wireframe transparent opacity={0.5} />
        </mesh>
      )}

      {showLightRanges && (
        <mesh>
          <sphereGeometry args={[light.range, 32, 32]} />
          <meshBasicMaterial
            color={isConflict ? '#ef4444' : light.color}
            transparent
            opacity={0.04}
            depthWrite={false}
          />
        </mesh>
      )}

      {light.type === 'point' && (
        <pointLight
          position={[0, 0, 0]}
          color={light.color}
          intensity={light.intensity}
          distance={light.range}
          decay={2}
        />
      )}

      {light.type === 'spot' && (
        <spotLight
          position={[0, 0, 0]}
          color={light.color}
          intensity={light.intensity}
          distance={light.range}
          angle={0.5}
          penumbra={0.5}
          decay={2}
        />
      )}
    </group>
  )
}
