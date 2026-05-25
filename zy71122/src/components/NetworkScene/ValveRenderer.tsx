import { useMemo } from 'react';
import { Sphere, Float, Html } from '@react-three/drei';
import type { Network, ValveStatus } from '@/types';
import { getValvePosition } from '@/utils/networkAnalyzer';
import { useNetworkStore } from '@/store/useNetworkStore';

interface ValveRendererProps {
  network: Network;
}

const getValveColor = (status: ValveStatus, isHovered: boolean, isSelected: boolean): string => {
  if (isSelected) return '#FFD700';
  if (isHovered) return '#FFFFFF';
  switch (status) {
    case 'open':
      return '#2ED573';
    case 'closed':
      return '#FF4757';
    case 'failed':
      return '#FFA502';
    default:
      return '#747D8C';
  }
};

export function ValveRenderer({ network }: ValveRendererProps) {
  const { toggleValve, selectedValveId, hoveredValveId, setHoveredValve, showValves } = useNetworkStore();

  const nodeMap = useMemo(() => {
    return new Map(network.nodes.map((n) => [n.id, n]));
  }, [network.nodes]);

  const valves = useMemo(() => {
    return network.valves.map((valve) => {
      const pipe = network.pipes.find((p) => p.id === valve.pipeId);
      if (!pipe) return null;

      const position = getValvePosition(valve, pipe, nodeMap);
      return { valve, position };
    }).filter(Boolean) as Array<{
      valve: typeof network.valves[0];
      position: { x: number; y: number; z: number };
    }>;
  }, [network.valves, network.pipes, nodeMap]);

  if (!showValves) return null;

  return (
    <group>
      {valves.map(({ valve, position }) => {
        const isHovered = hoveredValveId === valve.id;
        const isSelected = selectedValveId === valve.id;
        const scale = isHovered || isSelected ? 1.5 : 1;

        return (
          <group key={valve.id}>
            <Float
              speed={valve.status === 'failed' ? 2 : 1}
              floatIntensity={valve.status === 'failed' ? 0.5 : 0.2}
              rotationIntensity={0}
            >
              <Sphere
                args={[0.4 * scale, 16, 16]}
                position={[position.x, position.y + 0.5, position.z]}
                onClick={(e) => {
                  e.stopPropagation();
                  if (valve.status !== 'failed') {
                    toggleValve(valve.id);
                  }
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredValve(valve.id);
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  setHoveredValve(null);
                  document.body.style.cursor = 'auto';
                }}
              >
                <meshStandardMaterial
                  color={getValveColor(valve.status, isHovered, isSelected)}
                  emissive={getValveColor(valve.status, isHovered, isSelected)}
                  emissiveIntensity={isHovered || isSelected ? 0.5 : 0.2}
                  transparent
                  opacity={0.9}
                />
              </Sphere>
            </Float>

            {isHovered && (
              <Html
                position={[position.x, position.y + 2, position.z]}
                center
                distanceFactor={10}
              >
                <div className="bg-slate-900/90 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap border border-slate-700 shadow-xl">
                  <div className="font-bold">{valve.id}</div>
                  <div className="text-xs text-slate-300">
                    状态: {valve.status === 'open' ? '开启' : valve.status === 'closed' ? '关闭' : '失效'}
                  </div>
                  <div className="text-xs text-slate-400">
                    类型: {valve.type === 'gate' ? '闸阀' : valve.type === 'butterfly' ? '蝶阀' : '球阀'}
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
