import { useRef, useState } from "react"
import * as THREE from "three"
import { ThreeEvent } from "@react-three/fiber"
import { useStore } from "@/store/useStore"
import type { LightBar as LightBarType } from "@/types"

interface Props {
  data: LightBarType
}

export default function LightBar({ data }: Props) {
  const ref = useRef<THREE.Group>(null)
  const selectedElement = useStore((s) => s.selectedElement)
  const setSelectedElement = useStore((s) => s.setSelectedElement)
  const collisions = useStore((s) => s.scene.collisions)
  const hoveredCollision = useStore((s) => s.hoveredCollision)
  const [hovered, setHovered] = useState(false)

  const isSelected = selectedElement?.type === "lightBar" && selectedElement.id === data.id
  const isColliding = collisions.some(
    (c) => !c.resolved && c.involvedElements.includes(data.id),
  )
  const isHoveredByCollision = hoveredCollision != null &&
    collisions.some(
      (c) => c.id === hoveredCollision && c.involvedElements.includes(data.id),
    )

  const color = isHoveredByCollision
    ? "#ff4444"
    : isColliding
      ? "#ff8800"
      : isSelected
        ? "#c41e3a"
        : hovered
          ? "#666680"
          : "#4a4a5a"

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedElement({ type: "lightBar", id: data.id })
  }

  return (
    <group
      ref={ref}
      position={[data.position.x, data.position.y, data.position.z]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh castShadow>
        <boxGeometry args={[data.length, 0.12, 0.12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.7}
          emissive={isSelected ? "#c41e3a" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {data.name && (
        <sprite position={[0, 0.4, 0]} scale={[1.5, 0.5, 1]}>
          <spriteMaterial color="#aaaacc" opacity={0.8} transparent />
        </sprite>
      )}
    </group>
  )
}
