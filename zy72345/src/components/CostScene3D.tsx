import { useRef, useState, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import type { CostAllocationResult } from '@/store'
import * as THREE from 'three'

function DataPointMesh({ result, index, onClick }: { result: CostAllocationResult; index: number; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  const cost = Math.abs(result.allocatedCost)
  const baseSize = Math.max(0.15, Math.min(0.6, cost / 500))
  const size = hovered ? baseSize * 1.3 : baseSize

  const x = (index % 20) - 10
  const y = cost / 200
  const z = (Math.floor(index / 20) % 10) - 5

  useFrame(() => {
    if (meshRef.current && result.isBoundary) {
      meshRef.current.rotation.y += 0.01
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[x, y, z]}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial
        color={result.isBoundary ? '#ef4444' : '#475569'}
        emissive={result.isBoundary ? '#ef4444' : '#1e293b'}
        emissiveIntensity={result.isBoundary ? 0.6 : 0.1}
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
  )
}

function AnomalyLight({ result, index }: { result: CostAllocationResult; index: number }) {
  const x = (index % 20) - 10
  const cost = Math.abs(result.allocatedCost)
  const y = cost / 200
  const z = (Math.floor(index / 20) % 10) - 5

  return <pointLight position={[x, y + 1, z]} color="#ef4444" intensity={2} distance={5} />
}

function Scene({ results, onSelect }: { results: CostAllocationResult[]; onSelect: (r: CostAllocationResult) => void }) {
  const boundaryResults = results.map((r, i) => ({ result: r, index: i })).filter(({ result }) => result.isBoundary)

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <directionalLight position={[-5, -3, -5]} intensity={0.2} />
      {boundaryResults.slice(0, 10).map(({ result, index }) => (
        <AnomalyLight key={result.id} result={result} index={index} />
      ))}
      {results.map((r, i) => (
        <DataPointMesh key={r.id} result={r} index={i} onClick={() => onSelect(r)} />
      ))}
      <OrbitControls enableDamping dampingFactor={0.05} minDistance={3} maxDistance={50} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.3} intensity={0.8} />
      </EffectComposer>
    </>
  )
}

function FallbackScene() {
  return (
    <div className="w-full h-full flex items-center justify-center text-slate-500">
      <p>3D 场景加载中...</p>
    </div>
  )
}

interface CostScene3DProps {
  results: CostAllocationResult[]
  onSelect: (result: CostAllocationResult) => void
}

export default function CostScene3D({ results, onSelect }: CostScene3DProps) {
  if (results.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500">
        <p>暂无计算结果数据</p>
      </div>
    )
  }

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden border border-slate-700/50">
      <Suspense fallback={<FallbackScene />}>
        <Canvas camera={{ position: [0, 10, 20], fov: 45 }} gl={{ antialias: true }}>
          <color attach="background" args={['#0f172a']} />
          <Scene results={results} onSelect={onSelect} />
        </Canvas>
      </Suspense>
    </div>
  )
}
