import * as THREE from 'three'
import { useMemo } from 'react'
import { Stars } from '@react-three/drei'

export default function OceanFloor() {
  const gridHelper = useMemo(() => {
    const size = 200
    const divisions = 40
    const gridColor1 = new THREE.Color('#1E4976')
    const gridColor2 = new THREE.Color('#00D4AA')

    const halfSize = size / 2
    const step = size / divisions

    const positions: number[] = []
    const colors: number[] = []

    for (let i = 0; i <= divisions; i++) {
      const pos = -halfSize + i * step
      const isCenterLine = Math.abs(pos) < step * 0.5

      positions.push(-halfSize, 0, pos, halfSize, 0, pos)
      positions.push(pos, 0, -halfSize, pos, 0, halfSize)

      const color = isCenterLine ? gridColor2 : gridColor1
      for (let j = 0; j < 4; j++) {
        colors.push(color.r, color.g, color.b)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    return geometry
  }, [])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#0A2540"
          transparent
          opacity={0.85}
          wireframe={false}
        />
      </mesh>

      <lineSegments geometry={gridHelper}>
        <lineBasicMaterial vertexColors toneMapped={false} />
      </lineSegments>

      <Stars
        radius={300}
        depth={60}
        count={3000}
        factor={4}
        fade
      />

      <fogExp2 attach="fog" color="#041122" density={0.006} />
    </group>
  )
}
