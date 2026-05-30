import { useRef, useState, useEffect } from "react"
import { ThreeEvent, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { useStore } from "@/store/useStore"
import type { Fixture as FixtureType } from "@/types"

interface Props {
  data: FixtureType
}

export default function Fixture({ data }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const spotLightRef = useRef<THREE.SpotLight>(null)
  const spotTargetRef = useRef<THREE.Object3D>(null)
  const beamLineRef = useRef<THREE.Line>(null)
  const [hovered, setHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const selectedElement = useStore((s) => s.selectedElement)
  const setSelectedElement = useStore((s) => s.setSelectedElement)
  const updateFixturePosition = useStore((s) => s.updateFixturePosition)
  const updateFixtureTarget = useStore((s) => s.updateFixtureTarget)
  const collisions = useStore((s) => s.scene.collisions)
  const hoveredCollision = useStore((s) => s.hoveredCollision)

  const isSelected = selectedElement?.type === "fixture" && selectedElement.id === data.id
  const isColliding = collisions.some(
    (c) => !c.resolved && c.involvedElements.includes(data.id),
  )
  const isHoveredByCollision = hoveredCollision != null &&
    collisions.some(
      (c) => c.id === hoveredCollision && c.involvedElements.includes(data.id),
    )

  const fixtureColor = isHoveredByCollision
    ? "#ff4444"
    : isColliding
      ? "#ff8800"
      : isSelected
        ? "#c41e3a"
        : hovered
          ? "#8888aa"
          : data.type === "spotlight"
            ? "#d4af37"
            : data.type === "moving_head"
              ? "#00a8ff"
              : data.type === "fresnel"
                ? "#98d8c8"
                : "#ff6b6b"

  const fixtureHeight = 0.4
  const fixtureWidth = data.type === "moving_head" ? 0.25 : 0.2

  const lookAtTarget = new THREE.Vector3(
    data.targetPosition.x,
    data.targetPosition.y,
    data.targetPosition.z,
  )

  useEffect(() => {
    if (spotTargetRef.current) {
      spotTargetRef.current.position.set(
        data.targetPosition.x,
        data.targetPosition.y,
        data.targetPosition.z,
      )
    }
    if (beamLineRef.current) {
      const positions = new Float32Array([
        data.position.x, data.position.y - 0.2, data.position.z,
        data.targetPosition.x, data.targetPosition.y, data.targetPosition.z,
      ])
      beamLineRef.current.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      )
      beamLineRef.current.computeLineDistances()
    }
  }, [data.targetPosition, data.position])

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setSelectedElement({ type: "fixture", id: data.id })
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return
    e.stopPropagation()
    if (e.buttons !== 1) return

    const x = e.point.x
    const z = e.point.z
    const newPos = { x, y: data.position.y, z }

    if (Math.abs(x - data.position.x) > 0.05 || Math.abs(z - data.position.z) > 0.05) {
      updateFixturePosition(data.id, newPos)
    }
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (isDragging) {
      setIsDragging(false)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedElement({ type: "fixture", id: data.id })
  }

  useFrame(() => {
    if (groupRef.current && !isDragging) {
      groupRef.current.lookAt(lookAtTarget)
    }
    if (spotLightRef.current && spotTargetRef.current) {
      spotLightRef.current.target = spotTargetRef.current
    }
  })

  const beamColor = isColliding ? "#ff4444" : fixtureColor
  const beamOpacity = isSelected ? 0.8 : 0.3

  return (
    <>
      <group
        ref={groupRef}
        position={[data.position.x, data.position.y, data.position.z]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
        onClick={handleClick}
      >
        <mesh position={[0, 0, fixtureHeight / 2]}>
          <cylinderGeometry args={[fixtureWidth * 0.6, fixtureWidth * 0.8, fixtureHeight, 16]} />
          <meshStandardMaterial
            color={fixtureColor}
            roughness={0.3}
            metalness={0.7}
            emissive={isSelected ? fixtureColor : "#000000"}
            emissiveIntensity={isSelected ? 0.4 : 0}
          />
        </mesh>
        <mesh position={[0, 0, fixtureHeight * 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[fixtureWidth * 0.9, 0.3, 16]} />
          <meshStandardMaterial
            color="#1a1a1a"
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
        <mesh position={[0, 0, fixtureHeight + 0.15]}>
          <cylinderGeometry args={[fixtureWidth * 0.3, fixtureWidth * 0.6, 0.1, 16]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.3, 0.06, 0.3]} />
          <meshStandardMaterial color="#333340" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      <spotLight
        ref={spotLightRef}
        position={[data.position.x, data.position.y - 0.1, data.position.z]}
        angle={(data.beamAngle * Math.PI) / 180 / 2}
        penumbra={0.3}
        intensity={data.type === "spotlight" ? 30 : data.type === "moving_head" ? 40 : 15}
        distance={25}
        color={fixtureColor}
        castShadow
      />
      <object3D ref={spotTargetRef} position={[data.targetPosition.x, data.targetPosition.y, data.targetPosition.z]} />

      <primitive
        object={new THREE.Line()}
        ref={beamLineRef as React.MutableRefObject<THREE.Line>}
      >
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              data.position.x, data.position.y - 0.2, data.position.z,
              data.targetPosition.x, data.targetPosition.y, data.targetPosition.z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={beamColor}
          transparent
          opacity={beamOpacity}
          dashSize={0.3}
          gapSize={0.15}
        />
      </primitive>
    </>
  )
}
