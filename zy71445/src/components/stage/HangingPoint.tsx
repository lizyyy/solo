import { useRef, useState } from "react"
import * as THREE from "three"
import { ThreeEvent } from "@react-three/fiber"
import { useStore } from "@/store/useStore"
import type { HangingPoint as HangingPointType } from "@/types"

interface Props {
  data: HangingPointType
}

export default function HangingPoint({ data }: Props) {
  const ref = useRef<THREE.Group>(null)
  const selectedElement = useStore((s) => s.selectedElement)
  const setSelectedElement = useStore((s) => s.setSelectedElement)
  const collisions = useStore((s) => s.scene.collisions)
  const hoveredCollision = useStore((s) => s.hoveredCollision)
  const [hovered, setHovered] = useState(false)

  const isSelected = selectedElement?.type === "hangingPoint" && selectedElement.id === data.id
  const isColliding = collisions.some(
    (c) => !c.resolved && c.involvedElements.includes(data.id),
  )
  const isHoveredByCollision = hoveredCollision != null &&
    collisions.some(
      (c) => c.id === hoveredCollision && c.involvedElements.includes(data.id),
    )
  const isOverloaded = data.currentLoad > data.loadCapacity
  const loadRatio = data.currentLoad / data.loadCapacity

  const ringColor = isHoveredByCollision
    ? "#ff4444"
    : isOverloaded
      ? "#ff4444"
      : isColliding
        ? "#ff8800"
        : isSelected
          ? "#c41e3a"
          : hovered
            ? "#8888aa"
            : "#666680"

  const emissiveIntensity = isSelected ? 0.5 : isColliding ? 0.2 : 0

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedElement({ type: "hangingPoint", id: data.id })
  }

  return (
    <group
      ref={ref}
      position={[data.position.x, data.position.y, data.position.z]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.06, 12, 32]} />
        <meshStandardMaterial
          color={ringColor}
          roughness={0.3}
          metalness={0.8}
          emissive={ringColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
        <meshStandardMaterial color={ringColor} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.08, 0.15]} />
        <meshStandardMaterial color="#333340" roughness={0.7} metalness={0.3} />
      </mesh>
      <sprite position={[0, 0.9, 0]} scale={[2, 0.6, 1]}>
        <spriteMaterial color={loadRatio > 1 ? "#ff4444" : "#8888aa"} opacity={0.9} transparent />
      </sprite>
    </group>
  )
}
