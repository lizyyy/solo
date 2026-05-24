import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Valve } from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface ValveMeshProps {
  valve: Valve;
  floorLevel: number;
  isSelected: boolean;
}

export const ValveMesh: React.FC<ValveMeshProps> = ({
  valve,
  floorLevel,
  isSelected,
}) => {
  const yOffset = (floorLevel - 1) * 8;
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const toggleValve = useAppStore((state) => state.toggleValve);
  const setSelectedValve = useAppStore((state) => state.setSelectedValve);

  useFrame((state) => {
    if (groupRef.current) {
      const targetRotation = valve.isOpen ? 0 : Math.PI / 2;
      const currentRotation = groupRef.current.rotation.z;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        currentRotation,
        targetRotation,
        0.1
      );

      if (isSelected || hovered) {
        const scale = 1 + Math.sin(state.clock.getElapsedTime() * 3) * 0.05;
        groupRef.current.scale.setScalar(scale);
      } else {
        groupRef.current.scale.setScalar(1);
      }
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    setSelectedValve(valve.id);
  };

  const handleDoubleClick = (e: any) => {
    e.stopPropagation();
    toggleValve(valve.id);
  };

  let bodyColor = '#00B42A';
  let statusRingColor = '#00B42A';
  if (valve.status === 'maintenance') {
    bodyColor = '#FAAD14';
    statusRingColor = '#FAAD14';
  } else if (valve.status === 'expired') {
    bodyColor = '#F53F3F';
    statusRingColor = '#F53F3F';
  }

  if (!valve.isOpen) {
    bodyColor = '#F53F3F';
  }

  return (
    <group
      position={[valve.position.x, valve.position.y + yOffset, valve.position.z]}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      ref={groupRef}
    >
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.6}
          roughness={0.3}
          emissive={isSelected ? bodyColor : '#000000'}
          emissiveIntensity={isSelected ? 0.4 : 0}
        />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.35, 0.05, 8, 32]} />
        <meshStandardMaterial
          color={statusRingColor}
          metalness={0.8}
          roughness={0.2}
          emissive={statusRingColor}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color="#4E5969" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color="#4E5969" metalness={0.5} roughness={0.4} />
      </mesh>
      {(isSelected || hovered) && (
        <Html position={[0, 1, 0]} center distanceFactor={8}>
          <div className="bg-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap border border-gray-200">
            <div className="font-semibold text-gray-800">{valve.name}</div>
            <div className={`text-xs ${valve.isOpen ? 'text-green-600' : 'text-red-600'}`}>
              {valve.isOpen ? '✓ 开启' : '✗ 关闭'}
            </div>
            <div className="text-xs text-gray-500">双击切换状态</div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default ValveMesh;
