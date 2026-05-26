import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, Grid } from "@react-three/drei";
import type { LevelConfig } from "@/types/game";
import { useGameStore } from "@/store/gameStore";
import { Crane3D } from "./Crane3D";
import { Coil3D } from "./Coil3D";
import { Zone3D } from "./Zone3D";
import { Rail3D } from "./Rail3D";
import { Ground3D } from "./Ground3D";
import { PlannedPath } from "./PlannedPath";

interface Props {
  level: LevelConfig;
}

export function GameCanvas({ level }: Props) {
  const cranePositions = useGameStore((s) => s.cranePositions);
  const coilPositions = useGameStore((s) => s.coilPositions);
  const selectedCoilId = useGameStore((s) => s.selectedCoilId);
  const selectedZoneId = useGameStore((s) => s.selectedZoneId);
  const currentCoilId = useGameStore((s) => s.currentCoilId);
  const phase = useGameStore((s) => s.phase);
  const status = useGameStore((s) => s.status);

  const { width, height } = useMemo(() => {
    const w = level.boundary.maxX - level.boundary.minX;
    const h = level.boundary.maxZ - level.boundary.minZ;
    return { width: w, height: h };
  }, [level]);

  const camZoom = Math.max(width, height) * 0.18;

  return (
    <Canvas shadows dpr={[1, 2]} className="w-full h-full">
      <OrthographicCamera
        makeDefault
        position={[0, 18, 18]}
        zoom={camZoom}
        near={0.1}
        far={100}
      />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <color attach="background" args={["#0a1220"]} />

      <Ground3D boundary={level.boundary} />

      <Grid
        position={[0, 0.01, 0]}
        args={[Math.max(width, height), Math.max(width, height)]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a2740"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#243048"
        fadeDistance={Math.max(width, height) * 2}
        infiniteGrid={false}
      />

      {level.rails.map((r) => (
        <Rail3D key={r.id} rail={r} />
      ))}

      {level.zones.map((z) => (
        <Zone3D
          key={z.id}
          zone={z}
          selected={selectedZoneId === z.id}
          selectable={phase === "planning" && selectedCoilId !== null}
        />
      ))}

      {level.coils.map((coil) => {
        const pos = coilPositions[coil.id];
        return (
          <Coil3D
            key={coil.id}
            coil={coil}
            position={pos}
            selected={selectedCoilId === coil.id}
            current={currentCoilId === coil.id}
            selectable={phase === "selecting" || phase === "planning"}
          />
        );
      })}

      {level.cranes.map((crane) => {
        const pos = cranePositions[crane.id] || { x: crane.start, z: crane.fixed, y: crane.y };
        const attachedCoilId =
          phase === "lifting" || phase === "moving" || phase === "lowering"
            ? currentCoilId
            : null;
        return (
          <Crane3D
            key={crane.id}
            crane={crane}
            position={pos}
            attachedCoilId={attachedCoilId}
          />
        );
      })}

      {phase === "planning" && selectedCoilId && (
        <PlannedPath
          level={level}
          coilId={selectedCoilId}
          zoneId={selectedZoneId}
        />
      )}

      {(status === "failed" || status === "success") && (
        <pointLight position={[0, 6, 0]} intensity={2} color={status === "failed" ? "#d9363e" : "#16a34a"} distance={20} />
      )}
    </Canvas>
  );
}
