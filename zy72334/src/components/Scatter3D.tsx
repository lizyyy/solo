import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore } from '@/store/useStore'

function NormalPoints({ data }: { data: number[][] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!meshRef.current) return
    for (let i = 0; i < data.length; i++) {
      const m = new THREE.Matrix4()
      m.setPosition(data[i][0], data[i][1], data[i][2] ?? 0)
      meshRef.current.setMatrixAt(i, m)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [data])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.length]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshStandardMaterial color="#b0d4f1" transparent opacity={0.6} />
    </instancedMesh>
  )
}

function AnomalyPoint({
  position,
  recordId,
}: {
  position: [number, number, number]
  recordId: string
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const selectAnomaly = useStore(s => s.selectAnomaly)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const s = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.1
    meshRef.current.scale.set(s, s, s)
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={e => {
        e.stopPropagation()
        selectAnomaly(recordId)
      }}
    >
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial
        color="#f0a500"
        emissive="#f0a500"
        emissiveIntensity={0.8}
      />
    </mesh>
  )
}

function AnomalyPoints() {
  const anomalyPoints = useStore(s => s.anomalyPoints)
  return (
    <>
      {anomalyPoints.map(ap => (
        <AnomalyPoint
          key={ap.recordId}
          position={ap.projectedCoords}
          recordId={ap.recordId}
        />
      ))}
    </>
  )
}

function Scene() {
  const projectedData = useStore(s => s.svdResult!.projectedData)

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <NormalPoints data={projectedData} />
      <AnomalyPoints />
      <Grid
        args={[20, 20]}
        position={[0, -3, 0]}
        cellColor="#1a5276"
        sectionColor="#1a5276"
        fadeDistance={30}
        fadeStrength={1}
        cellSize={1}
        sectionSize={5}
      />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </>
  )
}

export default function Scatter3D() {
  const svdResult = useStore(s => s.svdResult)

  if (!svdResult) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-indigo-800 bg-indigo-950">
        <p className="text-gray-400">请先导入数据并补全评分权重</p>
      </div>
    )
  }

  return (
    <div className="min-h-[400px] overflow-hidden rounded-lg border border-indigo-800">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        style={{ background: '#0a0a1a' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
