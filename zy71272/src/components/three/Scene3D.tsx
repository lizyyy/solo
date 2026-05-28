import { useEffect } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import Room from './Room';
import MusicianObject from './MusicianObject';
import MicrophoneObject from './MicrophoneObject';
import MonitorPointObject from './MonitorPointObject';
import Heatmap from './Heatmap';

function CameraController() {
  const { camera } = useThree();
  const selectedObjectId = useStore(state => state.selectedObjectId);
  const musicians = useStore(state => state.musicians);
  const monitorPoints = useStore(state => state.monitorPoints);
  const microphones = useStore(state => state.microphones);
  const roomConfig = useStore(state => state.roomConfig);

  useEffect(() => {
    if (!selectedObjectId || !roomConfig) return;

    const musician = musicians.find(m => m.id === selectedObjectId);
    const monitor = monitorPoints.find(m => m.id === selectedObjectId);
    const mic = microphones.find(m => m.id === selectedObjectId);

    const target = musician?.position || monitor?.position || mic?.position;
    if (!target) return;

    const offset = new THREE.Vector3(2, 1.5, 2);
    const targetPos = new THREE.Vector3(target.x + offset.x, target.y + 1.5, target.z + offset.z);

    const startPos = camera.position.clone();
    const duration = 500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeT = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(startPos, targetPos, easeT);
      camera.lookAt(target.x, target.y + 1, target.z);

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [selectedObjectId, camera, musicians, monitorPoints, microphones, roomConfig]);

  return null;
}

function SceneContent() {
  const musicians = useStore(state => state.musicians);
  const microphones = useStore(state => state.microphones);
  const monitorPoints = useStore(state => state.monitorPoints);
  const selectObject = useStore(state => state.selectObject);
  const roomConfig = useStore(state => state.roomConfig);

  const handleSceneClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.eventObject === undefined) {
      selectObject(null, null);
    }
  };

  if (!roomConfig) return null;

  return (
    <group onClick={handleSceneClick}>
      <CameraController />

      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#00f0ff" />
      <pointLight position={[-4, 3, -2]} intensity={0.3} color="#ff6b35" />
      <pointLight position={[4, 3, 2]} intensity={0.3} color="#ff3366" />

      <Room />
      <Heatmap />

      {musicians.map(musician => (
        <MusicianObject key={musician.id} musician={musician} />
      ))}

      {microphones.map(mic => (
        <MicrophoneObject key={mic.id} microphone={mic} />
      ))}

      {monitorPoints.map(monitor => (
        <MonitorPointObject key={monitor.id} monitor={monitor} />
      ))}

      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette
          offset={0.3}
          darkness={0.5}
        />
      </EffectComposer>
    </group>
  );
}

export default function Scene3D() {
  const roomConfig = useStore(state => state.roomConfig);

  if (!roomConfig) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0e17]">
        <div className="text-[#00f0ff] text-xl animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <Canvas
      shadows
      camera={{ position: [8, 6, 8], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0e17' }}
    >
      <color attach="background" args={['#0a0e17']} />
      <fog attach="fog" args={['#0a0e17', 15, 30]} />

      <SceneContent />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={25}
        maxPolarAngle={Math.PI / 2 - 0.1}
        makeDefault
      />
    </Canvas>
  );
}
