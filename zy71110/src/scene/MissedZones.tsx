import { useStore } from '../store/useStore';
import * as THREE from 'three';

export function MissedZones() {
  const coverageResult = useStore((state) => state.coverageResult);
  const showMissedZones = useStore((state) => state.showMissedZones);
  const environment = useStore((state) => state.environment);

  const { slope, slopeDirection } = environment;

  if (!showMissedZones || !coverageResult || coverageResult.missedZones.length === 0) {
    return null;
  }

  const getElevation = (x: number, z: number) => {
    const slopeRad = (slope * Math.PI) / 180;
    const dirRad = (slopeDirection * Math.PI) / 180;
    const proj = x * Math.cos(dirRad) + z * Math.sin(dirRad);
    return proj * Math.tan(slopeRad);
  };

  return (
    <group>
      {coverageResult.missedZones.slice(0, 10).map((zone, index) => {
        const size = Math.min(Math.sqrt(zone.area) * 0.8, 4);
        const elevation = getElevation(zone.x, zone.z);

        return (
          <group key={index} position={[zone.x, elevation + 0.1, zone.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[size * 0.6, size, 32]} />
              <meshBasicMaterial
                color={zone.type === 'corner' ? 0xff6b35 : 0xf44336}
                transparent
                opacity={0.6}
                side={2}
              />
            </mesh>

            <mesh position={[0, size * 0.5 + 0.5, 0]}>
              <cylinderGeometry args={[0.05, 0.05, size, 8]} />
              <meshBasicMaterial
                color={zone.type === 'corner' ? 0xff6b35 : 0xf44336}
                transparent
                opacity={0.8}
              />
            </mesh>

            <mesh position={[0, size + 0.8, 0]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshBasicMaterial
                color={zone.type === 'corner' ? 0xff6b35 : 0xf44336}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
