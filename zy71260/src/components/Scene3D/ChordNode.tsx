import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { Chord } from '../../types';
import { QUALITY_COLORS, CHORD_FUNCTION_COLORS } from '../../types';
import { getChordFunctionName } from '../../utils/musicTheory';

interface ChordNodeProps {
  chord: Chord;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: (chord: Chord) => void;
}

const ChordNode = ({ chord, isSelected, isPlaying, onSelect }: ChordNodeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const pulse = isPlaying ? 1 + Math.sin(state.clock.elapsedTime * 5) * 0.2 : 1;
      const scale = (isSelected ? 1.4 : 1) * pulse;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      const glowIntensity = hovered || isSelected ? 0.7 : 0.15;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glowIntensity;
    }
  });

  const qualityColor = QUALITY_COLORS[chord.quality];
  const baseColor = CHORD_FUNCTION_COLORS[chord.function];
  const finalColor = chord.quality === 'normal' ? baseColor : qualityColor;

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(chord);
  };

  return (
    <group position={[chord.position.x, chord.position.y, chord.position.z]}>
      <Float speed={isSelected ? 2.5 : 1.2} rotationIntensity={0.3} floatIntensity={isSelected ? 0.6 : 0.3}>
        <mesh
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
        >
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial
            color={finalColor}
            emissive={finalColor}
            emissiveIntensity={hovered || isSelected ? 0.6 : 0.25}
            metalness={0.4}
            roughness={0.3}
            flatShading
          />
        </mesh>

        <mesh ref={glowRef} scale={1.8}>
          <octahedronGeometry args={[0.4, 0]} />
          <meshBasicMaterial
            color={finalColor}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>

        {chord.quality !== 'normal' && (
          <mesh position={[0.35, 0.35, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshBasicMaterial
              color={qualityColor}
            />
          </mesh>
        )}
      </Float>

      <Text
        position={[0, -0.9, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {chord.symbol}
      </Text>

      {(hovered || isSelected) && (
        <Text
          position={[0, 0.8, 0]}
          fontSize={0.25}
          color={baseColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {getChordFunctionName(chord.function)}
        </Text>
      )}
    </group>
  );
};

export default ChordNode;
