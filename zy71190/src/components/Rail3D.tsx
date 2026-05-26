import type { RailConfig } from "@/types/game";

interface Props {
  rail: RailConfig;
}

export function Rail3D({ rail }: Props) {
  const isX = rail.axis === "x";
  const length = rail.end - rail.start;
  const mid = (rail.start + rail.end) / 2;
  const pos: [number, number, number] = isX
    ? [mid, rail.y, rail.fixed]
    : [rail.fixed, rail.y, mid];
  const size: [number, number, number] = isX ? [length, 0.15, 0.4] : [0.4, 0.15, length];

  return (
    <group>
      <mesh position={pos} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#3d4f74" roughness={0.6} metalness={0.6} />
      </mesh>
      <mesh position={pos} castShadow receiveShadow>
        <boxGeometry args={isX ? [length, 0.05, 0.5] : [0.5, 0.05, length]} />
        <meshStandardMaterial color="#ff8c1a" emissive="#ff8c1a" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}
