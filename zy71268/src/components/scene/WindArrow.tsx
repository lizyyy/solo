import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface WindLoad {
  direction: { x: number; z: number }
  forceKN: number
  designDirection: { x: number; z: number }
}

interface WindArrowProps {
  windLoad: WindLoad
}

function ArrowHelper3D({
  origin,
  direction,
  length,
  color,
  headLength,
  headWidth,
}: {
  origin: THREE.Vector3
  direction: THREE.Vector3
  length: number
  color: string
  headLength: number
  headWidth: number
}) {
  const arrow = useMemo(() => {
    const dir = direction.clone().normalize()
    return new THREE.ArrowHelper(dir, origin, length, color, headLength, headWidth)
  }, [origin, direction, length, color, headLength, headWidth])

  return <primitive object={arrow} />
}

export default function WindArrow({ windLoad }: WindArrowProps) {
  const actualLength = windLoad.forceKN * 0.05
  const designForceEstimate = windLoad.forceKN * 0.7
  const designLength = designForceEstimate * 0.05

  const actualDir = useMemo(
    () => new THREE.Vector3(windLoad.direction.x, 0, windLoad.direction.z).normalize(),
    [windLoad.direction]
  )

  const designDir = useMemo(
    () => new THREE.Vector3(windLoad.designDirection.x, 0, windLoad.designDirection.z).normalize(),
    [windLoad.designDirection]
  )

  const origin = useMemo(() => new THREE.Vector3(0, 0.1, 0), [])

  const labelPos = useMemo(() => {
    const tip = origin.clone().add(actualDir.clone().multiplyScalar(actualLength + 0.3))
    return tip
  }, [origin, actualDir, actualLength])

  return (
    <group>
      <ArrowHelper3D
        origin={origin}
        direction={actualDir}
        length={actualLength}
        color="#ff8800"
        headLength={0.2}
        headWidth={0.1}
      />
      <ArrowHelper3D
        origin={origin}
        direction={designDir}
        length={designLength}
        color="#66cc66"
        headLength={0.15}
        headWidth={0.07}
      />
      <Html position={[labelPos.x, labelPos.y + 0.3, labelPos.z]} center>
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            color: '#ff8800',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {windLoad.forceKN.toFixed(1)} kN
        </div>
      </Html>
    </group>
  )
}
