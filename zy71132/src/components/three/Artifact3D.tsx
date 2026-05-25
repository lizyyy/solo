import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Artifact, ArtifactType } from '../../types';
import { useStore } from '../../store/useStore';

interface Artifact3DProps {
  artifact: Artifact;
  isFiltered: boolean;
  hasConflict: boolean;
}

const typeColors: Record<ArtifactType, string> = {
  pottery: '#D4A574',
  stone: '#8B8B7A',
  bone: '#E8DCC8',
  metal: '#C9A86C',
  other: '#9B7B6B',
};

const typeGeometries: Record<ArtifactType, string> = {
  pottery: 'cylinder',
  stone: 'box',
  bone: 'cone',
  metal: 'octahedron',
  other: 'sphere',
};

export const Artifact3D = ({
  artifact,
  isFiltered,
  hasConflict,
}: Artifact3DProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectedArtifact = useStore((state) => state.selectedArtifact);
  const selectArtifact = useStore((state) => state.selectArtifact);
  const setHoveredArtifact = useStore((state) => state.setHoveredArtifact);

  const isSelected = selectedArtifact?.id === artifact.id;
  const baseColor = hasConflict ? '#FF4444' : typeColors[artifact.type];
  const displayColor = isSelected ? '#FFD700' : hovered ? '#FFFFFF' : baseColor;

  useFrame(() => {
    if (meshRef.current && (hovered || isSelected)) {
      meshRef.current.rotation.y += 0.02;
    }
  });

  if (!isFiltered) {
    return (
      <mesh
        position={[artifact.position.x, artifact.position.z, artifact.position.y]}
        scale={0.5}
      >
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="#333" transparent opacity={0.2} />
      </mesh>
    );
  }

  const renderGeometry = () => {
    switch (typeGeometries[artifact.type]) {
      case 'cylinder':
        return <cylinderGeometry args={[0.4, 0.4, 0.8, 8]} />;
      case 'box':
        return <boxGeometry args={[0.7, 0.7, 0.7]} />;
      case 'cone':
        return <coneGeometry args={[0.4, 0.9, 8]} />;
      case 'octahedron':
        return <octahedronGeometry args={[0.5]} />;
      default:
        return <sphereGeometry args={[0.5, 16, 16]} />;
    }
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[artifact.position.x, artifact.position.z, artifact.position.y]}
        onClick={(e) => {
          e.stopPropagation();
          selectArtifact(artifact.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          setHoveredArtifact(artifact.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          setHoveredArtifact(null);
          document.body.style.cursor = 'auto';
        }}
      >
        {renderGeometry()}
        <meshStandardMaterial
          color={displayColor}
          emissive={displayColor}
          emissiveIntensity={isSelected ? 0.5 : hovered ? 0.3 : 0.1}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      {(hovered || isSelected) && (
        <mesh
          position={[artifact.position.x, artifact.position.z, artifact.position.y]}
          scale={hovered || isSelected ? 1.5 : 1}
        >
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial
            color={displayColor}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {hasConflict && (
        <mesh position={[artifact.position.x, artifact.position.z + 1, artifact.position.y]}>
          <ringGeometry args={[0.3, 0.5, 8]} />
          <meshBasicMaterial color="#FF0000" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
