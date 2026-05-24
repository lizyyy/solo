import { useMemo } from 'react';
import { Sphere, Float, Text, RoundedBox } from '@react-three/drei';
import type { Network } from '@/types';
import { useNetworkStore } from '@/store/useNetworkStore';

interface RepairPointProps {
  network: Network;
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high':
      return '#FF4757';
    case 'medium':
      return '#FFA502';
    case 'low':
      return '#2ED573';
    default:
      return '#747D8C';
  }
};

export function RepairPointRenderer({ network }: RepairPointProps) {
  const { showRepairPoints } = useNetworkStore();

  const repairPoints = useMemo(() => {
    const nodeMap = new Map(network.nodes.map((n) => [n.id, n]));

    return network.repairPoints.map((rp) => {
      const pipe = network.pipes.find((p) => p.id === rp.pipeId);
      if (!pipe) return null;

      const fromNode = nodeMap.get(pipe.fromNode);
      const toNode = nodeMap.get(pipe.toNode);
      if (!fromNode || !toNode) return null;

      const position = {
        x: fromNode.x + (toNode.x - fromNode.x) * rp.position,
        y: 1,
        z: fromNode.z + (toNode.z - fromNode.z) * rp.position,
      };

      return { repairPoint: rp, position };
    }).filter(Boolean) as Array<{
      repairPoint: typeof network.repairPoints[0];
      position: { x: number; y: number; z: number };
    }>;
  }, [network.repairPoints, network.pipes, network.nodes]);

  if (!showRepairPoints || repairPoints.length === 0) return null;

  return (
    <group>
      {repairPoints.map(({ repairPoint, position }) => (
        <group key={repairPoint.id}>
          <Float
            speed={2}
            floatIntensity={0.5}
            rotationIntensity={0.2}
          >
            <group position={[position.x, position.y + 1.5, position.z]}>
              <RoundedBox
                args={[1.5, 2, 0.3]}
                radius={0.1}
              >
                <meshStandardMaterial
                  color={getPriorityColor(repairPoint.priority)}
                  emissive={getPriorityColor(repairPoint.priority)}
                  emissiveIntensity={0.5}
                  transparent
                  opacity={0.9}
                />
              </RoundedBox>

              <Text
                position={[0, 0, 0.2]}
                fontSize={0.6}
                color="#FFFFFF"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                !
              </Text>

              <Sphere
                args={[0.8, 16, 16]}
                position={[0, 0, 0]}
              >
                <meshBasicMaterial
                  color={getPriorityColor(repairPoint.priority)}
                  transparent
                  opacity={0.2}
                />
              </Sphere>
            </group>
          </Float>

          <Sphere
            args={[0.5, 16, 16]}
            position={[position.x, position.y, position.z]}
          >
            <meshBasicMaterial
              color={getPriorityColor(repairPoint.priority)}
              transparent
              opacity={0.8}
            />
          </Sphere>

          <Text
            position={[position.x, position.y - 1, position.z]}
            fontSize={0.4}
            color={getPriorityColor(repairPoint.priority)}
            anchorX="center"
            anchorY="top"
          >
            {repairPoint.description}
          </Text>
        </group>
      ))}
    </group>
  );
}
