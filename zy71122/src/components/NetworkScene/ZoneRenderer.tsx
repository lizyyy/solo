import { useMemo } from 'react';
import { Sphere, Text } from '@react-three/drei';
import type { Network } from '@/types';
import { useNetworkStore } from '@/store/useNetworkStore';

interface ZoneRendererProps {
  network: Network;
  affectedZoneIds: string[];
}

export function ZoneRenderer({ network, affectedZoneIds }: ZoneRendererProps) {
  const { showZones } = useNetworkStore();

  const zonePositions = useMemo(() => {
    return network.customerZones.map((zone) => {
      const nodes = zone.nodeIds
        .map((id) => network.nodes.find((n) => n.id === id))
        .filter(Boolean);

      if (nodes.length === 0) return null;

      const centerX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
      const centerZ = nodes.reduce((sum, n) => sum + n.z, 0) / nodes.length;
      const isAffected = affectedZoneIds.includes(zone.id);

      return {
        zone,
        centerX,
        centerZ,
        isAffected,
        nodes,
      };
    }).filter(Boolean) as Array<{
      zone: typeof network.customerZones[0];
      centerX: number;
      centerZ: number;
      isAffected: boolean;
      nodes: typeof network.nodes;
    }>;
  }, [network.customerZones, network.nodes, affectedZoneIds]);

  if (!showZones) return null;

  return (
    <group>
      {zonePositions.map(({ zone, centerX, centerZ, isAffected, nodes }) => (
        <group key={zone.id}>
          {nodes.map((node, index) => (
            <Sphere
              key={`${zone.id}-${index}`}
              args={[1.2, 16, 16]}
              position={[node.x, -0.5, node.z]}
            >
              <meshStandardMaterial
                color={isAffected ? '#FF6B6B' : zone.color}
                transparent
                opacity={0.3}
                emissive={isAffected ? '#FF6B6B' : zone.color}
                emissiveIntensity={isAffected ? 0.3 : 0.1}
              />
            </Sphere>
          ))}

          <Text
            position={[centerX, 0.5, centerZ]}
            fontSize={0.8}
            color={isAffected ? '#FF6B6B' : '#FFFFFF'}
            anchorX="center"
            anchorY="middle"
          >
            {zone.name}
          </Text>

          <Text
            position={[centerX, -0.5, centerZ]}
            fontSize={0.5}
            color={isAffected ? '#FF6B6B' : zone.color}
            anchorX="center"
            anchorY="middle"
          >
            {zone.customerCount}户
          </Text>
        </group>
      ))}
    </group>
  );
}
