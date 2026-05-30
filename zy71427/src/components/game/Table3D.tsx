import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/gameStore'
import type { Table, TableStatus } from '@/types'

interface Table3DProps {
  table: Table
}

const STATUS_COLORS: Record<TableStatus, string> = {
  idle: '#4ADE80',
  ordered: '#FBBF24',
  serving: '#F0A500',
  eating: '#60A5FA',
  needs_clearing: '#EF4444',
  clearing: '#A78BFA',
}

const PULSING_STATUSES: TableStatus[] = ['ordered', 'needs_clearing']

const Table3D = React.memo(function Table3D({ table }: Table3DProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const selectTable = useGameStore(s => s.selectTable)
  const selectedTableId = useGameStore(s => s.selectedTableId)
  const isSelected = selectedTableId === table.id
  const isPulsing = PULSING_STATUSES.includes(table.status)

  useFrame((state) => {
    if (materialRef.current && isPulsing) {
      const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.3 + 0.3
      materialRef.current.emissiveIntensity = pulse
    } else if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0
    }
  })

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation()
    selectTable(isSelected ? null : table.id)
  }

  return (
    <group position={[table.position.x, 0, table.position.z]}>
      <mesh
        ref={meshRef}
        position={[0, 0.8, 0]}
        onClick={handleClick}
      >
        <cylinderGeometry args={[0.6, 0.6, 0.05, 32]} />
        <meshStandardMaterial
          ref={materialRef}
          color={STATUS_COLORS[table.status]}
          emissive={STATUS_COLORS[table.status]}
          emissiveIntensity={0}
          metalness={0.1}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.8, 8]} />
        <meshStandardMaterial color="#5C4033" metalness={0.1} roughness={0.7} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.75, 32]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive="#FFFFFF"
            emissiveIntensity={0.8}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}
    </group>
  )
})

export default Table3D
