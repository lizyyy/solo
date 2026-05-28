import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import ChipBody from './ChipBody';
import PinTowers from './PinTowers';

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, -5, 8], fov: 50 }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <color attach="background" args={['#0a0e17']} />
      <Suspense fallback={null}>
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 8]} intensity={1.2} color="#4488ff" />
        <pointLight position={[-5, -3, 6]} intensity={0.8} color="#ff4488" />
        <pointLight position={[0, 0, 10]} intensity={0.6} color="#ffffff" />

        <Grid
          position={[0, 0, -0.5]}
          args={[20, 20]}
          cellColor="#1a2040"
          sectionColor="#2a3060"
          fadeDistance={15}
          fadeStrength={1.5}
          cellSize={1}
          sectionSize={5}
          infiniteGrid
        />

        <ChipBody />
        <PinTowers />

        <EffectComposer>
          <Bloom
            intensity={0.8}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
          />
        </EffectComposer>

        <OrbitControls enableDamping />
      </Suspense>
    </Canvas>
  );
}
