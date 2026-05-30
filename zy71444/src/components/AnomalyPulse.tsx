import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface AnomalyPulseProps {
  position: [number, number, number]
  anomalyType: "BUCKET_MISMATCH" | "SIGN_REVERSAL"
  active: boolean
}

export function AnomalyPulse({ position, anomalyType, active }: AnomalyPulseProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = anomalyType === "BUCKET_MISMATCH" ? "#ff2200" : "#ffcc00"

  useFrame(() => {
    if (!meshRef.current || !active) return
    const t = Date.now() * 0.003
    const pulseScale = 1 + Math.sin(t) * 0.4
    meshRef.current.scale.set(pulseScale, pulseScale, pulseScale)
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.15 + Math.sin(t) * 0.15
  })

  if (!active) return null

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.6, 24, 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
