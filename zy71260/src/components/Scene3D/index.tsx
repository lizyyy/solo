import { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import StarsBackground from './StarsBackground';
import CustomAxesHelper from './AxesHelper';
import ModeNode from './ModeNode';
import ModulationLine from './ModulationLine';
import { useAppStore, useFilteredModes, useFilteredPaths } from '../../store/useAppStore';
import type { Mode } from '../../types';

interface CameraControllerProps {
  autoRotate: boolean;
}

const CameraController = ({ autoRotate }: CameraControllerProps) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={10}
      maxDistance={50}
      makeDefault
    />
  );
};

interface SceneContentProps {
  onSelectMode: (mode: Mode) => void;
}

const SceneContent = ({ onSelectMode }: SceneContentProps) => {
  const modes = useFilteredModes();
  const paths = useFilteredPaths();
  const selectedModeId = useAppStore((state) => state.selectedModeId);
  const highlightedPathId = useAppStore((state) => state.highlightedPathId);
  const setHighlightedPath = useAppStore((state) => state.setHighlightedPath);
  const currentAudioId = useAppStore((state) => state.currentAudioId);
  const autoRotate = useAppStore((state) => state.autoRotate);

  const handlePathHover = (pathId: string | null) => {
    setHighlightedPath(pathId);
  };

  return (
    <>
      <CameraController autoRotate={autoRotate} />
      
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4ecdc4" />
      <directionalLight position={[0, 15, 0]} intensity={0.8} color="#ffe66d" />

      <StarsBackground count={3000} />
      <CustomAxesHelper size={12} />

      <fog attach="fog" args={['#0a1628', 20, 60]} />

      {paths.map((path) => (
        <ModulationLine
          key={path.id}
          path={path}
          fromMode={modes.find((m) => m.id === path.fromModeId)}
          toMode={modes.find((m) => m.id === path.toModeId)}
          isHighlighted={highlightedPathId === path.id || 
            (selectedModeId && (path.fromModeId === selectedModeId || path.toModeId === selectedModeId))}
          onHover={handlePathHover}
        />
      ))}

      {modes.map((mode) => (
        <ModeNode
          key={mode.id}
          mode={mode}
          isSelected={selectedModeId === mode.id}
          isPlaying={mode.audioSampleId === currentAudioId}
          onSelect={onSelectMode}
        />
      ))}

      <Effects>
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette offset={0.3} darkness={0.5} />
        </EffectComposer>
      </Effects>
    </>
  );
};

interface Scene3DProps {
  onSelectMode: (mode: Mode) => void;
}

const Scene3D = ({ onSelectMode }: Scene3DProps) => {
  return (
    <Canvas
      camera={{ position: [15, 10, 15], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a1628' }}
    >
      <SceneContent onSelectMode={onSelectMode} />
    </Canvas>
  );
};

export default Scene3D;
