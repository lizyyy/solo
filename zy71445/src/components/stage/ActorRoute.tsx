import { useMemo, useRef, useState, useEffect } from "react"
import * as THREE from "three"
import { ThreeEvent } from "@react-three/fiber"
import { useStore } from "@/store/useStore"
import type { ActorRoute as ActorRouteType } from "@/types"

interface Props {
  data: ActorRouteType
}

export default function ActorRoute({ data }: Props) {
  const routeLineRef = useRef<THREE.Line>(null)
  const selectedElement = useStore((s) => s.selectedElement)
  const setSelectedElement = useStore((s) => s.setSelectedElement)
  const collisions = useStore((s) => s.scene.collisions)
  const hoveredCollision = useStore((s) => s.hoveredCollision)
  const [hovered, setHovered] = useState(false)

  const isSelected = selectedElement?.type === "actorRoute" && selectedElement.id === data.id
  const isColliding = collisions.some(
    (c) => !c.resolved && c.involvedElements.includes(data.id),
  )
  const isHoveredByCollision = hoveredCollision != null &&
    collisions.some(
      (c) => c.id === hoveredCollision && c.involvedElements.includes(data.id),
    )

  const lineColor = isHoveredByCollision
    ? "#ff4444"
    : isColliding
      ? "#ff8800"
      : isSelected
        ? "#c41e3a"
        : hovered
          ? "#88ff88"
          : "#44ff44"

  useEffect(() => {
    if (routeLineRef.current) {
      routeLineRef.current.computeLineDistances()
    }
  }, [data.waypoints])

  const { linePositions, pointPositions, capsulePositions } = useMemo(() => {
    const positions: number[] = []
    const pointPos: number[] = []
    const capsulePos: number[] = []

    data.waypoints.forEach((wp) => {
      positions.push(wp.x, wp.y + 0.05, wp.z)
      pointPos.push(wp.x, wp.y + 0.08, wp.z)
    })

    const stepCount = 30
    for (let i = 0; i < data.waypoints.length - 1; i++) {
      const start = data.waypoints[i]
      const end = data.waypoints[i + 1]
      for (let s = 0; s <= stepCount; s++) {
        const t = s / stepCount
        const x = start.x + (end.x - start.x) * t
        const y = data.actorHeight / 2
        const z = start.z + (end.z - start.z) * t
        capsulePos.push(x, y, z)
      }
    }

    return {
      linePositions: new Float32Array(positions),
      pointPositions: new Float32Array(pointPos),
      capsulePositions: new Float32Array(capsulePos),
    }
  }, [data.waypoints, data.actorHeight])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedElement({ type: "actorRoute", id: data.id })
  }

  return (
    <group
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={capsulePositions.length / 3}
            array={capsulePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={lineColor}
          transparent
          opacity={isSelected ? 0.4 : 0.15}
        />
      </lineSegments>

      <primitive
        object={new THREE.Line()}
        ref={routeLineRef as React.MutableRefObject<THREE.Line>}
      >
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePositions.length / 3}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={lineColor}
          dashSize={0.4}
          gapSize={0.2}
          linewidth={3}
          transparent
          opacity={isSelected ? 1 : 0.7}
        />
      </primitive>

      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pointPositions.length / 3}
            array={pointPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={lineColor}
          size={0.25}
          transparent
          opacity={isSelected ? 1 : 0.8}
        />
      </points>

      {data.waypoints.map((wp, i) => (
        <mesh key={i} position={[wp.x, wp.y + 0.1, wp.z]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color={lineColor}
            emissive={lineColor}
            emissiveIntensity={isSelected ? 0.5 : 0.2}
          />
        </mesh>
      ))}
    </group>
  )
}
