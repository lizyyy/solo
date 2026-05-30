import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useStore } from '../../store/useStore'

export default function BatteryMarkers() {
  const showBattery = useStore((s) => s.showBattery)
  const batteryConfig = useStore((s) => s.batteryConfig)
  const trajectories = useStore((s) => s.trajectories)
  const filterState = useStore((s) => s.filterState)

  const filteredTrajectories = useMemo(
    () =>
      trajectories.filter((t) => {
        if (!filterState.statusFilter.includes(t.status)) return false
        if (filterState.robotIds.length > 0 && !filterState.robotIds.includes(t.robotId))
          return false
        return true
      }),
    [trajectories, filterState],
  )

  const markers = useMemo(() => {
    const result: {
      x: number
      y: number
      z: number
      battery: number
      isDrop: boolean
      trajectoryId: string
    }[] = []

    if (!showBattery) return result

    for (const traj of filteredTrajectories) {
      for (let i = 0; i < traj.points.length; i++) {
        const pt = traj.points[i]
        if (pt.batteryLevel < batteryConfig.lowThreshold) {
          const isDrop =
            i > 0 &&
            traj.points[i - 1].batteryLevel - pt.batteryLevel >= batteryConfig.dropThreshold
          result.push({
            x: pt.x,
            y: 0.5,
            z: pt.z,
            battery: pt.batteryLevel,
            isDrop,
            trajectoryId: traj.id,
          })
        }
      }
    }

    return result
  }, [showBattery, filteredTrajectories, batteryConfig])

  if (!showBattery) return null

  return (
    <group>
      {markers.map((marker, i) => (
        <BatteryPoint key={`${marker.trajectoryId}-${i}`} marker={marker} />
      ))}
    </group>
  )
}

function BatteryPoint({
  marker,
}: {
  marker: { x: number; y: number; z: number; battery: number; isDrop: boolean }
}) {
  const ratio = Math.max(marker.battery / 20, 0)
  const r = 1 - ratio
  const g = ratio * 0.8
  const color = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, 0)`

  return (
    <group position={[marker.x, marker.y, marker.z]}>
      <mesh>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      {marker.isDrop && <FlashingWarning />}
      <Html
        center
        position={[0, 0.5, 0]}
        style={{
          color: '#ff8c00',
          fontSize: '10px',
          fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.7)',
          padding: '1px 4px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {marker.battery.toFixed(0)}%
      </Html>
    </group>
  )
}

function FlashingWarning() {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = (Math.sin(clock.getElapsedTime() * 5) + 1) / 2
      ;(ref.current.material as THREE.MeshBasicMaterial).opacity = t
    }
  })

  return (
    <mesh position={[0, 0.4, 0]} ref={ref}>
      <octahedronGeometry args={[0.15]} />
      <meshBasicMaterial color="#ff0000" transparent opacity={1} />
    </mesh>
  )
}
