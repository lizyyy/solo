import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Container as ContainerType, ContainerStatus } from '../../types';
import { useStore } from '../../store/useStore';

interface Container3DProps {
  container: ContainerType;
  isSelected: boolean;
  isAnimating?: boolean;
  animationProgress?: number;
}

const CONTAINER_WIDTH = 2.4;
const CONTAINER_HEIGHT = 2.6;
const CONTAINER_DEPTH = 6.1;

const BAY_SPACING = 7;
const ROW_SPACING = 2.8;
const TIER_SPACING = 2.7;

export function getContainerPosition(
  bay: number,
  row: number,
  tier: number
): [number, number, number] {
  return [
    bay * BAY_SPACING,
    tier * TIER_SPACING + CONTAINER_HEIGHT / 2,
    row * ROW_SPACING,
  ];
}

function getStatusColor(status: ContainerStatus): string {
  switch (status) {
    case 'target':
      return '#00B42A';
    case 'blocking':
      return '#FF7D00';
    case 'moved':
      return '#86909C';
    default:
      return '';
  }
}

export function Container3D({
  container,
  isSelected,
  isAnimating = false,
  animationProgress = 0,
}: Container3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { selectContainer, analyzeTargetContainer, currentTask, timeline } =
    useStore();

  const basePosition = getContainerPosition(
    container.bay,
    container.row,
    container.tier
  );

  let position: [number, number, number] = basePosition;

  if (isAnimating && currentTask) {
    const currentMove = currentTask.moves[timeline.currentStep];
    if (currentMove && currentMove.containerId === container.id) {
      const from = getContainerPosition(
        currentMove.from.bay,
        currentMove.from.row,
        currentMove.from.tier
      );
      const to = currentMove.to
        ? getContainerPosition(
            currentMove.to.bay,
            currentMove.to.row,
            currentMove.to.tier
          )
        : [from[0], from[1] + 10, from[2]];

      const progress = Math.min(animationProgress, 1);
      const liftHeight = 4;

      if (progress < 0.33) {
        const p = progress / 0.33;
        position = [from[0], from[1] + liftHeight * p, from[2]];
      } else if (progress < 0.66) {
        const p = (progress - 0.33) / 0.33;
        position = [
          from[0] + (to[0] - from[0]) * p,
          from[1] + liftHeight,
          from[2] + (to[2] - from[2]) * p,
        ];
      } else {
        const p = (progress - 0.66) / 0.34;
        position = [to[0], to[1] + liftHeight * (1 - p), to[2]];
      }
    }
  }

  const statusColor = getStatusColor(container.status);
  const displayColor = isSelected
    ? '#165DFF'
    : statusColor || container.color;

  useFrame((_, delta) => {
    if (meshRef.current && (hovered || isSelected || container.status === 'target')) {
      meshRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.01);
    }
  });

  const handleClick = () => {
    selectContainer(container.id);
    analyzeTargetContainer(container.id);
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[CONTAINER_WIDTH, CONTAINER_HEIGHT, CONTAINER_DEPTH]}
        />
        <meshStandardMaterial
          color={displayColor}
          metalness={0.3}
          roughness={0.5}
          emissive={isSelected ? '#165DFF' : container.status === 'target' ? '#00B42A' : '#000000'}
          emissiveIntensity={isSelected || container.status === 'target' ? 0.2 : 0}
        />
      </mesh>

      <mesh
        position={[0, 0, CONTAINER_DEPTH / 2 + 0.01]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[CONTAINER_WIDTH * 0.9, CONTAINER_HEIGHT * 0.3]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.1} roughness={0.8} />
      </mesh>

      {(hovered || isSelected) && (
        <Html
          position={[0, CONTAINER_HEIGHT / 2 + 1, 0]}
          center
          distanceFactor={10}
        >
          <div className="bg-gray-900/95 text-white px-3 py-2 rounded text-xs whitespace-nowrap border border-gray-600 shadow-lg">
            <div className="font-bold text-blue-400">{container.id}</div>
            <div className="text-gray-300 mt-1">
              位置: {container.bay}箱区 {container.row}行 {container.tier}层
            </div>
            <div className="text-gray-300">
              重量: {container.weight}吨 | {container.size}
            </div>
          </div>
        </Html>
      )}

      <lineSegments>
        <edgesGeometry
          args={[
            new THREE.BoxGeometry(
              CONTAINER_WIDTH + 0.02,
              CONTAINER_HEIGHT + 0.02,
              CONTAINER_DEPTH + 0.02
            ),
          ]}
        />
        <lineBasicMaterial
          color={
            isSelected
              ? '#165DFF'
              : container.status === 'target'
              ? '#00B42A'
              : container.status === 'blocking'
              ? '#FF7D00'
              : '#3a3a4e'
          }
          linewidth={isSelected || container.status !== 'normal' ? 2 : 1}
        />
      </lineSegments>
    </group>
  );
}
