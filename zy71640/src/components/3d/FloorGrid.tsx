import { useRef } from 'react'
import { GridHelper } from 'three'

export default function FloorGrid() {
  const gridRef = useRef<GridHelper>(null)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#2a2a3e" />
      </mesh>
      <gridHelper
        ref={gridRef}
        args={[40, 40, '#3a3a5e', '#3a3a5e']}
        position={[0, 0.01, 0]}
      />
    </group>
  )
}
