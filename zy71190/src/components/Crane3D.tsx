import type { CraneConfig } from "@/types/game";
import { useGameStore } from "@/store/gameStore";

interface Props {
  crane: CraneConfig;
  position: { x: number; z: number; y: number };
  attachedCoilId: string | null;
}

export function Crane3D({ crane, position, attachedCoilId }: Props) {
  const coilPositions = useGameStore((s) => s.coilPositions);
  const coils = useGameStore((s) => s.currentLevel?.coils || []);

  const attached = attachedCoilId ? coilPositions[attachedCoilId] : null;
  const attachedCoil = coils.find((c) => c.id === attachedCoilId);

  const isX = crane.axis === "x";
  const legHeight = crane.y;
  const width = crane.width;

  const legOffset = 1.5;

  return (
    <group position={[position.x, 0, position.z]}>
      {isX ? (
        <>
          <mesh position={[-legOffset, legHeight / 2, -width / 2]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[-legOffset, legHeight / 2, width / 2]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[legOffset, legHeight / 2, -width / 2]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[legOffset, legHeight / 2, width / 2]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, legHeight, 0]} castShadow>
            <boxGeometry args={[legOffset * 2 + 0.6, 0.35, width]} />
            <meshStandardMaterial color="#1e3a5f" metalness={0.7} roughness={0.4} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[-width / 2, legHeight / 2, -legOffset]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[width / 2, legHeight / 2, -legOffset]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[-width / 2, legHeight / 2, legOffset]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[width / 2, legHeight / 2, legOffset]} castShadow>
            <boxGeometry args={[0.3, legHeight, 0.3]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, legHeight, 0]} castShadow>
            <boxGeometry args={[width, 0.35, legOffset * 2 + 0.6]} />
            <meshStandardMaterial color="#1e3a5f" metalness={0.7} roughness={0.4} />
          </mesh>
        </>
      )}

      <group position={[0, legHeight - 0.2, 0]}>
        <mesh>
          <boxGeometry args={[0.8, 0.4, 0.8]} />
          <meshStandardMaterial color="#ff8c1a" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {attached && (
        <group>
          <mesh position={[0, legHeight / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, legHeight, 8]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          <group position={[0, attached.y + (attachedCoil?.radius || 1) + 0.2, 0]}>
            <mesh>
              <boxGeometry args={[0.6, 0.2, 0.6]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
