import { useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { ThreeEvent } from "@react-three/fiber"
import { useStore } from "@/store/useStore"
import type { Collision } from "@/types"

interface Props {
  collision: Collision
}

export default function CollisionHighlight({ collision }: Props) {
  const ref = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const setHoveredCollision = useStore((s) => s.setHoveredCollision)
  const setSelectedElement = useStore((s) => s.setSelectedElement)

  const { position, size, geometryType } = useMemo(() => {
    if (collision.type === "overload") {
      return {
        position: [collision.position.x, collision.position.y, collision.position.z],
        size: [1.2, 1.2, 1.2],
        geometryType: "box" as const,
      }
    } else if (collision.type === "route_collision") {
      return {
        position: [collision.position.x, collision.position.y, collision.position.z],
        size: [0.8, 0.8, 0.8],
        geometryType: "sphere" as const,
      }
    } else {
      return {
        position: [collision.position.x, collision.position.y, collision.position.z],
        size: [1.5, 0.6, 0.6],
        geometryType: "box" as const,
      }
    }
  }, [collision])

  const color = collision.severity === "critical" ? "#ff2222" : "#ffaa00"
  const opacity = hovered ? 0.5 : collision.resolved ? 0.15 : 0.3

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
    setHoveredCollision(collision.id)
  }

  const handlePointerOut = () => {
    setHovered(false)
    setHoveredCollision(null)
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (collision.involvedElements.length > 0) {
      const firstId = collision.involvedElements[0]
      if (collision.type === "overload") {
        setSelectedElement({ type: "hangingPoint", id: firstId })
      } else if (collision.type === "route_collision") {
        setSelectedElement({ type: "actorRoute", id: firstId })
      } else {
        setSelectedElement({ type: "fixture", id: firstId })
      }
    }
  }

  return (
    <mesh
      ref={ref}
      position={position as [number, number, number]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {geometryType === "box" ? (
        <boxGeometry args={size as [number, number, number]} />
      ) : (
        <sphereGeometry args={[size[0] / 2, 16, 16]} />
      )}
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        emissive={color}
        emissiveIntensity={hovered ? 0.8 : 0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
