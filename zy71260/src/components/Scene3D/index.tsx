import { useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Effects, Line } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import StarsBackground from './StarsBackground';
import CustomAxesHelper from './AxesHelper';
import ModeNode from './ModeNode';
import ChordNode from './ChordNode';
import ModulationLine from './ModulationLine';
import { useAppStore, useFilteredModes, useFilteredPaths, useFilteredChords } from '../../store/useAppStore';
import type { Mode, Chord } from '../../types';

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
  onSelectChord: (chord: Chord) => void;
}

const SceneContent = ({ onSelectMode, onSelectChord }: SceneContentProps) => {
  const modes = useFilteredModes();
  const chords = useFilteredChords();
  const paths = useFilteredPaths();
  const selectedModeId = useAppStore((state) => state.selectedModeId);
  const selectedChordId = useAppStore((state) => state.selectedChordId);
  const highlightedPathId = useAppStore((state) => state.highlightedPathId);
  const setHighlightedPath = useAppStore((state) => state.setHighlightedPath);
  const currentAudioId = useAppStore((state) => state.currentAudioId);
  const autoRotate = useAppStore((state) => state.autoRotate);

  const handlePathHover = (pathId: string | null) => {
    setHighlightedPath(pathId);
  };

  const chordModeLines = useMemo(() => {
    const lines: Array<{
      id: string;
      points: [number, number, number][];
      color: string;
      opacity: number;
    }> = [];

    chords.forEach((chord) => {
      const mode = modes.find((m) => m.id === chord.modeId);
      if (mode) {
        const isHighlighted = selectedModeId === chord.modeId || selectedChordId === chord.id;
        lines.push({
          id: `line-${chord.id}-${chord.modeId}`,
          points: [
            [chord.position.x, chord.position.y, chord.position.z],
            [mode.position.x, mode.position.y, mode.position.z],
          ],
          color: mode.color,
          opacity: isHighlighted ? 0.6 : 0.2,
        });
      }
    });

    return lines;
  }, [chords, modes, selectedModeId, selectedChordId]);

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

      {chordModeLines.map((line) => (
        <Line
          key={line.id}
          points={line.points}
          color={line.color}
          lineWidth={1}
          transparent
          opacity={line.opacity}
          dashed
          dashSize={0.2}
          gapSize={0.1}
        />
      ))}

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

      {chords.map((chord) => (
        <ChordNode
          key={chord.id}
          chord={chord}
          isSelected={selectedChordId === chord.id}
          isPlaying={chord.audioSampleId === currentAudioId}
          onSelect={onSelectChord}
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
  onSelectChord: (chord: Chord) => void;
}

const Scene3D = ({ onSelectMode, onSelectChord }: Scene3DProps) => {
  return (
    <Canvas
      camera={{ position: [15, 10, 15], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a1628' }}
    >
      <SceneContent onSelectMode={onSelectMode} onSelectChord={onSelectChord} />
    </Canvas>
  );
};

export default Scene3D;
