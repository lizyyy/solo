import React from 'react'
import { Text } from '@react-three/drei'

const DishArea3D = React.memo(function DishArea3D() {
  return (
    <group position={[6, 0, -3]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.5, 0.9, 0.8]} />
        <meshStandardMaterial color="#4A90D9" metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <boxGeometry args={[1.1, 0.08, 0.55]} />
        <meshStandardMaterial color="#6BB3E0" metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <boxGeometry args={[0.9, 0.05, 0.4]} />
        <meshStandardMaterial
          color="#87CEEB"
          emissive="#4A90D9"
          emissiveIntensity={0.15}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
      <Text
        position={[0, 1.4, 0]}
        fontSize={0.25}
        color="#4A90D9"
        anchorX="center"
        anchorY="middle"
      >
        收台区
      </Text>
    </group>
  )
})

export default DishArea3D
