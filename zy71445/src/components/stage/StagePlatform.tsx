import { useRef } from "react"
import * as THREE from "three"
import { useStore } from "@/store/useStore"

export default function StagePlatform() {
  const stage = useStore((s) => s.scene.stage)
  const meshRef = useRef<THREE.Mesh>(null)

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[0, stage.height / 2 - 0.15, 0]}
        receiveShadow
      >
        <boxGeometry args={[stage.width, 0.3, stage.depth]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} metalness={0.1} />
      </mesh>
      <gridHelper
        args={[Math.max(stage.width, stage.depth), stage.gridUnit * 4, "#333340", "#28283a"]}
        position={[0, stage.height, 0]}
      />
      <mesh position={[0, -0.01, stage.depth / 2 + 0.5]}>
        <planeGeometry args={[stage.width + 2, 1]} />
        <meshStandardMaterial color="#1a1a2e" roughness={1} />
      </mesh>
    </group>
  )
}
