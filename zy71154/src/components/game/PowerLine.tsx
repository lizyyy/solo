import { useMemo } from 'react';
import * as THREE from 'three';
import type { PowerNode } from '../../game/types';
import { NODE_STATUS_CONFIG } from '../../game/config';

interface PowerLineProps {
  node: PowerNode;
  connectedNodes: PowerNode[];
  isSelected: boolean;
  onClick: () => void;
}

export function PowerLine({ node, connectedNodes, isSelected, onClick }: PowerLineProps) {
  const statusColor = NODE_STATUS_CONFIG[node.status]?.color || '#666';

  const lines = useMemo(() => {
    return connectedNodes.map(targetNode => {
      const points = [
        new THREE.Vector3(node.position.x, node.position.y, node.position.z),
        new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return { geometry, targetId: targetNode.id };
    });
  }, [node, connectedNodes]);

  const isDamaged = node.status === 'damaged' || node.status === 'repairing';
  const baseColor = node.powered ? '#4ade80' : '#6b7280';
  const finalColor = isDamaged ? statusColor : baseColor;

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh
        position={[node.position.x, node.position.y, node.position.z]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <cylinderGeometry args={[0.2, 0.2, 0.5, 8]} />
        <meshStandardMaterial
          color={finalColor}
          emissive={isSelected ? '#fbbf24' : isDamaged ? statusColor : baseColor}
          emissiveIntensity={isSelected ? 0.5 : isDamaged ? 0.2 : 0}
          transparent
          opacity={node.status === 'destroyed' ? 0.3 : 1}
        />
      </mesh>

      {lines.map((line, index) => (
        <primitive
          key={index}
          object={new THREE.Line(
            line.geometry,
            new THREE.LineBasicMaterial({
              color: finalColor,
              transparent: true,
              opacity: node.status === 'destroyed' ? 0.2 : 0.8
            })
          )}
        />
      ))}

      {isSelected && (
        <mesh position={[node.position.x, node.position.y - 0.3, node.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.6, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} side={2} />
        </mesh>
      )}
    </group>
  );
}
