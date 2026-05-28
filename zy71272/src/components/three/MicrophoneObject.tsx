import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Microphone } from '../../types';
import { useStore } from '../../store/useStore';

interface MicrophoneObjectProps {
  microphone: Microphone;
}

export default function MicrophoneObject({ microphone }: MicrophoneObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const {
    selectedObjectId,
    selectObject,
    updateMicrophone,
    roomConfig,
  } = useStore(state => ({
    selectedObjectId: state.selectedObjectId,
    selectObject: state.selectObject,
    updateMicrophone: state.updateMicrophone,
    roomConfig: state.roomConfig,
  }));

  const isSelected = selectedObjectId === microphone.id;

  useFrame(() => {
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    setIsDragging(true);
    selectObject(microphone.id, 'microphone');
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging || !roomConfig) return;
    e.stopPropagation();

    const point = e.point;
    const halfWidth = roomConfig.width / 2 - 0.3;
    const halfDepth = roomConfig.length / 2 - 0.3;

    const newX = Math.max(-halfWidth, Math.min(halfWidth, point.x));
    const newZ = Math.max(-halfDepth, Math.min(halfDepth, point.z));

    updateMicrophone(microphone.id, {
      position: { ...microphone.position, x: newX, z: newZ, y: 1.5 },
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <group
      ref={groupRef}
      position={[microphone.position.x, microphone.position.y, microphone.position.z]}
      rotation={[microphone.rotation.x, microphone.rotation.y, microphone.rotation.z]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#00f0ff' : '#444444'}
          emissive={isSelected ? '#00f0ff' : '#000000'}
          emissiveIntensity={isSelected ? 0.5 : 0}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, -0.15, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.25, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#00f0ff' : '#333333'}
          emissive={isSelected ? '#00f0ff' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.7} roughness={0.3} />
      </mesh>

      <Text
        position={[0, -0.5, 0]}
        fontSize={0.15}
        color="#00f0ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {microphone.name}
      </Text>

      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.25, 0.3, 32]} />
          <meshBasicMaterial
            color="#00f0ff"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
