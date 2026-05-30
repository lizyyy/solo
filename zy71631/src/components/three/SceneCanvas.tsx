import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import SeatMesh from './SeatMesh'
import SpeakerMesh from './SpeakerMesh'
import AnomalyMarkers from './AnomalyMarkers'

const SceneCanvas = () => {
  return (
    <Canvas
      gl={{ antialias: true }}
      camera={{ position: [0, 8, 12], fov: 50 }}
      style={{ background: '#0a0a12', width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={0.6} color="#cfe7ff" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#1a1a24" />
        </mesh>
        <SeatMesh />
        <SpeakerMesh />
        <AnomalyMarkers />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={0.8} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}

export default SceneCanvas
