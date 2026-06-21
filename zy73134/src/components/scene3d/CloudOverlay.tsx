import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CLOUD_COUNT = 300

interface CloudData {
  baseX: number
  baseY: number
  baseZ: number
  speedX: number
  speedZ: number
  phase: number
}

export default function CloudOverlay() {
  const groupRef = useRef<THREE.Group>(null)

  const clouds = useMemo<CloudData[]>(() => {
    const arr: CloudData[] = []
    for (let i = 0; i < CLOUD_COUNT; i++) {
      arr.push({
        baseX: (Math.random() - 0.5) * 200,
        baseY: 15 + Math.random() * 35,
        baseZ: (Math.random() - 0.5) * 200,
        speedX: 0.02 + Math.random() * 0.03,
        speedZ: 0.01 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
      })
    }
    return arr
  }, [])

  const meshRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const mesh = meshRefs.current[i]
      const c = clouds[i]
      if (!mesh || !c) continue

      let nx = c.baseX + t * c.speedX
      let nz = c.baseZ + t * c.speedZ

      if (nx > 110) nx -= 220
      if (nx < -110) nx += 220
      if (nz > 110) nz -= 220
      if (nz < -110) nz += 220

      const ny = c.baseY + Math.sin(t * 0.3 + c.phase) * 0.5

      mesh.position.set(nx, ny, nz)
    }
  })

  return (
    <group ref={groupRef}>
      {clouds.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el
          }}
        >
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshStandardMaterial
            color="#8A94A6"
            transparent
            opacity={0.15}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
