import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Musician } from '../../types';
import { useStore } from '../../store/useStore';
import { isObjectInvolvedInIssue } from '../../utils/sceneDetection';
import { INSTRUMENT_ICONS } from '../../utils/constants';

interface MusicianObjectProps {
  musician: Musician;
}

export default function MusicianObject({ musician }: MusicianObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);

  const selectedObjectId = useStore(state => state.selectedObjectId);
  const selectObject = useStore(state => state.selectObject);
  const updateMusician = useStore(state => state.updateMusician);
  const sceneIssues = useStore(state => state.sceneIssues);
  const roomConfig = useStore(state => state.roomConfig);

  const isSelected = selectedObjectId === musician.id;
  const issue = isObjectInvolvedInIssue(musician.id, sceneIssues);
  const hasError = issue?.severity === 'error';
  const hasWarning = issue?.severity === 'warning';

  useFrame((_, delta) => {
    if (isSelected) {
      setPulsePhase(prev => (prev + delta * 3) % (Math.PI * 2));
    }
    if (hasError && meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      if (material.emissive) {
        const pulse = (Math.sin(Date.now() * 0.005) + 1) / 2;
        material.emissive.setHex(pulse > 0.5 ? 0xff3366 : 0x330011);
      }
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(true);
    selectObject(musician.id, 'musician');
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !roomConfig) return;
    e.stopPropagation();

    const point = e.point;
    const halfWidth = roomConfig.width / 2 - 0.5;
    const halfDepth = roomConfig.length / 2 - 0.5;

    const newX = Math.max(-halfWidth, Math.min(halfWidth, point.x));
    const newZ = Math.max(-halfDepth, Math.min(halfDepth, point.z));

    updateMusician(musician.id, {
      position: { ...musician.position, x: newX, z: newZ },
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const icon = INSTRUMENT_ICONS[musician.type] || '🎵';

  return (
    <group
      ref={groupRef}
      position={[musician.position.x, musician.position.y, musician.position.z]}
      rotation={[0, musician.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh ref={meshRef} castShadow>
        <cylinderGeometry args={[0.4, 0.5, 0.2, 8]} />
        <meshStandardMaterial
          color={musician.color}
          emissive={isSelected ? musician.color : hasError ? '#330011' : '#000000'}
          emissiveIntensity={isSelected ? 0.5 + Math.sin(pulsePhase) * 0.2 : 0.3}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial
          color={musician.color}
          emissive={isSelected ? musician.color : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, 0.15, 0]} rotation={[0, musician.rotation + Math.PI, 0]}>
        <coneGeometry args={[0.15, 0.5, 8]} />
        <meshStandardMaterial
          color={hasWarning ? '#ff6b35' : musician.color}
          emissive={hasWarning ? '#ff6b35' : '#000000'}
          emissiveIntensity={hasWarning ? 0.5 : 0}
        />
      </mesh>

      <mesh position={[0, 0.4, -0.3]} rotation={[0, musician.rotation + Math.PI, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#888888" />
      </mesh>

      <Text
        position={[0, 1.3, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {icon}
      </Text>

      <Text
        position={[0, -0.4, 0]}
        fontSize={0.18}
        color={hasError ? '#ff3366' : hasWarning ? '#ff6b35' : '#00f0ff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {musician.name}
      </Text>

      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.65, 32]} />
          <meshBasicMaterial
            color={hasError ? '#ff3366' : '#00f0ff'}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <mesh
        position={[0, 1.5, 0]}
        rotation={[0, musician.rotation, 0]}
      >
        <cylinderGeometry args={[0.03, 0.03, musician.directivity * 3, 8]} />
        <meshBasicMaterial
          color={musician.color}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}
