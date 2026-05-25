import { useMemo } from 'react';
import { Line, Tube } from '@react-three/drei';
import * as THREE from 'three';
import type { Network } from '@/types';

interface PipeRendererProps {
  network: Network;
  isolatedPipeIds: Set<string>;
}

export function PipeRenderer({ network, isolatedPipeIds }: PipeRendererProps) {
  const nodeMap = useMemo(() => {
    return new Map(network.nodes.map((n) => [n.id, n]));
  }, [network.nodes]);

  const pipes = useMemo(() => {
    return network.pipes.map((pipe) => {
      const fromNode = nodeMap.get(pipe.fromNode);
      const toNode = nodeMap.get(pipe.toNode);
      if (!fromNode || !toNode) return null;

      const start: [number, number, number] = [fromNode.x, fromNode.y, fromNode.z];
      const end: [number, number, number] = [toNode.x, toNode.y, toNode.z];
      const isIsolated = isolatedPipeIds.has(pipe.id);
      const radius = (pipe.diameter / 1000) * 0.3;

      return { pipe, start, end, isIsolated, radius };
    }).filter(Boolean) as Array<{
      pipe: typeof network.pipes[0];
      start: [number, number, number];
      end: [number, number, number];
      isIsolated: boolean;
      radius: number;
    }>;
  }, [network.pipes, nodeMap, isolatedPipeIds]);

  const { isolatedPipes, activePipes } = useMemo(() => {
    return {
      isolatedPipes: pipes.filter((p) => p.isIsolated),
      activePipes: pipes.filter((p) => !p.isIsolated),
    };
  }, [pipes]);

  return (
    <group>
      {activePipes.map(({ pipe, start, end, radius }) => (
        <group key={pipe.id}>
          <Line
            points={[start, end]}
            color="#00D4FF"
            lineWidth={2}
            transparent
            opacity={0.9}
          />
          <Tube
            args={[
              new THREE.LineCurve3(
                new THREE.Vector3(...start),
                new THREE.Vector3(...end)
              ),
              1,
              radius,
              8,
              false,
            ]}
          >
            <meshStandardMaterial
              color="#00D4FF"
              transparent
              opacity={0.3}
              emissive="#00D4FF"
              emissiveIntensity={0.2}
            />
          </Tube>
        </group>
      ))}

      {isolatedPipes.map(({ pipe, start, end, radius }) => (
        <group key={`iso-${pipe.id}`}>
          <Line
            points={[start, end]}
            color="#FF6B6B"
            lineWidth={2}
            transparent
            opacity={0.9}
          />
          <Tube
            args={[
              new THREE.LineCurve3(
                new THREE.Vector3(...start),
                new THREE.Vector3(...end)
              ),
              1,
              radius,
              8,
              false,
            ]}
          >
            <meshStandardMaterial
              color="#FF6B6B"
              transparent
              opacity={0.4}
              emissive="#FF6B6B"
              emissiveIntensity={0.3}
            />
          </Tube>
        </group>
      ))}
    </group>
  );
}
