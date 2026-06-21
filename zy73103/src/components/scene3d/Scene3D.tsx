import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Grid } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useAppStore } from '../../store/useStore';
import {
  getSchemeColor,
  getSchemeStroke,
} from '../../utils/helpers';

function RoofPanel({
  position,
  size,
  slopeDeg,
  color,
  stroke,
  highlight,
  anomaly,
  onClick,
}: {
  position: [number, number, number];
  size: [number, number];
  slopeDeg: number;
  color: string;
  stroke: string;
  highlight: boolean;
  anomaly: boolean;
  onClick?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);
  const pulseRef = useRef(0);

  const slope = (slopeDeg * Math.PI) / 180;

  const edges = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size[0], size[1], 1, 1);
    return new THREE.EdgesGeometry(geo);
  }, [size]);

  useFrame((_, dt) => {
    pulseRef.current += dt;
    if (anomaly && edgeRef.current) {
      const p = (Math.sin(pulseRef.current * 2.6) + 1) * 0.5;
      const s = 1 + p * 0.04;
      edgeRef.current.scale.set(s, s, 1);
      const mat = edgeRef.current.material as THREE.LineBasicMaterial;
      mat.color.setRGB(1, 0.22 + p * 0.3, 0.22 + p * 0.2);
      mat.opacity = 0.55 + p * 0.45;
    }
    if (highlight && meshRef.current) {
      const p = (Math.sin(pulseRef.current * 3.5) + 1) * 0.5;
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.25 + p * 0.6;
    }
  });

  return (
    <group
      position={[position[0], position[1], position[2]]}
      rotation={[-slope, 0, 0]}
      onClick={onClick}
    >
      <mesh ref={meshRef} receiveShadow castShadow>
        <planeGeometry args={[size[0], size[1]]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={highlight ? 0.78 : 0.58}
          emissive={stroke}
          emissiveIntensity={highlight ? 0.5 : 0.12}
          metalness={0.15}
          roughness={0.65}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments ref={edgeRef} geometry={edges}>
        <lineBasicMaterial
          color={anomaly ? '#ef4444' : stroke}
          transparent
          opacity={anomaly ? 0.85 : 0.8}
          linewidth={2}
        />
      </lineSegments>
    </group>
  );
}

function DrainPoint({
  position,
  active,
  label,
}: {
  position: [number, number, number];
  active: boolean;
  label: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.9;
      ref.current.position.y =
        position[1] + 0.15 + Math.sin(performance.now() * 0.003) * 0.04;
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <torusGeometry args={[0.13, 0.04, 10, 28]} />
        <meshStandardMaterial
          color={active ? '#e2e8f0' : '#64748b'}
          emissive={active ? '#60a5fa' : '#1e293b'}
          emissiveIntensity={active ? 0.9 : 0.1}
          metalness={0.9}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.05, 24]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.4} />
      </mesh>
      <Html
        position={[0, 0.35, 0]}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none' }}
      >
        <span
          className="rounded-sm bg-slate-950/85 px-1.5 py-0.5 font-mono text-[10px] text-blue-300 border border-blue-500/40 whitespace-nowrap"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
}

function Gutter({
  points,
  stroke,
}: {
  points: [number, number, number][];
  stroke: string;
}) {
  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    return new THREE.TubeGeometry(curve, 64, 0.05, 10, false);
  }, [points]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color={stroke}
        metalness={0.8}
        roughness={0.35}
        emissive={stroke}
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

function SlopeArrows({ zones }: { zones: { pos: [number, number, number]; dir: [number, number] }[] }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((c, i) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity =
          0.3 + (Math.sin(performance.now() * 0.0025 + i) + 1) * 0.35;
      });
      void dt;
    }
  });
  return (
    <group ref={groupRef}>
      {zones.map((z, i) => (
        <mesh
          key={i}
          position={[z.pos[0], z.pos[1] + 0.18, z.pos[2]]}
          rotation={[
            -Math.PI / 2,
            0,
            Math.atan2(z.dir[1], z.dir[0]) - Math.PI / 2,
          ]}
        >
          <coneGeometry args={[0.12, 0.35, 4]} />
          <meshStandardMaterial
            color="#93c5fd"
            emissive="#3b82f6"
            emissiveIntensity={0.5}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

function CameraFollowSelection() {
  const { controls } = useThree();
  const selected = useAppStore((s) => s.selectedSchemeId);
  const highlightId = useAppStore((s) => s.highlightZoneId);
  const controlsRef = controls as unknown as {
    target: THREE.Vector3;
    object: THREE.PerspectiveCamera;
    update: () => void;
  };
  useFrame(() => {
    if (!controlsRef) return;
    const targetY = highlightId ? 0.3 : 0;
    controlsRef.target.lerp(
      new THREE.Vector3(0, targetY, highlightId ? -0.5 : 0),
      0.05,
    );
    void selected;
  });
  return null;
}

export default function Scene3D() {
  const selected = useAppStore((s) => s.selectedSchemeId);
  const schemes = useAppStore((s) => s.schemes);
  const anomalies = useAppStore((s) => s.anomalies);
  const highlightId = useAppStore((s) => s.highlightZoneId);

  const scheme = schemes.find((x) => x.id === selected)!;
  const stroke = getSchemeStroke(selected);
  const color = getSchemeColor(selected, 0.45);

  const drainPoints: { pos: [number, number, number]; label: string }[] =
    scheme.roofZones.map((z, i) => ({
      pos: [z.position[0] + z.size[0] * 0.35, 0.02, z.position[2] + z.size[1] * 0.4],
      label: `DP-${selected}-${i + 1}`,
    }));

  const gutterPoints: [number, number, number][] =
    scheme.roofZones.length >= 3
      ? [
          [scheme.roofZones[0].position[0] - scheme.roofZones[0].size[0] / 2, 0.03, scheme.roofZones[0].position[2]],
          [0, 0.03, -0.4],
          [scheme.roofZones[scheme.roofZones.length - 1].position[0] + scheme.roofZones[scheme.roofZones.length - 1].size[0] / 2, 0.03, scheme.roofZones[scheme.roofZones.length - 1].position[2]],
        ]
      : [
          [-5, 0.03, 0],
          [5, 0.03, 0],
        ];

  const slopeArrows = scheme.roofZones.map((z) => ({
    pos: [z.position[0], 0, z.position[2]] as [number, number, number],
    dir: [0.2, 0.6] as [number, number],
  }));

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [7.5, 8, 10], fov: 42 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#070d1a']} />
      <fog attach="fog" args={['#070d1a', 18, 40]} />

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-6, 4, -4]} intensity={0.5} color="#60a5fa" />
      <pointLight position={[6, 3, 4]} intensity={0.3} color="#f59e0b" />

      <Grid
        position={[0, -0.01, 0]}
        args={[24, 24]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={6}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={28}
        fadeStrength={1.2}
        followCamera={false}
        infiniteGrid
      />

      <group>
        {scheme.roofZones.map((z) => {
          const hasAnom =
            z.hasAnomaly ||
            anomalies.some((a) => a.affectedZoneId === z.id && a.status !== 'resolved');
          return (
            <RoofPanel
              key={z.id}
              position={z.position}
              size={z.size}
              slopeDeg={z.slope}
              color={color}
              stroke={stroke}
              highlight={highlightId === z.id}
              anomaly={!!hasAnom}
              onClick={() => {
                if (hasAnom) {
                  const match = anomalies.find((a) => a.affectedZoneId === z.id);
                  if (match) useAppStore.getState().selectAnomaly(match.id);
                }
              }}
            />
          );
        })}

        <Gutter points={gutterPoints} stroke={stroke} />

        {drainPoints.map((d, i) => (
          <DrainPoint key={i} position={d.pos} active label={d.label} />
        ))}

        <SlopeArrows zones={slopeArrows} />

        <Html
          position={[0, 2.6, 0]}
          center
          distanceFactor={12}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="flex flex-col items-center gap-1"
            style={{ fontFamily: '"Chakra Petch", "Noto Sans SC", sans-serif' }}
          >
            <span className="rounded bg-slate-950/80 px-3 py-1 text-sm font-semibold text-blue-300 tracking-[0.25em] border border-blue-500/50 shadow-[0_0_20px_-6px_rgba(59,130,246,0.6)]">
              SCHEME · {selected} · {scheme.name.toUpperCase()}
            </span>
            <span className="rounded bg-slate-950/70 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-700/60 max-w-[520px] text-center leading-relaxed">
              {scheme.sceneAnnotation}
            </span>
          </div>
        </Html>

        {scheme.roofZones.map((z) => (
          <Html
            key={`${z.id}-lbl`}
            position={[z.position[0] - z.size[0] / 2 + 0.15, 0.35, z.position[2] - z.size[1] / 2 + 0.15]}
            distanceFactor={10}
            style={{ pointerEvents: 'none' }}
          >
            <span
              className="rounded-sm bg-slate-900/80 px-1 py-0.5 text-[10px] text-slate-300 border border-slate-600/60"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {z.label} · {z.slope}%
            </span>
          </Html>
        ))}
      </group>

      <CameraFollowSelection />

      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2.15}
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.22}
          luminanceSmoothing={0.9}
          intensity={0.85}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
