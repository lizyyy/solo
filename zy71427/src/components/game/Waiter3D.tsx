import React from 'react'
import * as THREE from 'three'
import { useGameStore } from '@/store/gameStore'
import type { Waiter } from '@/types'

interface Waiter3DProps {
  waiter: Waiter
}

const Waiter3D = React.memo(function Waiter3D({ waiter }: Waiter3DProps) {
  const selectWaiter = useGameStore(s => s.selectWaiter)
  const selectedWaiterId = useGameStore(s => s.selectedWaiterId)
  const isSelected = selectedWaiterId === waiter.id

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation()
    selectWaiter(isSelected ? null : waiter.id)
  }

  const trayColor = waiter.carryingFood ? '#F0A500' : waiter.carryingDishes ? '#4A90D9' : null

  return (
    <group position={[waiter.position.x, 0, waiter.position.z]}>
      <mesh position={[0, 0.5, 0]} onClick={handleClick}>
        <cylinderGeometry args={[0.2, 0.2, 0.8, 16]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.1} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#F5D0A9" metalness={0.05} roughness={0.7} />
      </mesh>
      {trayColor && (
        <mesh position={[0, 0.92, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />
          <meshStandardMaterial
            color={trayColor}
            emissive={trayColor}
            emissiveIntensity={0.3}
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>
      )}
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.35, 32]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={1}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  )
})

export default Waiter3D
