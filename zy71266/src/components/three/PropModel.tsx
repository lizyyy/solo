import { useMemo } from 'react'
import * as THREE from 'three'
import type { Prop } from '@/types'

interface PropModelProps {
  prop: Prop
  selected: boolean
  occluded: boolean
  onClick: () => void
}

export function PropModel({ prop, selected, occluded, onClick }: PropModelProps) {
  const rotation = useMemo(
    () =>
      [
        (prop.rotationX * Math.PI) / 180,
        (prop.rotationY * Math.PI) / 180,
        (prop.rotationZ * Math.PI) / 180,
      ] as [number, number, number],
    [prop.rotationX, prop.rotationY, prop.rotationZ]
  )

  const color = useMemo(() => {
    if (occluded) return '#ff3b30'
    if (prop.occluder) return '#4a90d9'
    return '#6b7280'
  }, [prop.occluder, occluded])

  const renderGeometry = () => {
    switch (prop.type) {
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
      case 'plane':
        return <planeGeometry args={[1, 1]} />
      case 'box':
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }

  return (
    <group
      position={[prop.positionX, prop.positionY, prop.positionZ]}
      rotation={rotation}
      scale={[prop.scaleX, prop.scaleY, prop.scaleZ]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <mesh>
        {renderGeometry()}
        <meshStandardMaterial
          color={color}
          transparent
          opacity={selected ? 1 : 0.8}
          emissive={occluded ? '#ff3b30' : selected ? '#00d4ff' : '#000000'}
          emissiveIntensity={occluded ? 0.4 : selected ? 0.2 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {selected && (
        <mesh>
          {prop.type === 'box' && <boxGeometry args={[1.05, 1.05, 1.05]} />}
          {prop.type === 'sphere' && <sphereGeometry args={[0.53, 32, 32]} />}
          {prop.type === 'cylinder' && <cylinderGeometry args={[0.53, 0.53, 1.03, 32]} />}
          {prop.type === 'plane' && <planeGeometry args={[1.05, 1.05]} />}
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.3} wireframe />
        </mesh>
      )}

      {occluded && (
        <mesh position={[0, 0.6 / prop.scaleY, 0]}>
          <sphereGeometry args={[0.1 / Math.max(prop.scaleX, prop.scaleY, prop.scaleZ), 16, 16]} />
          <meshBasicMaterial color="#ff3b30" />
        </mesh>
      )}
    </group>
  )
}
