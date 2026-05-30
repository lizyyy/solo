import React from 'react'
import { Text } from '@react-three/drei'

const KitchenExit3D = React.memo(function KitchenExit3D() {
  return (
    <group position={[-6, 0, 0]}>
      <mesh position={[-0.5, 0.9, 0]}>
        <boxGeometry args={[0.15, 1.8, 0.3]} />
        <meshStandardMaterial color="#F0A500" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0.5, 0.9, 0]}>
        <boxGeometry args={[0.15, 1.8, 0.3]} />
        <meshStandardMaterial color="#F0A500" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <boxGeometry args={[1.15, 0.15, 0.3]} />
        <meshStandardMaterial color="#F0A500" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.9, 0.01]}>
        <planeGeometry args={[0.85, 1.65]} />
        <meshStandardMaterial
          color="#F0A500"
          emissive="#F0A500"
          emissiveIntensity={0.6}
          transparent
          opacity={0.4}
        />
      </mesh>
      <Text
        position={[0, 2.2, 0]}
        fontSize={0.3}
        color="#F0A500"
        anchorX="center"
        anchorY="middle"
      >
        出餐口
      </Text>
    </group>
  )
})

export default KitchenExit3D
