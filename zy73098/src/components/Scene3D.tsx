import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Outline } from '@react-three/postprocessing';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { FireZone, SchemeId, ReviewRecord } from '../types';
import { useReviewStore } from '../store/reviewStore';
import { SCHEME_COLORS, STATUS_LABEL } from '../data/mockData';

interface ZoneMeshProps {
  zone: FireZone;
  schemeId: SchemeId;
  selected: boolean;
  statusKey?: keyof typeof STATUS_LABEL;
  onSelect: (id: string) => void;
}

function ZoneMesh({ zone, schemeId, selected, statusKey, onSelect }: ZoneMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const baseColor = zone.color[schemeId];
  const statusColor = statusKey
    ? statusKey === 'confirmed'
      ? '#34D399'
      : statusKey === 'pending'
      ? '#FBBF24'
      : '#FB7185'
    : baseColor;

  const finalColor = selected ? statusColor : hovered ? baseColor : baseColor;
  const opacity = selected ? 0.78 : hovered ? 0.62 : 0.46;

  return (
    <group position={zone.position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(zone.id);
        }}
      >
        <boxGeometry args={zone.size} />
        <meshStandardMaterial
          color={finalColor}
          transparent
          opacity={opacity}
          roughness={0.35}
          metalness={0.25}
          emissive={selected ? statusColor : hovered ? baseColor : '#000000'}
          emissiveIntensity={selected ? 0.35 : hovered ? 0.18 : 0}
        />
      </mesh>

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...zone.size)]} />
        <lineBasicMaterial
          color={selected ? statusColor : hovered ? '#FFFFFF' : 'rgba(200,220,255,0.55)'}
          transparent
          opacity={selected ? 1 : hovered ? 0.95 : 0.55}
        />
      </lineSegments>

      <Html
        position={[0, zone.size[1] / 2 + 0.55, 0]}
        center
        distanceFactor={10}
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={
            'px-2.5 py-1 rounded-[3px] font-mono text-[11px] tracking-wider whitespace-nowrap ' +
            (selected
              ? 'bg-slate-900/90 border-2 shadow-lg shadow-black/60 ' +
                (statusKey === 'confirmed'
                  ? 'border-emerald-400 text-emerald-200'
                  : statusKey === 'pending'
                  ? 'border-amber-400 text-amber-200'
                  : statusKey === 'returned'
                  ? 'border-rose-400 text-rose-200'
                  : 'border-sky-400 text-sky-200')
              : 'bg-slate-900/70 border border-slate-500/60 text-slate-200')
          }
        >
          <span className="font-bold mr-1.5">{zone.id}</span>
          <span className="opacity-80">{zone.name}</span>
        </div>
      </Html>

      <Html
        position={[zone.size[0] / 2 + 0.2, zone.size[1] / 2, zone.size[2] / 2 + 0.2]}
        distanceFactor={14}
        zIndexRange={[0, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={
            'px-1.5 py-0.5 rounded-[2px] font-mono text-[9px] border ' +
            (statusKey
              ? STATUS_LABEL[statusKey].bg + ' ' + STATUS_LABEL[statusKey].border + ' ' + STATUS_LABEL[statusKey].color
              : 'bg-slate-700/60 border-slate-500/50 text-slate-300')
          }
        >
          {statusKey ? STATUS_LABEL[statusKey].text : '未记录'}
        </div>
      </Html>
    </group>
  );
}

function FloorPlate({ y, color = '#2A3A52' }: { y: number; color?: string }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[32, 22]} />
      <meshStandardMaterial color={color} transparent opacity={0.35} roughness={0.95} />
    </mesh>
  );
}

function AxisRuler() {
  return (
    <group position={[-15, 0.02, -10]}>
      <Grid
        args={[32, 22]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="rgba(120,170,220,0.12)"
        sectionSize={4}
        sectionThickness={0.8}
        sectionColor="rgba(120,170,220,0.35)"
        fadeDistance={60}
        fadeStrength={0.8}
        infiniteGrid={false}
      />
    </group>
  );
}

export default function Scene3D() {
  const {
    zones,
    records,
    activeScheme,
    selectedZoneId,
    selectZone
  } = useReviewStore();

  const statusByZone = useMemo(() => {
    const map = new Map<string, ReviewRecord['status']>();
    records
      .filter((r) => r.schemeId === activeScheme)
      .forEach((r) => map.set(r.zoneId, r.status));
    return map;
  }, [records, activeScheme]);

  const { main: glowColor } = SCHEME_COLORS[activeScheme];

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows={false}
        camera={{ position: [16, 16, 18], fov: 42, near: 0.1, far: 120 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => selectZone(null)}
      >
        <color attach="background" args={[0x121a27]} />

        <fog attach="fog" args={[0x121a27, 28, 72]} />

        <ambientLight intensity={0.55} color="#9FB4D9" />
        <directionalLight
          position={[14, 22, 10]}
          intensity={1.15}
          color="#E8EFFF"
        />
        <directionalLight
          position={[-12, 10, -8]}
          intensity={0.35}
          color={glowColor}
        />
        <pointLight
          position={[0, 7, 0]}
          intensity={0.5}
          color={glowColor}
          distance={26}
        />

        <AxisRuler />
        <FloorPlate y={0} />
        <FloorPlate y={2.6} color="#2E425E" />

        {zones.map((z) => {
          const status = statusByZone.get(z.id);
          const selected = selectedZoneId === z.id;
          return (
            <group key={z.id} position={[0, z.floor === 2 ? 2.8 : 0, 0]}>
              <ZoneMesh
                zone={z}
                schemeId={activeScheme}
                selected={selected}
                statusKey={status}
                onSelect={selectZone}
              />
            </group>
          );
        })}

        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.55}
          scale={40}
          blur={2.6}
          far={12}
          resolution={512}
        />

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={52}
          maxPolarAngle={Math.PI / 2 - 0.08}
          target={[0, 1.4, 0]}
        />

        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={0.75}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.65}
          />
          <Vignette eskil={false} offset={0.22} darkness={0.78} />
          <Outline
            selection={undefined}
            visibleEdgeColor={new THREE.Color(glowColor).getHex()}
            edgeStrength={selectedZoneId ? 2.8 : 1.2}
            pulseSpeed={selectedZoneId ? 0.8 : 0}
          />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/75 backdrop-blur border border-slate-500/40 rounded-[4px] px-3 py-2 font-mono text-[11px] text-slate-300">
          <span className="text-slate-400">N</span> 指北
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: glowColor }}></span>
            <span>{SCHEME_COLORS[activeScheme].label}</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 bg-slate-900/75 backdrop-blur border border-slate-500/40 rounded-[4px] px-3 py-2 font-mono text-[10px] text-slate-400 pointer-events-none space-y-1">
        <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">左键</kbd> 旋转</div>
        <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">右键</kbd> 平移</div>
        <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">滚轮</kbd> 缩放 · 点击分区选中</div>
      </div>
    </div>
  );
}
