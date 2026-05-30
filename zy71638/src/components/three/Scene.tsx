import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { DrumKit3D } from './DrumKit3D';
import { useDrumKitStore } from '@/store/useDrumKitStore';

function SceneContent() {
  const { selectedMicId, selectedDrumId } = useDrumKitStore();
  
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-3, 4, -3]}
        intensity={0.5}
      />
      <pointLight
        position={[0, 3, 0]}
        intensity={0.3}
        color="#f59e0b"
      />
      
      <DrumKit3D />
      
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />
      
      <Grid
        position={[0, 0.001, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
      
      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [3, 2.5, 3], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => {
        useDrumKitStore.getState().selectMicrophone(null);
        useDrumKitStore.getState().selectDrumPiece(null);
      }}
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 8, 20]} />
      
      <SceneContent />
      
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={1.5}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0.2}
      />
    </Canvas>
  );
}
