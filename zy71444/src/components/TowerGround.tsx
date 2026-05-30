import { useMemo } from "react"
import { Text } from "@react-three/drei"

interface TowerGroundProps {
  clientLabels: string[]
  bucketLabels: string[]
  spacing: number
}

export function TowerGround({ clientLabels, bucketLabels, spacing }: TowerGroundProps) {
  const gridWidth = (clientLabels.length + 1) * spacing
  const gridDepth = (bucketLabels.length + 1) * spacing

  const clientTexts = useMemo(() => {
    return clientLabels.map((label, i) => (
      <Text
        key={`client-${i}`}
        position={[i * spacing, 0.01, -spacing * 0.7]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    ))
  }, [clientLabels, spacing])

  const bucketTexts = useMemo(() => {
    return bucketLabels.map((label, i) => (
      <Text
        key={`bucket-${i}`}
        position={[-spacing * 0.7, 0.01, i * spacing]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    ))
  }, [bucketLabels, spacing])

  return (
    <group>
      <gridHelper
        args={[Math.max(gridWidth, gridDepth), Math.max(clientLabels.length, bucketLabels.length), "#1e293b", "#0f172a"]}
        position={[gridWidth / 2 - spacing / 2, 0, gridDepth / 2 - spacing / 2]}
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[gridWidth / 2 - spacing / 2, -0.01, gridDepth / 2 - spacing / 2]}
      >
        <planeGeometry args={[gridWidth, gridDepth]} />
        <meshStandardMaterial
          color="#0a0f1a"
          transparent
          opacity={0.8}
        />
      </mesh>

      {clientTexts}
      {bucketTexts}
    </group>
  )
}
