import { ThreeEvent } from "@react-three/fiber";
import type { ZoneConfig } from "@/types/game";
import { useGameStore } from "@/store/gameStore";

interface Props {
  zone: ZoneConfig;
  selected: boolean;
  selectable: boolean;
}

const TYPE_COLOR: Record<ZoneConfig["type"], string> = {
  pickup: "#2563eb",
  dropoff: "#16a34a",
  restricted: "#7c2d12",
  personnel: "#f59e0b",
};

const TYPE_EMISSIVE: Record<ZoneConfig["type"], number> = {
  pickup: 0.3,
  dropoff: 0.4,
  restricted: 0.2,
  personnel: 0.4,
};

export function Zone3D({ zone, selected, selectable }: Props) {
  const selectZone = useGameStore((s) => s.selectZone);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!selectable) return;
    e.stopPropagation();
    if (zone.type === "dropoff") {
      selectZone(zone.id);
    }
  };

  return (
    <group position={[zone.position.x, zone.position.y, zone.position.z]}>
      <mesh
        castShadow
        receiveShadow
        onClick={handleClick}
      >
        <boxGeometry args={[zone.size.x, zone.size.y, zone.size.z]} />
        <meshStandardMaterial
          color={TYPE_COLOR[zone.type]}
          emissive={TYPE_COLOR[zone.type]}
          emissiveIntensity={TYPE_EMISSIVE[zone.type]}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh position={[0, zone.size.y / 2 + 0.005, 0]}>
        <boxGeometry args={[zone.size.x, 0.01, zone.size.z]} />
        <meshBasicMaterial
          color={TYPE_COLOR[zone.type]}
          transparent
          opacity={selected ? 0.9 : 0.5}
          wireframe
        />
      </mesh>
      {zone.type === "personnel" && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.min(zone.size.x, zone.size.z) / 2 - 0.3, Math.min(zone.size.x, zone.size.z) / 2, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(zone.size.x, zone.size.z) / 2, Math.max(zone.size.x, zone.size.z) / 2 + 0.2, 32]} />
          <meshBasicMaterial color="#ff8c1a" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
