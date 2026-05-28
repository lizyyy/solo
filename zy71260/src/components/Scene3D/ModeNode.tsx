import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { Mode } from '../../types';
import { QUALITY_COLORS } from '../../types';
import { getModeName } from '../../utils/musicTheory';

interface ModeNodeProps {
  mode: Mode;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: (mode: Mode) => void;
}

const ModeNode = ({ mode, isSelected, isPlaying, onSelect }: ModeNodeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const pulse = isPlaying ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15 : 1;
      const scale = (isSelected ? 1.3 : 1) * pulse;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      const glowIntensity = hovered || isSelected ? 0.6 : 0.2;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glowIntensity;
    }
  });

  const qualityColor = QUALITY_COLORS[mode.quality];
  const baseColor = mode.color;
  const finalColor = mode.quality === 'normal' ? baseColor : qualityColor;

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(mode);
  };

  return (
    <group position={[mode.position.x, mode.position.y, mode.position.z]}>
      <Float speed={isSelected ? 2 : 1} rotationIntensity={0.2} floatIntensity={isSelected ? 0.5 : 0.2}>
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
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial
            color={finalColor}
            emissive={finalColor}
            emissiveIntensity={hovered || isSelected ? 0.5 : 0.2}
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>

        <mesh ref={glowRef} scale={1.5}>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshBasicMaterial
            color={finalColor}
            transparent
            opacity={0.2}
            side={THREE.BackSide}
          />
        </mesh>

        {mode.quality !== 'normal' && (
          <mesh position={[0.5, 0.5, 0]}>
            <ringGeometry args={[0.15, 0.25, 32]} />
            <meshBasicMaterial
              color={qualityColor}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </Float>

      <Text
        position={[0, -1.2, 0]}
        fontSize={0.4}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {getModeName(mode.rootNote, mode.type)}
      </Text>
    </group>
  );
};

export default ModeNode;
