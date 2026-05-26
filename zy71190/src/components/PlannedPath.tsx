import type { LevelConfig } from "@/types/game";
import { useGameStore } from "@/store/gameStore";

interface Props {
  level: LevelConfig;
  coilId: string;
  zoneId: string | null;
}

export function PlannedPath({ level, coilId, zoneId }: Props) {
  const coilPositions = useGameStore((s) => s.coilPositions);
  const cranePositions = useGameStore((s) => s.cranePositions);
  const crane = level.cranes[0];

  const coil = level.coils.find((c) => c.id === coilId);
  const zone = zoneId ? level.zones.find((z) => z.id === zoneId) : null;
  const coilPos = coilPositions[coilId];
  const cranePos = cranePositions[crane?.id || ""];

  if (!coil || !coilPos) return null;

  const start = { x: coilPos.x, z: coilPos.z };
  const end = zone ? { x: zone.position.x, z: zone.position.z } : null;

  return (
    <group>
      {cranePos && (
        <mesh position={[cranePos.x, 0.04, cranePos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color="#ff8c1a" transparent opacity={0.6} />
        </mesh>
      )}
      <mesh position={[start.x, 0.03, start.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.7} />
      </mesh>
      {zone && end && (
        <>
          <mesh position={[end.x, 0.03, end.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.8, 32]} />
            <meshBasicMaterial color="#16a34a" transparent opacity={0.7} />
          </mesh>
          <mesh
            position={[(start.x + end.x) / 2, 0.06, (start.z + end.z) / 2]}
            rotation={[-Math.PI / 2, 0, Math.atan2(end.z - start.z, end.x - start.x)]}
          >
            <planeGeometry args={[Math.hypot(end.x - start.x, end.z - start.z), 0.12]} />
            <meshBasicMaterial color="#ff8c1a" transparent opacity={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}
