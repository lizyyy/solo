import { useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Instances, Instance, Html } from '@react-three/drei'
import type { GradientPoint, VectorFieldConfig, SurfaceConfig } from '@/types'

const MAX_ARROWS = 400
const SHAFT_RADIUS = 0.025
const CONE_RADIUS = 0.055
const CONE_HEIGHT = 0.12
const Z_OFFSET = 0.08
const MIN_ARROW_LENGTH = 0.05

const COLOR_BLUE = new THREE.Color('#2196f3')
const COLOR_CYAN = new THREE.Color('#4fc3f7')

interface ArrowData {
  shaftPosition: [number, number, number]
  conePosition: [number, number, number]
  rotation: [number, number, number]
  shaftScale: [number, number, number]
  coneScale: [number, number, number]
  color: string
  dx: number
  dy: number
  magnitude: number
  tooltipPosition: [number, number, number]
}

function computeArrows(
  field: GradientPoint[],
  arrowScale: number,
  colorByMagnitude: boolean
): ArrowData[] {
  if (field.length === 0) return []

  let minMag = Infinity
  let maxMag = -Infinity
  for (const p of field) {
    if (p.magnitude < minMag) minMag = p.magnitude
    if (p.magnitude > maxMag) maxMag = p.magnitude
  }
  const magRange = maxMag - minMag || 1

  const tempColor = new THREE.Color()
  const defaultDir = new THREE.Vector3(0, 1, 0)
  const results: ArrowData[] = []

  for (const point of field) {
    const base = new THREE.Vector3(point.x, point.z + Z_OFFSET, point.y)
    const dirVec = new THREE.Vector3(point.dx, 0, point.dy)
    const len = dirVec.length()
    if (len < 1e-8) continue

    const normalized = dirVec.normalize()
    const totalLength = Math.max(len * arrowScale, MIN_ARROW_LENGTH)
    const shaftLength = Math.max(totalLength - CONE_HEIGHT, MIN_ARROW_LENGTH)

    const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultDir, normalized)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)
    const rotation: [number, number, number] = [euler.x, euler.y, euler.z]

    const shaftCenter = base.clone().addScaledVector(normalized, shaftLength / 2)
    const coneCenter = base.clone().addScaledVector(normalized, shaftLength + CONE_HEIGHT / 2)

    let color: string
    if (!colorByMagnitude) {
      color = '#4fc3f7'
    } else {
      const t = (point.magnitude - minMag) / magRange
      tempColor.copy(COLOR_BLUE).lerp(COLOR_CYAN, t)
      color = '#' + tempColor.getHexString()
    }

    results.push({
      shaftPosition: [shaftCenter.x, shaftCenter.y, shaftCenter.z],
      conePosition: [coneCenter.x, coneCenter.y, coneCenter.z],
      rotation,
      shaftScale: [1, shaftLength, 1],
      coneScale: [1, CONE_HEIGHT, 1],
      color,
      dx: point.dx,
      dy: point.dy,
      magnitude: point.magnitude,
      tooltipPosition: [point.x, point.z + Z_OFFSET + totalLength + 0.15, point.y],
    })
  }

  return results
}

interface VectorFieldProps {
  field: GradientPoint[]
  config: VectorFieldConfig
  surfaceConfig: SurfaceConfig
}

export default function VectorField({ field, config, surfaceConfig }: VectorFieldProps) {
  const [hoveredIndex, setHoveredIndex] = useState(-1)

  const sampledField = useMemo(() => {
    if (field.length <= MAX_ARROWS) return field
    const step = field.length / MAX_ARROWS
    const result: GradientPoint[] = []
    for (let i = 0; i < MAX_ARROWS; i++) {
      result.push(field[Math.floor(i * step)])
    }
    return result
  }, [field])

  const arrows = useMemo(
    () => computeArrows(sampledField, config.arrowScale, config.colorByMagnitude),
    [sampledField, config.arrowScale, config.colorByMagnitude]
  )

  const handlePointerOver = useCallback(
    (index: number) => (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      setHoveredIndex(index)
    },
    []
  )

  const handlePointerOut = useCallback(() => {
    setHoveredIndex(-1)
  }, [])

  if (!config.showArrows || arrows.length === 0) return null

  return (
    <group>
      <Instances limit={MAX_ARROWS}>
        <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, 1, 6]} />
        <meshStandardMaterial />
        {arrows.map((a, i) => (
          <Instance
            key={i}
            position={a.shaftPosition}
            rotation={a.rotation}
            scale={a.shaftScale}
            color={a.color}
            onPointerOver={handlePointerOver(i)}
            onPointerOut={handlePointerOut}
          />
        ))}
      </Instances>

      <Instances limit={MAX_ARROWS}>
        <coneGeometry args={[CONE_RADIUS, 1, 6]} />
        <meshStandardMaterial />
        {arrows.map((a, i) => (
          <Instance
            key={i}
            position={a.conePosition}
            rotation={a.rotation}
            scale={a.coneScale}
            color={a.color}
            onPointerOver={handlePointerOver(i)}
            onPointerOut={handlePointerOut}
          />
        ))}
      </Instances>

      {hoveredIndex >= 0 && hoveredIndex < arrows.length && (
        <Html
          position={arrows[hoveredIndex].tooltipPosition}
          style={{
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div>dx: {arrows[hoveredIndex].dx.toFixed(3)}</div>
          <div>dy: {arrows[hoveredIndex].dy.toFixed(3)}</div>
          <div>|∇f|: {arrows[hoveredIndex].magnitude.toFixed(3)}</div>
        </Html>
      )}
    </group>
  )
}
