import { useMemo } from 'react'
import type { Actor } from '@/types'

interface ActorModelProps {
  actor: Actor
  position: { x: number; y: number; z: number }
  selected: boolean
  inLight: boolean
  onClick: () => void
}

export function ActorModel({ actor, position, selected, inLight, onClick }: ActorModelProps) {
  const color = useMemo(() => actor.color || '#ff6b6b', [actor.color])

  return (
    <group position={[position.x, position.y, position.z]} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh position={[0, actor.height * 0.3, 0]}>
        <capsuleGeometry args={[0.25, actor.height * 0.5, 4, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={inLight ? color : '#000000'}
          emissiveIntensity={inLight ? 0.3 : 0}
          transparent
          opacity={selected ? 1 : 0.8}
        />
      </mesh>

      <mesh position={[0, actor.height * 0.75, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={inLight ? color : '#000000'}
          emissiveIntensity={inLight ? 0.3 : 0}
        />
      </mesh>

      {selected && (
        <mesh position={[0, actor.height * 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.55, 32]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.8} side={2} />
        </mesh>
      )}

      {!inLight && (
        <mesh position={[0, actor.height * 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.5, 32]} />
          <meshBasicMaterial color="#ff3b30" transparent opacity={0.6} side={2} />
        </mesh>
      )}
    </group>
  )
}
