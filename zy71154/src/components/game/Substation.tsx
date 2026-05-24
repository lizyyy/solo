import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PowerNode } from '../../game/types';
import { NODE_STATUS_CONFIG } from '../../game/config';

interface SubstationProps {
  node: PowerNode;
  isSelected: boolean;
  onClick: () => void;
}

export function Substation({ node, isSelected, onClick }: SubstationProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const statusColor = NODE_STATUS_CONFIG[node.status]?.color || '#666';

  useFrame((state) => {
    if (meshRef.current) {
      if (node.status === 'damaged') {
        meshRef.current.position.y = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.05;
      }
      if (node.status === 'repairing') {
        meshRef.current.rotation.y += 0.02;
      }
    }
  });

  const isDamaged = node.status === 'damaged' || node.status === 'repairing';
  const baseColor = node.powered ? '#4ade80' : '#6b7280';

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
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial
          color={isDamaged ? statusColor : baseColor}
          emissive={isSelected || hovered ? '#fbbf24' : isDamaged ? statusColor : baseColor}
          emissiveIntensity={isSelected || hovered ? 0.5 : isDamaged ? 0.3 : 0.1}
          transparent
          opacity={node.status === 'destroyed' ? 0.3 : 1}
        />
      </mesh>

      {node.status === 'repairing' && (
        <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} side={2} />
        </mesh>
      )}

      {isSelected && (
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.5, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} side={2} />
        </mesh>
      )}
    </group>
  );
}
