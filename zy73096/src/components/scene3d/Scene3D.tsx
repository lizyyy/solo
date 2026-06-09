import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, Grid, Line } from "@react-three/drei";
import { EffectComposer, Bloom, Selection, Select } from "@react-three/postprocessing";
import * as THREE from "three";
import { FIRE_ZONES } from "@/data/zones";
import type { CollisionLevel, CollisionPoint } from "@/types";
import { usePreviewStore } from "@/store/usePreviewStore";

const LEVEL_COLOR: Record<CollisionLevel, string> = {
  critical: "#d62828",
  warning: "#f77f00",
  info: "#457b9d",
};

function ZoneMesh({
  zone,
  isSelected,
  isFilterHit,
  onClick,
}: {
  zone: (typeof FIRE_ZONES)[number];
  isSelected: boolean;
  isFilterHit: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const opacity = isFilterHit ? 0.26 : 0.08;
  const edgeColor = hovered || isSelected ? "#dbe4ff" : "#5c7cfa";
  return (
    <Select enabled={isSelected}>
      <group
        position={zone.position as unknown as [number, number, number]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <mesh castShadow>
          <boxGeometry args={zone.size as unknown as [number, number, number]} />
          <meshStandardMaterial
            color={zone.color}
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
            metalness={0.05}
            roughness={0.9}
            emissive={isSelected ? zone.color : "#000000"}
            emissiveIntensity={isSelected ? 0.18 : 0}
          />
        </mesh>
        <lineSegments>
          <edgesGeometry
            args={[
              new THREE.BoxGeometry(
                zone.size[0],
                zone.size[1],
                zone.size[2],
              ),
            ]}
          />
          <lineBasicMaterial color={edgeColor} linewidth={hovered ? 2 : 1} />
        </lineSegments>
        <Html
          position={[zone.size[0] / 2, zone.size[1] + 0.4, zone.size[2] / 2]}
          center
          distanceFactor={14}
          zIndexRange={[0, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`font-eng text-[11px] px-2 py-0.5 border tracking-wider whitespace-nowrap
          ${isSelected
              ? "bg-blueprint-500 text-paper-50 border-blueprint-700"
              : "bg-paper-100/90 text-blueprint-600 border-blueprint-300"
            }`}
          >
            {zone.id} · {zone.floor}F
          </div>
        </Html>
      </group>
    </Select>
  );
}

function CollisionMarker({
  col,
  selected,
  onClick,
}: {
  col: CollisionPoint;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 2.4 + col.position3D[0]) * 0.08;
    if (ref.current) ref.current.scale.setScalar(s);
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 1.2;
      const rs = 1.6 + ((t * 0.9) % 1) * 1.8;
      ringRef.current.scale.setScalar(rs);
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, 0.85 - ((t * 0.9) % 1) * 0.85);
    }
  });
  const color = LEVEL_COLOR[col.level];
  return (
    <Select enabled={selected}>
      <group
        position={col.position3D}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => (document.body.style.cursor = "crosshair")}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.72, 28]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={ref}>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.3}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
        <Html
          position={[0, 0.95, 0]}
          center
          distanceFactor={12}
          zIndexRange={[0, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`font-eng text-[10px] px-1.5 py-0.5 border tracking-widest whitespace-nowrap
          ${selected
            ? "bg-fire-fail text-paper-50 border-fire-fail"
            : "bg-paper-100/95 text-fire-critical border-fire-critical"
          }`}
          >
            {col.zoneA}×{col.zoneB} · {col.duplicateCount}条
          </div>
        </Html>
      </group>
    </Select>
  );
}

function ImpactLine({ col }: { col: CollisionPoint }) {
  const pa = col.position3D;
  return (
    <Line
      points={[
        [pa[0], pa[1] + 0.5, pa[2]],
        [pa[0], pa[1] + 2.6, pa[2]],
      ] as unknown as [number, number, number][]}
      color={LEVEL_COLOR[col.level]}
      lineWidth={1}
      dashed
      dashSize={0.12}
      gapSize={0.08}
    />
  );
}

function Scene() {
  const {
    filteredCollisions,
    allCollisions,
    version,
  } = usePreviewStore((s) => s.getVisibleState());
  const currentVersionId = usePreviewStore((s) => s.currentVersionId);
  const selectedCollisionId = usePreviewStore((s) => s.ui.selectedCollisionId);
  const setSelectedCollision = usePreviewStore(
    (s) => s.setSelectedCollision,
  );
  const selectedZoneIds = usePreviewStore((s) => s.ui.selectedZoneIds);
  const toggleZoneSelected = usePreviewStore((s) => s.toggleZoneSelected);
  const filterZones = usePreviewStore((s) => s.filters.zones);

  // 版本切换时轻量动画：根据当前versionId让分区淡入
  const verKey = currentVersionId;

  const filterZoneSet = useMemo(
    () => new Set(filterZones),
    [filterZones],
  );

  const visibleCols = filteredCollisions.length
    ? filteredCollisions
    : allCollisions;

  const colsForVersion = useMemo(
    () =>
      visibleCols.filter(
        (c) =>
          c.firstSeenVersionId === version?.id ||
          c.lastUpdatedVersionId === version?.id ||
          (version &&
            Number(version.id.replace(/\D/g, "")) >=
              Number(c.firstSeenVersionId.replace(/\D/g, ""))),
      ),
    [visibleCols, version],
  );

  return (
    <>
      <ambientLight intensity={0.55} color="#dbe4ff" />
      <directionalLight
        position={[12, 18, 10]}
        intensity={1.0}
        color="#eaf1ff"
        castShadow
      />
      <directionalLight
        position={[-12, 10, -8]}
        intensity={0.45}
        color="#fff2d6"
      />
      <Grid
        args={[80, 40]}
        position={[10, -10.5, 4]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#5c7cfa"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#0a2463"
        fadeDistance={60}
        fadeStrength={0.8}
        infiniteGrid={false}
      />
      <group key={verKey}>
        {FIRE_ZONES.map((z) => (
          <ZoneMesh
            key={z.id}
            zone={z}
            isSelected={selectedZoneIds.includes(z.id)}
            isFilterHit={
              !filterZoneSet.size ||
              filterZoneSet.has(z.id)
            }
            onClick={() => toggleZoneSelected(z.id)}
          />
        ))}
        {colsForVersion.map((c) => (
          <group key={c.id}>
            <ImpactLine col={c} />
            <CollisionMarker
              col={c}
              selected={selectedCollisionId === c.id}
              onClick={() =>
                setSelectedCollision(
                  selectedCollisionId === c.id ? null : c.id,
                )
              }
            />
          </group>
        ))}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={10}
        maxDistance={70}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.08}
        target={[10, -4, 4]}
      />
    </>
  );
}

export function Scene3D() {
  return (
    <div className="w-full h-full relative bg-gradient-to-b from-[#020918] via-[#061539] to-[#0a2463] overflow-hidden">
      <div className="absolute inset-0 opacity-60 pointer-events-none bg-blueprint-grid bg-[length:48px_48px] mix-blend-screen" />
      <Canvas
        shadows={false}
        camera={{ position: [28, 18, 30], fov: 40, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#061539");
        }}
      >
        <Suspense fallback={null}>
          <Selection>
            <Scene />
            <EffectComposer multisampling={0} enableNormalPass={false}>
              <Bloom
                intensity={1.2}
                luminanceThreshold={0.25}
                luminanceSmoothing={0.5}
                mipmapBlur
                radius={0.55}
              />
            </EffectComposer>
          </Selection>
        </Suspense>
      </Canvas>
      <div className="absolute top-3 left-3 pointer-events-none">
        <div className="font-eng text-[10px] text-blueprint-100/80 tracking-[0.3em] border border-blueprint-200/40 px-2 py-1 bg-blueprint-700/40 backdrop-blur-sm">
          DRAWING · 3D FIRE ZONE PREVIEW · 1:200
        </div>
      </div>
      <div className="absolute top-3 right-3 pointer-events-none flex flex-col items-end gap-1">
        <div className="font-eng text-[10px] text-paper-50/80 tracking-widest border border-paper-100/30 px-2 py-1 bg-paper-100/5">
          ⌖ N / 指北
        </div>
        <div className="font-eng text-[10px] text-paper-50/70 tracking-wider px-2 py-0.5">
          鼠标左键：旋转 · 右键：无 · 滚轮：缩放
        </div>
      </div>
      <div className="absolute bottom-3 left-3 pointer-events-none flex items-end gap-2">
        <div className="flex gap-1">
          <div className="w-10 h-3 bg-fire-critical" />
          <div className="w-10 h-3 bg-fire-warning" />
          <div className="w-10 h-3 bg-fire-info" />
        </div>
        <div className="font-eng text-[10px] text-paper-100/80 tracking-widest">
          严重 / 警告 / 提示
        </div>
      </div>
    </div>
  );
}
