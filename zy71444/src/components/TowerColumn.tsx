import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Box } from "@react-three/drei"
import * as THREE from "three"
import type { AggregatedExposure, GreekKey } from "@/data/types"
import { AnomalyPulse } from "./AnomalyPulse"

interface TowerColumnProps {
  exposure: AggregatedExposure
  position: [number, number, number]
  heightScale: number
  isSelected: boolean
  isHovered: boolean
  isDimmed: boolean
  activeGreeks: GreekKey[]
  onClick: () => void
  onPointerOver: () => void
  onPointerOut: () => void
}

const GREEK_COLORS: Record<GreekKey, string> = {
  delta: "#4a90d9",
  gamma: "#9b59b6",
  vega: "#1abc9c",
}

function getRiskColor(value: number, maxAbs: number): string {
  const t = Math.min(Math.abs(value) / (maxAbs || 1), 1)
  const low = new THREE.Color("#00d4aa")
  const high = new THREE.Color("#ff6b35")
  return low.lerp(high, t).getStyle()
}

export function TowerColumn({
  exposure,
  position,
  heightScale,
  isSelected,
  isHovered,
  isDimmed,
  activeGreeks,
  onClick,
  onPointerOver,
  onPointerOut,
}: TowerColumnProps) {
  const groupRef = useRef<THREE.Group>(null)
  const targetScale = isHovered ? 1.08 : 1
  const hasBucketMismatch = exposure.anomalyType.includes("BUCKET_MISMATCH")
  const hasSignReversal = exposure.anomalyType.includes("SIGN_REVERSAL")

  const segments = useMemo(() => {
    return activeGreeks.map((greek) => ({
      greek,
      value: exposure[greek],
      color: GREEK_COLORS[greek],
      height: Math.abs(exposure[greek]) * heightScale,
    }))
  }, [activeGreeks, exposure, heightScale])

  const maxAbsValue = useMemo(() => {
    return Math.max(...segments.map((s) => Math.abs(s.value)), 0.01)
  }, [segments])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const s = groupRef.current.scale
    s.x += (targetScale - s.x) * Math.min(delta * 8, 1)
    s.y += (targetScale - s.y) * Math.min(delta * 8, 1)
    s.z += (targetScale - s.z) * Math.min(delta * 8, 1)

    if (hasBucketMismatch) {
      const pulse = 0.3 + Math.sin(Date.now() * 0.005) * 0.3
      groupRef.current.children.forEach((child) => {
        if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
          if (mat.emissive) {
            mat.emissiveIntensity = pulse
          }
        }
      })
    }
  })

  let yOffset = 0

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver() }}
      onPointerOut={onPointerOut}
    >
      {segments.map((seg, i) => {
        const h = Math.max(seg.height, 0.05)
        const yPos = yOffset + h / 2
        yOffset += h

        const baseColor = getRiskColor(seg.value, maxAbsValue)
        const emissiveColor = hasBucketMismatch ? "#ff0000" : "#000000"
        const emissiveIntensity = hasBucketMismatch ? 0.3 : 0

        return (
          <group key={seg.greek}>
            <Box
              args={[0.8, h, 0.8]}
              position={[0, yPos, 0]}
            >
              <meshStandardMaterial
                color={isHovered ? new THREE.Color(baseColor).lerp(new THREE.Color("#ffffff"), 0.3).getStyle() : baseColor}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
                transparent={isDimmed || isHovered}
                opacity={isDimmed ? 0.2 : isHovered ? 0.9 : 1}
              />
            </Box>
            {hasSignReversal && (
              <Box
                args={[0.84, h, 0.84]}
                position={[0, yPos, 0]}
              >
                <meshBasicMaterial
                  color="#ffff00"
                  wireframe
                  transparent
                  opacity={0.7}
                />
              </Box>
            )}
          </group>
        )
      })}

      {exposure.hasAnomaly && (
        <AnomalyPulse
          position={[0, yOffset, 0]}
          anomalyType={exposure.anomalyType[0]}
          active={exposure.hasAnomaly}
        />
      )}

      {isSelected && (
        <Box
          args={[0.9, yOffset + 0.1, 0.9]}
          position={[0, yOffset / 2, 0]}
        >
          <meshBasicMaterial
            color="#ffffff"
            wireframe
            transparent
            opacity={0.4}
          />
        </Box>
      )}
    </group>
  )
}
