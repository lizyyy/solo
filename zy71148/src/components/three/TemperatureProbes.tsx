import { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../../store';
import { getTemperatureColor } from '../../utils/colors';

export const TemperatureProbes = () => {
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const showProbes = useAppStore((state) => state.showProbes);

  const probes = useMemo(() => {
    if (!data || !showProbes) return [];

    const snapshot = data.snapshots[currentTimeIndex];
    const { temperatureWarning, temperatureCritical } = data.rink;

    return data.probes.map((probe) => {
      const reading = snapshot.temperatureReadings.find((r) => r.probeId === probe.id);
      const temperature = reading?.temperature ?? -99;
      const color = getTemperatureColor(temperature, temperatureWarning, temperatureCritical);

      return {
        ...probe,
        temperature,
        color,
      };
    });
  }, [data, currentTimeIndex, showProbes]);

  if (!data || !showProbes) return null;

  return (
    <group>
      {probes.map((probe) => (
        <group key={probe.id} position={[probe.x, 0, probe.y]}>
          <mesh position={[0, probe.depth * 0.05, 0]}>
            <cylinderGeometry args={[0.15, 0.15, probe.depth * 0.1, 8]} />
            <meshStandardMaterial color="#64748b" transparent opacity={0.6} />
          </mesh>

          <mesh position={[0, probe.depth * 0.1 + 0.5, 0]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshStandardMaterial
              color={probe.color}
              emissive={probe.color}
              emissiveIntensity={0.5}
            />
          </mesh>

          <mesh position={[0, probe.depth * 0.1 + 1.2, 0]}>
            <ringGeometry args={[0.4, 0.55, 32]} />
            <meshBasicMaterial color={probe.color} transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
