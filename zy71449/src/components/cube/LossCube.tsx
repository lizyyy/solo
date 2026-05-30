import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useCubeStore } from '@/store/useCubeStore'
import CubeFrame from './CubeFrame'
import TyphoonPath from './TyphoonPath'
import PolicyBars from './PolicyBars'
import ClaimMarkers from './ClaimMarkers'
import AnomalyMarkers from './AnomalyMarkers'

function SceneContent() {
  const parameters = useCubeStore(s => s.parameters)

  return (
    <>
      <PerspectiveCamera makeDefault position={[15, 12, 15]} fov={45} />
      <OrbitControls
        target={[0, 4, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={30}
      />

      <ambientLight color="#1a2a4a" intensity={0.6} />
      <directionalLight color="#00d4ff" intensity={0.8} position={[10, 15, 10]} />
      <pointLight color="#FF6B35" intensity={0.5} position={[0, 8, 0]} />

      <CubeFrame />

      {parameters.showTyphoonPath && <TyphoonPath />}
      {parameters.showPolicyDistribution && <PolicyBars />}
      {parameters.showClaims && <ClaimMarkers />}
      <AnomalyMarkers />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#0A1628" transparent opacity={0.8} />
      </mesh>

      <gridHelper args={[12, 24, '#0d2847', '#0d2847']} position={[0, 0, 0]} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.4}
          luminanceSmoothing={0.6}
          intensity={0.8}
        />
      </EffectComposer>
    </>
  )
}

export default function LossCube() {
  return (
    <div className="w-full h-full bg-[#060E1A]">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center text-[#00D4FF] text-sm font-mono">
          加载3D场景...
        </div>
      }>
        <Canvas
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
          style={{ background: '#060E1A' }}
        >
          <SceneContent />
        </Canvas>
      </Suspense>
    </div>
  )
}
