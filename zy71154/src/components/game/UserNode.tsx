import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { UserNode as UserNodeType } from '../../game/types';
import { PRIORITY_CONFIG } from '../../game/config';

interface UserNodeProps {
  node: UserNodeType;
  isSelected: boolean;
  onClick: () => void;
}

export function UserNode({ node, isSelected, onClick }: UserNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[node.priority];

  useFrame((state) => {
    if (meshRef.current) {
      if (!node.powered) {
        meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      }
    }
  });

  const baseColor = node.powered ? '#4ade80' : '#ef4444';
  const priorityColor = priorityConfig.color;

  const getUrgencyOpacity = () => {
    if (node.powered) return 0;
    const ratio = node.outageTime / node.maxOutageTime;
    return Math.min(1, ratio * 0.8);
  };

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={isSelected || hovered ? '#fbbf24' : baseColor}
          emissiveIntensity={isSelected || hovered ? 0.5 : 0.2}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshBasicMaterial color={priorityColor} />
      </mesh>

      {!node.powered && (
        <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={getUrgencyOpacity()} side={2} />
        </mesh>
      )}

      {node.status === 'repairing' && (
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4 * (node.repairProgress || 0), 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} side={2} />
        </mesh>
      )}

      {isSelected && (
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} side={2} />
        </mesh>
      )}
    </group>
  );
}
