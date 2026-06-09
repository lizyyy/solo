import { useMemo, useRef } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useReviewStore } from '@/store/reviewStore';
import type { ConclusionStatus, Zone } from '@/types';
import { STATUS_COLORS } from '@/types';
import { computeZoneStatusFromMaterials } from '@/utils/conclusion';

const STATUS_TO_COLOR: Record<ConclusionStatus | 'unreviewed' | 'selected', string> = {
  passed: STATUS_COLORS.passed,
  pending: STATUS_COLORS.pending,
  rejected: STATUS_COLORS.rejected,
  unreviewed: '#475569',
  selected: '#EA580C',
};

interface ZoneBoxProps {
  zone: Zone;
  onClick: (id: string) => void;
  selected: boolean;
  displayStatus: ConclusionStatus | 'unreviewed';
}

function ZoneBox({ zone, onClick, selected, displayStatus }: ZoneBoxProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    if (selected) {
      meshRef.current.position.y = zone.position[1] + Math.sin(t * 2) * 0.08;
    }
  });

  const color = selected ? STATUS_TO_COLOR.selected : STATUS_TO_COLOR[displayStatus];
  const edgeColor = selected ? '#F97316' : color;
  const opacity = selected ? 0.45 : 0.22;

  return (
    <group position={zone.position}>
      <mesh
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick(zone.id);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <boxGeometry args={zone.size} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>

      <lineSegments ref={edgesRef}>
        <edgesGeometry args={[new THREE.BoxGeometry(...zone.size)]} />
        <lineBasicMaterial color={edgeColor} linewidth={selected ? 3 : 1.5} />
      </lineSegments>

      <Html
        position={[0, zone.size[1] / 2 + 0.5, 0]}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="whitespace-nowrap font-mono text-[11px] px-2 py-0.5 border"
          style={{
            background: 'rgba(15,23,42,0.85)',
            borderColor: edgeColor,
            color: edgeColor,
          }}
        >
          {zone.id} · {zone.name}
        </div>
      </Html>
    </group>
  );
}

function GridAndAxes() {
  const gridRef = useRef<THREE.GridHelper>(null);
  return (
    <group>
      <gridHelper
        ref={gridRef}
        args={[40, 20, '#1E40AF', '#334155']}
        position={[0, -0.02, 0]}
      />
      <axesHelper args={[6]} position={[-18, 0, -18]} />
    </group>
  );
}

function FloorLabel({ y, text }: { y: number; text: string }) {
  return (
    <Html position={[-16, y + 2, 0]} style={{ pointerEvents: 'none' }} distanceFactor={6}>
      <div
        className="font-mono text-xs px-2 py-1 border border-eng-border"
        style={{ background: 'rgba(30,41,59,0.9)', color: '#94A3B8' }}
      >
        {text}
      </div>
    </Html>
  );
}

export default function Scene3D() {
  const {
    filteredZones,
    selectedZoneId,
    sourceFilter,
    selectZone,
  } = useReviewStore();

  const cameraTarget = useMemo(() => new THREE.Vector3(0, 6, 0), []);

  return (
    <div className="w-full h-full relative">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onClick={() => selectZone(null)}
        style={{ background: '#0F172A' }}
      >
        <OrthographicCamera
          makeDefault
          position={[22, 22, 22]}
          zoom={22}
          near={0.1}
          far={200}
        />
        <OrbitControls
          target={cameraTarget}
          enablePan={false}
          minZoom={10}
          maxZoom={60}
          enableDamping
          dampingFactor={0.08}
        />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 15, 10]} intensity={0.6} />
        <hemisphereLight args={['#94A3B8', '#0F172A', 0.5]} />

        <GridAndAxes />
        <FloorLabel y={-2} text="B1 · 地下一层" />
        <FloorLabel y={4} text="F1 · 一层" />
        <FloorLabel y={10} text="F2 · 二层" />

        {filteredZones.map((z) => {
          const status = computeZoneStatusFromMaterials(z.materials, sourceFilter);
          const display = status === 'unreviewed' ? 'unreviewed' : status;
          return (
            <ZoneBox
              key={z.id}
              zone={z}
              selected={selectedZoneId === z.id}
              displayStatus={display as ConclusionStatus | 'unreviewed'}
              onClick={selectZone}
            />
          );
        })}
      </Canvas>

      <div className="absolute bottom-3 left-3 eng-panel px-3 py-2 text-xs space-y-1 font-mono">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3" style={{ background: STATUS_TO_COLOR.passed }} />
          <span>已通过</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3" style={{ background: STATUS_TO_COLOR.pending }} />
          <span>待定</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3" style={{ background: STATUS_TO_COLOR.rejected }} />
          <span>驳回</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3" style={{ background: STATUS_TO_COLOR.unreviewed }} />
          <span>未复核(过滤后无材料)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3" style={{ background: STATUS_TO_COLOR.selected }} />
          <span>当前选中</span>
        </div>
      </div>

      <div className="absolute top-3 left-3 eng-panel px-3 py-2 text-xs text-eng-muted">
        <div>鼠标左键拖动旋转 · 滚轮缩放 · 点击分区查看详情</div>
      </div>
    </div>
  );
}
