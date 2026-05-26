import { ThreeEvent } from "@react-three/fiber";
import type { CoilConfig } from "@/types/game";
import { useGameStore } from "@/store/gameStore";

interface Props {
  coil: CoilConfig;
  position?: {
    x: number;
    y: number;
    z: number;
    tilt: number;
    tiltAxis: { x: number; y: number };
    delivered: boolean;
  };
  selected: boolean;
  current: boolean;
  selectable: boolean;
}

export function Coil3D({ coil, position, selected, current, selectable }: Props) {
  const selectCoil = useGameStore((s) => s.selectCoil);
  const pos = position || {
    x: coil.position.x,
    y: coil.position.y,
    z: coil.position.z,
    tilt: 0,
    tiltAxis: { x: 1, y: 0 },
    delivered: false,
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!selectable || pos.delivered) return;
    e.stopPropagation();
    selectCoil(coil.id);
  };

  const tiltRad = (pos.tilt * Math.PI) / 180;
  const axisAngle = Math.atan2(pos.tiltAxis.y, pos.tiltAxis.x);

  return (
    <group
      position={[pos.x, pos.y, pos.z]}
      rotation={[0, 0, 0]}
      onClick={handleClick}
    >
      <group rotation={[0, axisAngle, 0]}>
        <group rotation={[tiltRad, 0, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[coil.radius, coil.radius, coil.length, 32]} />
            <meshStandardMaterial
              color={pos.delivered ? "#4b5563" : "#8b949e"}
              roughness={0.4}
              metalness={0.7}
            />
          </mesh>
          <mesh castShadow>
            <cylinderGeometry args={[coil.radius * 0.3, coil.radius * 0.3, coil.length + 0.02, 24]} />
            <meshStandardMaterial color="#1f2937" roughness={0.6} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, -coil.length / 2]}>
            <cylinderGeometry args={[coil.radius * 0.3, coil.radius * 0.3, 0.02, 24]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0, coil.length / 2]}>
            <cylinderGeometry args={[coil.radius * 0.3, coil.radius * 0.3, 0.02, 24]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
          {(coil.centerOffset.x !== 0 || coil.centerOffset.y !== 0) && (
            <mesh
              position={[coil.centerOffset.x * coil.radius * 0.6, coil.radius * 0.51, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.06, 0.06, 0.2, 16]} />
              <meshBasicMaterial color="#d9363e" />
            </mesh>
          )}
        </group>
      </group>
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[coil.radius + 0.1, coil.radius + 0.3, 32]} />
          <meshBasicMaterial color="#ff8c1a" transparent opacity={0.9} />
        </mesh>
      )}
      {current && (
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[coil.radius + 0.35, coil.radius + 0.5, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}
