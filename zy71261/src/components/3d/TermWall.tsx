import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { useTermWallStore } from "@/store/useTermWallStore"
import type { AggregatedBlock } from "@/types/index"

const LONG_COLOR = new THREE.Color("#ff6b35")
const SHORT_COLOR = new THREE.Color("#00d4aa")
const MISSING_DIR_COLOR = new THREE.Color("#6b7280")
const MISSING_EDGE_COLOR = new THREE.Color("#fbbf24")
const DUPLICATE_EDGE_COLOR = new THREE.Color("#ef4444")

const VARIETY_GAP = 3
const MONTH_GAP = 2.5
const MAX_HEIGHT = 8
const MIN_HEIGHT = 0.2
const BLOCK_WIDTH = 1.2
const BLOCK_DEPTH = 1.2

function Block({
  block,
  position,
  targetHeight,
  isHovered,
  onHover,
  onUnhover,
  onClick,
}: {
  block: AggregatedBlock
  position: [number, number, number]
  targetHeight: number
  isHovered: boolean
  onHover: () => void
  onUnhover: () => void
  onClick: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const edgeRef = useRef<THREE.LineSegments>(null)
  const animProgress = useRef(0)
  const currentHeight = useRef(0)

  const baseColor = useMemo(() => {
    if (block.direction === "long") return LONG_COLOR.clone()
    if (block.direction === "short") return SHORT_COLOR.clone()
    return MISSING_DIR_COLOR.clone()
  }, [block.direction])

  useFrame((_, delta) => {
    if (animProgress.current < 1) {
      animProgress.current = Math.min(1, animProgress.current + delta * 1.5)
      const eased = 1 - Math.pow(1 - animProgress.current, 3)
      currentHeight.current = MIN_HEIGHT + (targetHeight - MIN_HEIGHT) * eased
    }
    if (meshRef.current) {
      meshRef.current.scale.set(BLOCK_WIDTH, currentHeight.current, BLOCK_DEPTH)
      meshRef.current.position.y = currentHeight.current / 2
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      if (isHovered) {
        mat.emissiveIntensity = 0.5
        mat.emissive.copy(baseColor)
      } else {
        mat.emissiveIntensity = 0
      }
    }
    if (edgeRef.current && block.hasMissingFields) {
      edgeRef.current.scale.set(BLOCK_WIDTH * 1.02, currentHeight.current * 1.02, BLOCK_DEPTH * 1.02)
      edgeRef.current.position.y = currentHeight.current / 2
    }
  })

  const edgeColor = useMemo(() => {
    if (block.duplicateCount > 0) return DUPLICATE_EDGE_COLOR
    return MISSING_EDGE_COLOR
  }, [block.duplicateCount])

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onHover() }}
        onPointerOut={(e) => { e.stopPropagation(); onUnhover() }}
        onClick={(e) => { e.stopPropagation(); onClick() }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.35}
          metalness={0.45}
          transparent
          opacity={0.92}
        />
      </mesh>
      {(block.hasMissingFields || block.duplicateCount > 0) && (
        <lineSegments ref={edgeRef}>
          <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
          <lineBasicMaterial color={edgeColor} />
        </lineSegments>
      )}
    </group>
  )
}

export default function TermWall() {
  const aggregatedBlocks = useTermWallStore((s) => s.aggregatedBlocks)
  const hoveredBlock = useTermWallStore((s) => s.hoveredBlock)
  const hoverBlock = useTermWallStore((s) => s.hoverBlock)
  const selectBlock = useTermWallStore((s) => s.selectBlock)
  const openDrillDown = useTermWallStore((s) => s.openDrillDown)

  const { varietyOrder, monthOrder, maxMargin } = useMemo(() => {
    const varieties = new Set<string>()
    const months = new Set<string>()
    let max = 0
    for (const b of aggregatedBlocks) {
      varieties.add(b.varietyCode)
      months.add(b.contractMonth)
      if (b.contractMonth !== "__MISSING__" && b.totalMargin > max) max = b.totalMargin
    }
    if (max === 0) {
      for (const b of aggregatedBlocks) {
        if (b.totalMargin > max) max = b.totalMargin
      }
    }
    return {
      varietyOrder: Array.from(varieties).sort(),
      monthOrder: Array.from(months).sort(),
      maxMargin: max || 1,
    }
  }, [aggregatedBlocks])

  const varietyIndex = useMemo(() => {
    const m = new Map<string, number>()
    varietyOrder.forEach((v, i) => m.set(v, i))
    return m
  }, [varietyOrder])

  const monthIndex = useMemo(() => {
    const m = new Map<string, number>()
    monthOrder.forEach((mo, i) => m.set(mo, i))
    return m
  }, [monthOrder])

  const totalVarieties = varietyOrder.length
  const totalMonths = monthOrder.length
  const offsetX = -(totalVarieties - 1) * VARIETY_GAP / 2
  const offsetZ = -(totalMonths - 1) * MONTH_GAP / 2

  return (
    <group>
      {aggregatedBlocks.map((block) => {
        const vi = varietyIndex.get(block.varietyCode) ?? 0
        const mi = monthIndex.get(block.contractMonth) ?? 0
        const x = offsetX + vi * VARIETY_GAP
        const z = offsetZ + mi * MONTH_GAP
        const targetHeight = MIN_HEIGHT + (block.totalMargin / maxMargin) * (MAX_HEIGHT - MIN_HEIGHT)
        const isHovered = hoveredBlock !== null &&
          hoveredBlock.varietyCode === block.varietyCode &&
          hoveredBlock.contractMonth === block.contractMonth &&
          hoveredBlock.direction === block.direction &&
          hoveredBlock.clientId === block.clientId

        return (
          <Block
            key={`${block.varietyCode}-${block.contractMonth}-${block.direction}-${block.clientId}`}
            block={block}
            position={[x, 0, z]}
            targetHeight={targetHeight}
            isHovered={isHovered}
            onHover={() => hoverBlock(block)}
            onUnhover={() => hoverBlock(null)}
            onClick={() => { selectBlock(block); openDrillDown(block) }}
          />
        )
      })}
    </group>
  )
}
