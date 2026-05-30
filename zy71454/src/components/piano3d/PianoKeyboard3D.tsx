import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import usePianoStore from '../../store/usePianoStore';
import PianoKey3D from './PianoKey3D';

function PianoScene() {
  const { keys, selectedKey, viewMode, setSelectedKey, getFilteredKeys } = usePianoStore();
  const filteredKeys = useMemo(() => new Set(getFilteredKeys().map(k => k.keyNumber)), [getFilteredKeys]);

  const keyPositions = useMemo(() => {
    const positions: Map<number, [number, number, number]> = new Map();
    let whiteKeyIndex = 0;
    const whiteKeyWidth = 1;
    const blackKeyWidth = 0.6;
    
    const blackKeyOffsets: { [key: string]: number } = {
      'C#': 0.45,
      'D#': 1.55,
      'F#': 3.45,
      'G#': 4.55,
      'A#': 5.55,
    };

    const octaveWhiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    
    keys.forEach(key => {
      const octave = key.octave;
      const noteBase = key.noteName.replace(/\d/g, '');
      
      if (!key.isBlack) {
        const octaveOffset = (octave - 1) * 7;
        const noteOffset = octaveWhiteNotes.indexOf(noteBase);
        const x = (octaveOffset + noteOffset) * whiteKeyWidth;
        positions.set(key.keyNumber, [x, 0, 0]);
        whiteKeyIndex++;
      }
    });

    keys.forEach(key => {
      if (key.isBlack) {
        const noteBase = key.noteName.replace(/\d/g, '');
        const octave = key.octave;
        const octaveStart = (octave - 1) * 7;
        
        let offset = blackKeyOffsets[noteBase];
        if (offset !== undefined) {
          const x = octaveStart * whiteKeyWidth + offset;
          positions.set(key.keyNumber, [x, 0.5, -1]);
        }
      }
    });

    return positions;
  }, [keys]);

  const totalWidth = 52 * 1;
  const centerOffset = -totalWidth / 2;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} />
      <pointLight position={[0, 15, 0]} intensity={0.8} color="#fff5e6" />
      
      <mesh position={[centerOffset + totalWidth / 2, -1, -5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 20]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.8} />
      </mesh>

      <group position={[centerOffset + 1.5, 0, 0]}>
        {keys.map(key => {
          const position = keyPositions.get(key.keyNumber);
          if (!position) return null;
          
          return (
            <PianoKey3D
              key={key.keyNumber}
              keyData={key}
              position={position}
              isSelected={selectedKey === key.keyNumber}
              viewMode={viewMode}
              onClick={() => setSelectedKey(key.keyNumber)}
              isFiltered={filteredKeys.has(key.keyNumber)}
            />
          );
        })}
      </group>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        minDistance={15}
        maxDistance={50}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        target={new THREE.Vector3(centerOffset + totalWidth / 2, 0, 0)}
      />
      
      <Environment preset="city" />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={0.5} />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
      </EffectComposer>
    </>
  );
}

export default function PianoKeyboard3D() {
  return (
    <Canvas
      camera={{ position: [25, 20, 35], fov: 45 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'linear-gradient(180deg, #1a1a1e 0%, #0d0d0d 100%)' }}
    >
      <PianoScene />
    </Canvas>
  );
}
