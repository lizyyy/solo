import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'

interface COGMarkerProps {
  cog: { x: number; y: number; z: number }
  cogLimit: { radius: number }
  sculptureId: string
  onDrag: (id: string, cog: { x: number; y: number; z: number }) => void
}

export default function COGMarker({ cog, cogLimit, sculptureId, onDrag }: COGMarkerProps) {
  const sphereRef = useRef<THREE.Mesh>(null)
  const [dragging, setDragging] = useState(false)
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const intersection = useRef(new THREE.Vector3())
  const { camera, gl } = useThree()

  const getWorldPos = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      raycaster.ray.intersectPlane(dragPlane.current, intersection.current)
      return intersection.current.clone()
    },
    [camera, gl]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return
      const pos = getWorldPos(e.clientX, e.clientY)
      if (pos) {
        onDrag(sculptureId, { x: pos.x, y: cog.y, z: pos.z })
      }
    },
    [dragging, getWorldPos, onDrag, sculptureId, cog.y]
  )

  const onPointerUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    gl.domElement.style.cursor = 'auto'
  }, [dragging, gl])

  useEffect(() => {
    const el = gl.domElement
    el.addEventListener('pointermove', onPointerMove as EventListener)
    el.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('pointermove', onPointerMove as EventListener)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp, gl.domElement])

  const onPointerDown = useCallback(
    (e: ThreeEvent) => {
      e.stopPropagation()
      setDragging(true)
      gl.domElement.style.cursor = 'grabbing'
    },
    [gl]
  )

  const dashedLinePoints = useMemo(
    () => [
      [cog.x, 0, cog.z] as [number, number, number],
      [cog.x, cog.y, cog.z] as [number, number, number],
    ],
    [cog.x, cog.y, cog.z]
  )

  return (
    <group>
      <mesh
        ref={sphereRef}
        position={[cog.x, cog.y, cog.z]}
        onPointerDown={onPointerDown as never}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="red" emissive="red" emissiveIntensity={0.5} />
      </mesh>

      <Line
        points={dashedLinePoints}
        color="red"
        dashed
        dashSize={0.1}
        gapSize={0.05}
        lineWidth={1}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cog.x, 0.01, cog.z]}>
        <ringGeometry args={[cogLimit.radius - 0.02, cogLimit.radius + 0.02, 64]} />
        <meshBasicMaterial color="orangered" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      <Html position={[cog.x, cog.y + 0.3, cog.z]} center>
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            color: '#ff4444',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          重心
        </div>
      </Html>
    </group>
  )
}

type ThreeEvent = { stopPropagation: () => void }
