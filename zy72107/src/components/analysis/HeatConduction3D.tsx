import { useRef, useState, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import * as THREE from "three"
import type { HeatConductionResult } from "@/types"

function tempToColor(temp: number, minT: number, maxT: number): THREE.Color {
  const ratio = Math.max(0, Math.min(1, (temp - minT) / (maxT - minT || 1)))
  const color = new THREE.Color()
  if (ratio < 0.33) {
    color.setRGB(ratio * 3 * 0.3, ratio * 3 * 0.4, 0.5 + ratio * 3 * 0.2)
  } else if (ratio < 0.66) {
    const t = (ratio - 0.33) * 3
    color.setRGB(0.3 + t * 0.6, 0.4 + t * 0.3, 0.7 - t * 0.6)
  } else {
    const t = (ratio - 0.66) * 3
    color.setRGB(0.9 + t * 0.1, 0.7 - t * 0.45, 0.1 - t * 0.08)
  }
  return color
}

interface RingMeshProps {
  innerRadius: number
  outerRadius: number
  color: THREE.Color
  temperature: number
  index: number
}

function RingMesh({ innerRadius, outerRadius, color, temperature, index }: RingMeshProps) {
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)

  const shape = useMemo(() => {
    const s = new THREE.Shape()
    const segments = 64
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const x = Math.cos(angle) * outerRadius
      const y = Math.sin(angle) * outerRadius
      if (i === 0) s.moveTo(x, y)
      else s.lineTo(x, y)
    }
    for (let i = segments; i >= 0; i--) {
      const angle = (i / segments) * Math.PI * 2
      const x = Math.cos(angle) * innerRadius
      const y = Math.sin(angle) * innerRadius
      s.lineTo(x, y)
    }
    return s
  }, [innerRadius, outerRadius])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = -Math.PI / 2
    }
  })

  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <extrudeGeometry args={[shape, { depth: 0.15, bevelEnabled: false }]} />
      <meshStandardMaterial
        color={color}
        emissive={hovered ? color : new THREE.Color(0x000000)}
        emissiveIntensity={hovered ? 0.4 : 0}
        transparent
        opacity={0.92}
      />
      {hovered && (
        <Html position={[0, 0.3, 0]} center distanceFactor={8}>
          <div className="bg-coffee-800 text-white px-3 py-1.5 rounded shadow-lg text-sm whitespace-nowrap pointer-events-none font-mono">
            节点 {index}: {temperature.toFixed(1)}°C
          </div>
        </Html>
      )}
    </mesh>
  )
}

interface BeanVisualizationProps {
  radialProfile: number[]
  progress: number
}

function BeanVisualization({ radialProfile, progress }: BeanVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null)
  const nodeCount = radialProfile.length

  const minT = Math.min(...radialProfile)
  const maxT = Math.max(...radialProfile)

  const interpolatedProfile = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i < nodeCount; i++) {
      const centerTemp = radialProfile[0]
      const targetTemp = radialProfile[i]
      result.push(centerTemp + (targetTemp - centerTemp) * progress)
    }
    return result
  }, [radialProfile, progress, nodeCount])

  const rings = useMemo(() => {
    const maxRadius = 1.2
    const items = []
    for (let i = nodeCount - 1; i >= 0; i--) {
      const outerR = maxRadius * ((i + 1) / nodeCount)
      const innerR = i === 0 ? 0 : maxRadius * (i / nodeCount)
      items.push({
        innerRadius: innerR,
        outerRadius: outerR,
        color: tempToColor(interpolatedProfile[i], minT, maxT),
        temperature: interpolatedProfile[i],
        index: i,
      })
    }
    return items
  }, [interpolatedProfile, minT, maxT, nodeCount])

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.05
    }
  })

  return (
    <group ref={groupRef} scale={[1.3, 0.85, 1]}>
      {rings.map((ring) => (
        <RingMesh key={ring.index} {...ring} />
      ))}
    </group>
  )
}

function PlaceholderBean() {
  return (
    <group>
      <mesh scale={[1.3, 0.85, 1]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#8B5E3C" transparent opacity={0.4} />
      </mesh>
      <Html center>
        <div className="bg-coffee-100 border border-coffee-300 text-coffee-700 px-4 py-2 rounded-lg shadow text-sm">
          请先选择记录并计算
        </div>
      </Html>
    </group>
  )
}

interface HeatConduction3DProps {
  result: HeatConductionResult | null
  progress: number
}

export default function HeatConduction3D({ result, progress }: HeatConduction3DProps) {
  return (
    <Canvas camera={{ position: [0, 2.5, 3], fov: 45 }}>
      <ambientLight intensity={0.5} color="#FFF3E0" />
      <directionalLight position={[5, 5, 3]} intensity={1.2} color="#FFAB40" />
      <directionalLight position={[-3, 2, -2]} intensity={0.3} color="#FFE0B2" />
      <OrbitControls enableDamping dampingFactor={0.05} minDistance={2} maxDistance={8} />
      {result ? (
        <>
          <BeanVisualization radialProfile={result.radialProfile} progress={progress} />
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.6}
              luminanceSmoothing={0.3}
              intensity={0.8}
            />
          </EffectComposer>
        </>
      ) : (
        <PlaceholderBean />
      )}
    </Canvas>
  )
}
