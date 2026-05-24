import { useMemo } from 'react';
import { Sphere, Text } from '@react-three/drei';
import type { Network } from '@/types';

interface NodeRendererProps {
  network: Network;
  isolatedNodeIds: Set<string>;
}

const getNodeColor = (type: string, isIsolated: boolean): string => {
  if (isIsolated) return '#FF6B6B';
  switch (type) {
    case 'source':
      return '#00D4FF';
    case 'reservoir':
      return '#A29BFE';
    default:
      return '#74B9FF';
  }
};

export function NodeRenderer({ network, isolatedNodeIds }: NodeRendererProps) {
  const nodes = useMemo(() => {
    return network.nodes.map((node) => ({
      node,
      isIsolated: isolatedNodeIds.has(node.id),
    }));
  }, [network.nodes, isolatedNodeIds]);

  return (
    <group>
      {nodes.map(({ node, isIsolated }) => (
        <group key={node.id}>
          <Sphere
            args={[node.type === 'source' ? 0.6 : 0.35, 16, 16]}
            position={[node.x, node.y, node.z]}
          >
            <meshStandardMaterial
              color={getNodeColor(node.type, isIsolated)}
              emissive={getNodeColor(node.type, isIsolated)}
              emissiveIntensity={node.type === 'source' ? 0.5 : 0.2}
              transparent
              opacity={0.9}
            />
          </Sphere>

          {node.type === 'source' && (
            <Text
              position={[node.x, node.y + 1, node.z]}
              fontSize={0.5}
              color="#00D4FF"
              anchorX="center"
              anchorY="bottom"
            >
              水源
            </Text>
          )}
        </group>
      ))}
    </group>
  );
}
