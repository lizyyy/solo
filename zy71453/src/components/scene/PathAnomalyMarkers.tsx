import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useStore } from '../../store/useStore'

interface ParsedSegment {
  start: [number, number, number]
  end: [number, number, number]
  mid: [number, number, number]
}

function parseAnomalyRawValue(rawValue: string | undefined): ParsedSegment | null {
  if (!rawValue) return null
  try {
    const data = JSON.parse(rawValue)
    if (data.start && data.end) {
      return {
        start: [data.start.x ?? 0, 0.5, data.start.z ?? 0],
        end: [data.end.x ?? 0, 0.5, data.end.z ?? 0],
        mid: [
          ((data.start.x ?? 0) + (data.end.x ?? 0)) / 2,
          0.5,
          ((data.start.z ?? 0) + (data.end.z ?? 0)) / 2,
        ],
      }
    }
    if (data.x !== undefined && data.z !== undefined) {
      return {
        start: [data.x - 0.5, 0.5, data.z - 0.5],
        end: [data.x + 0.5, 0.5, data.z + 0.5],
        mid: [data.x, 0.5, data.z],
      }
    }
  } catch {
    const coordMatch = rawValue.match(/(-?\d+\.?\d*)/g)
    if (coordMatch && coordMatch.length >= 2) {
      const x = parseFloat(coordMatch[0])
      const z = parseFloat(coordMatch[1])
      return {
        start: [x - 0.5, 0.5, z - 0.5],
        end: [x + 0.5, 0.5, z + 0.5],
        mid: [x, 0.5, z],
      }
    }
  }
  return null
}

export default function PathAnomalyMarkers() {
  const showAnomalyMarkers = useStore((s) => s.showAnomalyMarkers)
  const anomalies = useStore((s) => s.anomalies)

  if (!showAnomalyMarkers) return null

  const pathAnomalies = anomalies.filter((a) => a.type === 'path_through_shelf')

  return (
    <group>
      {pathAnomalies.map((anomaly) => {
        const segment = parseAnomalyRawValue(anomaly.source.rawValue)
        if (!segment) return null
        return (
          <AnomalyMarker
            key={anomaly.id}
            segment={segment}
            description={anomaly.description}
          />
        )
      })}
    </group>
  )
}

function AnomalyMarker({
  segment,
  description,
}: {
  segment: ParsedSegment
  description: string
}) {
  const sphereRef = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    if (sphereRef.current) {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.3
      sphereRef.current.scale.set(scale, scale, scale)
    }
  })

  return (
    <group>
      <mesh position={segment.mid} ref={sphereRef}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.7} />
      </mesh>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([...segment.start, ...segment.end])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ff0000" linewidth={2} />
      </line>
      <Html
        position={[segment.mid[0], segment.mid[1] + 0.8, segment.mid[2]]}
        center
        style={{
          color: '#ff4444',
          fontSize: '10px',
          fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.75)',
          padding: '2px 6px',
          borderRadius: '3px',
          border: '1px solid #ff4444',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        ⚠ {description}
      </Html>
    </group>
  )
}
