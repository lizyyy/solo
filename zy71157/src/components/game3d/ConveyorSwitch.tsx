import { useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ConveyorSegment } from '@/types/game';
import { useGameStore } from '@/store/useGameStore';

interface ConveyorSwitchProps {
  segment: ConveyorSegment;
  gateOptions: string[];
  currentGate: string;
}

export const ConveyorSwitch = ({ segment, gateOptions, currentGate }: ConveyorSwitchProps) => {
  const [hovered, setHovered] = useState(false);
  const toggleSwitch = useGameStore(state => state.toggleSwitch);
  const status = useGameStore(state => state.status);

  const canToggle = status === 'playing' || status === 'idle';

  useFrame(({ clock }) => {
    if (hovered) {
      clock.elapsedTime;
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (canToggle) {
      toggleSwitch(segment.id);
    }
  };

  const currentIndex = gateOptions.indexOf(currentGate);

  return (
    <group
      position={[segment.start.x, 0.8, segment.start.z]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (canToggle) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.3, 8]} />
        <meshStandardMaterial
          color="#374151"
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.6, 8]} />
        <meshStandardMaterial
          color={hovered && canToggle ? '#FBBF24' : '#F59E0B'}
          emissive={hovered && canToggle ? '#FBBF24' : '#F59E0B'}
          emissiveIntensity={hovered ? 0.4 : 0.2}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, 0.35, 0]} rotation={[0, (currentIndex / gateOptions.length) * Math.PI * 2, 0]}>
        <coneGeometry args={[0.2, 0.3, 4]} />
        <meshStandardMaterial
          color="#EF4444"
          emissive="#EF4444"
          emissiveIntensity={0.5}
        />
      </mesh>

      <Text
        position={[0, 0.8, 0]}
        fontSize={0.25}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
      >
        {currentGate}
      </Text>

      {gateOptions.map((gate, i) => {
        const angle = (i / gateOptions.length) * Math.PI * 2 - Math.PI / 2;
        const isSelected = i === currentIndex;
        return (
          <group key={gate} position={[Math.cos(angle) * 0.8, 0, Math.sin(angle) * 0.8]}>
            <mesh>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial
                color={isSelected ? '#10B981' : '#4B5563'}
                emissive={isSelected ? '#10B981' : '#000000'}
                emissiveIntensity={isSelected ? 0.5 : 0}
              />
            </mesh>
            <Text
              position={[Math.cos(angle) * 0.2, 0.25, Math.sin(angle) * 0.2]}
              fontSize={0.15}
              color={isSelected ? '#10B981' : '#9CA3AF'}
              anchorX="center"
              anchorY="middle"
            >
              {gate}
            </Text>
          </group>
        );
      })}

      {hovered && canToggle && (
        <Text
          position={[0, -0.6, 0]}
          fontSize={0.12}
          color="#FBBF24"
          anchorX="center"
          anchorY="middle"
        >
          点击切换
        </Text>
      )}
    </group>
  );
};
