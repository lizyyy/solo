import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Text, Line, Float } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { DataRecord, GreekAxis, CameraState } from '@/types';
import { getGreekColor, formatAxisLabel } from '@/utils/data';

interface PointProps {
  record: DataRecord
  xAxis: GreekAxis
  yAxis: GreekAxis
  zAxis: GreekAxis
  isSelected: boolean
  onClick: () => void
  hasSupplemental: boolean
}

function DataPoint({ record, xAxis, yAxis, zAxis, isSelected, onClick, hasSupplemental }: PointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  const x = (record.mapped[xAxis] as number) || 0;
  const y = (record.mapped[yAxis] as number) || 0;
  const z = (record.mapped[zAxis] as number) || 0;

  const isAnomaly = record.anomaly.isAnomaly;

  const baseColor = useMemo(() => {
    if (isAnomaly) return '#ef4444';
    if (hasSupplemental) return '#f59e0b';
    return getGreekColor(yAxis, y);
  }, [isAnomaly, yAxis, y, hasSupplemental]);

  const scale = useMemo(() => {
    const s = isAnomaly ? 0.22 : 0.15;
    return [s, s, s] as [number, number, number];
  }, [isAnomaly]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isAnomaly) {
      const t = clock.getElapsedTime();
      const pulse = 1 + Math.sin(t * 3) * 0.25;
      meshRef.current.scale.setScalar(scale[0] * pulse);
    }
  });

  return (
    <group position={[x, y, z]}>
      {isAnomaly && (
        <Float speed={2} floatIntensity={0.3}>
          <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={baseColor} transparent opacity={0.9} />
          </mesh>
          <pointLight color="#ef4444" intensity={0.6} distance={3} />
        </Float>
      )}
      {!isAnomaly && (
        <mesh
          ref={meshRef}
          scale={scale}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={baseColor} metalness={0.2} roughness={0.5} emissive={isSelected ? '#38bdf8' : '#000'} emissiveIntensity={isSelected ? 0.5 : 0} />
        </mesh>
      )}
      {isSelected && (
        <mesh>
          <ringGeometry args={[scale[0] * 1.5, scale[0] * 1.8, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {(hovered || isSelected) && (
        <Html center distanceFactor={6} position={[0, scale[1] * 2, 0]}>
          <div className="bg-[#0f1320]/95 border border-slate-600/50 px-2.5 py-1.5 rounded-md text-[10px] whitespace-nowrap backdrop-blur-sm">
            <div className="font-medium text-white font-mono">{record.mapped.label || record.id.slice(0, 6)}</div>
            <div className="text-slate-400 mt-0.5 font-mono">
              Δ={(record.mapped.delta as number)?.toFixed(3)} Γ={(record.mapped.gamma as number)?.toFixed(3)} ν={(record.mapped.vega as number)?.toFixed(1)}
            </div>
            {isAnomaly && (
              <div className="text-red-400 mt-0.5 font-medium">⚠ {record.anomaly.anomalyType}</div>
            )}
            {hasSupplemental && (
              <div className="text-amber-400 mt-0.5 text-[9px]">● 补录备注</div>
            )}
          </div>
        </Html>
      )}
      {hasSupplemental && !isAnomaly && (
        <pointLight color="#f59e0b" intensity={0.4} distance={2} />
      )}
    </group>
  );
}

function Axis({ axis, direction, label }: { axis: 'x' | 'y' | 'z'; direction: [number, number, number]; label: string }) {
  const len = 5;
  const end = direction.map(d => d * len) as [number, number, number];
  const colors: Record<string, string> = { x: '#ef4444', y: '#22c55e', z: '#3b82f6' };

  return (
    <group>
      <Line
        points={[[0, 0, 0], end]}
        color={colors[axis]}
        lineWidth={1}
        transparent
        opacity={0.6}
      />
      <Text position={end} fontSize={0.3} color={colors[axis]} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

interface CameraControllerProps {
  onCameraChange: (camera: CameraState) => void
}

function CameraController({ onCameraChange }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const lastSentRef = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (now - lastSentRef.current > 200 && controlsRef.current) {
      const target = controlsRef.current.target;
      onCameraChange({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
      });
      lastSentRef.current = now;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={3}
      maxDistance={30}
      makeDefault
    />
  );
}

interface Scene3DProps {
  data: DataRecord[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  axisMapping: { x: GreekAxis; y: GreekAxis; z: GreekAxis }
  onCameraChange: (camera: CameraState) => void
  initialCamera: CameraState
}

export default function Scene3D({ data, selectedId, onSelect, axisMapping, onCameraChange, initialCamera }: Scene3DProps) {
  const supplementalIds = useMemo(() => {
    const diff = JSON.parse(localStorage.getItem('greek-cloud-store') || '{}')?.state?.supplementalDiff || {};
    return new Set(Object.keys(diff));
  }, []);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('greek-cloud-store') || '{}');
    if (saved?.state?.camera) {
    }
  }, []);

  return (
    <div className="w-full h-full react-three-fiber-canvas">
      <Canvas
        camera={{ position: initialCamera.position, fov: 50 }}
        style={{ background: 'linear-gradient(180deg, #0f1320 0%, #1a1f36 100%)' }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onClick={() => onSelect(null)}
      >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} color="#e2e8f0" />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} color="#94a3b8" />

      <Grid
        args={[10, 10]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#334155"
        sectionSize={5}
        sectionThickness={0.5}
        sectionColor="#475569"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <Axis axis="x" direction={[1, 0, 0]} label={formatAxisLabel(axisMapping.x)} />
      <Axis axis="y" direction={[0, 1, 0]} label={formatAxisLabel(axisMapping.y)} />
      <Axis axis="z" direction={[0, 0, 1]} label={formatAxisLabel(axisMapping.z)} />

      {data.map(rec => (
        <DataPoint
          key={rec.id}
          record={rec}
          xAxis={axisMapping.x}
          yAxis={axisMapping.y}
          zAxis={axisMapping.z}
          isSelected={selectedId === rec.id}
          onClick={() => onSelect(rec.id)}
          hasSupplemental={supplementalIds.has(rec.id) || rec.notes.some(n => n.isSupplemental)}
        />
      ))}

      <CameraController onCameraChange={onCameraChange} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={0.8} />
      </EffectComposer>
      </Canvas>
    </div>
  );
}
