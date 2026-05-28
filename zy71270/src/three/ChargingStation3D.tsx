import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ChargingStation } from '../types';
import { useViewStore } from '../store/viewStore';
import { useDataStore } from '../store/dataStore';
import { formatDuration } from '../utils/format';

interface ChargingStation3DProps {
  station: ChargingStation;
  floorZ: number;
  robots: ReturnType<typeof useDataStore.getState>['robots'];
}

export default function ChargingStation3D({ station, floorZ, robots }: ChargingStation3DProps) {
  const { selectedElementId, setSelectedElement } = useViewStore();

  const isSelected = selectedElementId === station.id;
  const statusColor = useMemo(() => {
    switch (station.status) {
      case 'available': return '#10B981';
      case 'occupied': return '#3B82F6';
      case 'offline': return '#64748B';
      default: return '#64748B';
    }
  }, [station.status]);

  const position = useMemo(
    () => new THREE.Vector3(station.position.x, floorZ + 0.5, station.position.y),
    [station.position, floorZ]
  );

  const queueRobots = useMemo(() => {
    return station.queue
      .filter((q) => !q.isDuplicate)
      .map((q) => {
        const robot = robots.find((r) => r.id === q.robotId);
        return { ...q, robotName: robot?.name ?? q.robotId };
      });
  }, [station.queue, robots]);

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation();
    setSelectedElement(station.id, 'station');
  };

  return (
    <group position={position} onClick={handleClick}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 1, 0.8]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>

      {station.status === 'occupied' && (
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.3} />
        </mesh>
      )}

      {queueRobots.length > 0 && (
        <>
          {queueRobots.slice(0, 4).map((item, idx) => {
            const offset = (idx + 1) * 1.5;
            return (
              <group key={item.id} position={[0, 0, -offset]}>
                <mesh>
                  <boxGeometry args={[0.5, 0.3, 0.4]} />
                  <meshStandardMaterial color="#F59E0B" transparent opacity={0.7} />
                </mesh>
                <line>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      count={2}
                      array={new Float32Array([0, 0.15, 0.4, 0, 0.15, offset > 1.5 ? 0.4 + (idx) * 1.5 : 0.4])}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial color="#F59E0B" transparent opacity={0.4} />
                </line>
              </group>
            );
          })}

          <Html position={[0, 1.2, 0]} center>
            <div className="tooltip" style={{ pointerEvents: 'none' }}>
              <div className="text-status-amber font-mono text-xs font-bold">
                排队 {queueRobots.length}
              </div>
              {queueRobots.slice(0, 2).map((item) => (
                <div key={item.id} className="text-slate-400 font-mono text-[10px] mt-1">
                  {item.robotName}: {formatDuration(item.waitDuration)}
                </div>
              ))}
            </div>
          </Html>
        </>
      )}

      {isSelected && (
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.0, 32]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
