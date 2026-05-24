import { Beam as BeamType } from '../types';

interface BeamProps {
  beam: BeamType;
  showHeightLine?: boolean;
}

export function Beam({ beam, showHeightLine = true }: BeamProps) {
  return (
    <group position={beam.position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={beam.size} />
        <meshStandardMaterial color="#A0AEC0" metalness={0.3} roughness={0.7} />
      </mesh>

      {showHeightLine && (
        <group position={[0, -beam.size[1] / 2, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[beam.size[0] * 0.9, 0.04, 0.04]} />
            <meshBasicMaterial color="#FFD700" />
          </mesh>
        </group>
      )}
    </group>
  );
}
