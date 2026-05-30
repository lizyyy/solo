import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useCubeStore } from '@/store/useCubeStore'

export default function TyphoonPath() {
  const flowRef = useRef<THREE.Points>(null)
  const parameters = useCubeStore(s => s.parameters)
  const pathPoints = useCubeStore(s => s.typhoonPathPoints)

  const curvePoints = useMemo(() => {
    const filtered = pathPoints.filter(p => p.typhoonId === parameters.typhoonId)
    if (filtered.length < 2) return []

    const timeStart = parameters.timeRange[0]
    const timeEnd = parameters.timeRange[1]
    const timeSpan = timeEnd - timeStart || 1

    return filtered.map(p => {
      const t = (new Date(p.timestamp).getTime() - timeStart) / timeSpan
      const regionIdx = filtered.indexOf(p) / filtered.length
      const x = (regionIdx - 0.5) * 7
      const y = t * 8
      const z = (p.windSpeed / 200) * 3 - 1.5
      return new THREE.Vector3(x, y, z)
    })
  }, [pathPoints, parameters.typhoonId, parameters.timeRange])

  const curve = useMemo(() => {
    if (curvePoints.length < 2) return null
    return new THREE.CatmullRomCurve3(curvePoints)
  }, [curvePoints])

  const flowPositions = useMemo(() => {
    if (!curve) return new Float32Array(0)
    const count = 60
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const pt = curve.getPoint(t)
      arr[i * 3] = pt.x
      arr[i * 3 + 1] = pt.y
      arr[i * 3 + 2] = pt.z
    }
    return arr
  }, [curve])

  useFrame(({ clock }) => {
    if (flowRef.current && curve) {
      const positions = flowRef.current.geometry.attributes.position.array as Float32Array
      const time = clock.getElapsedTime()
      const count = positions.length / 3
      for (let i = 0; i < count; i++) {
        const baseT = i / (count - 1)
        const t = (baseT + time * 0.03) % 1
        const pt = curve.getPoint(t)
        positions[i * 3] = pt.x
        positions[i * 3 + 1] = pt.y
        positions[i * 3 + 2] = pt.z
      }
      flowRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  if (!curve || curvePoints.length < 2) return null

  const linePoints = curvePoints.map(p => [p.x, p.y, p.z] as [number, number, number])

  return (
    <group>
      <Line
        points={linePoints}
        color="#00D4FF"
        lineWidth={2}
        transparent
        opacity={0.7}
      />

      <points ref={flowRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={flowPositions.length / 3}
            array={flowPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#00D4FF"
          size={0.12}
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  )
}
