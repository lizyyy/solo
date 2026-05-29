import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { TuningFork } from './TuningFork';
import { ResonanceBox } from './ResonanceBox';
import { Microphone } from './Microphone';
import { SoundWaves } from './SoundWaves';
import type { TuningFork as TuningForkType, ResonanceBox as ResonanceBoxType, MicrophonePosition } from '../../types';

interface Scene3DProps {
  tuningFork: TuningForkType;
  resonanceBox: ResonanceBoxType;
  microphone: MicrophonePosition;
  isPlaying: boolean;
}

export function Scene3D({ tuningFork, resonanceBox, microphone, isPlaying }: Scene3DProps) {
  const micPosition: [number, number, number] = [
    microphone.x * 0.5,
    microphone.y * 0.3 + 0.5,
    microphone.z * 0.5 + 1.5,
  ];

  return (
    <Canvas
      camera={{ position: [2.5, 1.5, 2.5], fov: 50 }}
      shadows
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0A1628']} />
      <fog attach="fog" args={['#0A1628', 3, 8]} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 5, 3]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-2, 2, -2]} intensity={0.5} color="#00F5D4" />
      <pointLight position={[2, 1, 2]} intensity={0.3} color="#9D4EDD" />

      <Suspense fallback={null}>
        <TuningFork
          frequency={tuningFork.frequency}
          isPlaying={isPlaying}
          position={[0, 0.3, 0]}
        />

        <ResonanceBox
          length={resonanceBox.length}
          width={resonanceBox.width}
          height={resonanceBox.height}
          position={[0, -0.1, 0]}
        />

        <Microphone position={micPosition} isActive={isPlaying} />

        <SoundWaves
          frequency={tuningFork.frequency}
          isPlaying={isPlaying}
          position={[0, 0, 0]}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#081220" />
        </mesh>

        <ContactShadows
          position={[0, -0.49, 0]}
          opacity={0.5}
          scale={5}
          blur={2}
          far={4}
        />

        <Environment preset="city" />
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={1.5}
        maxDistance={6}
      />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
