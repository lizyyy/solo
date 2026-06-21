import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTidalStore } from '@/store/useTidalStore';
import type { StationRecord, StationStatus } from '@/types';

const SPHERE_R = 10; // 地球半径

// 经纬度 → 球坐标（y 轴向上，右手系）
function latLngToVec3(lat: number, lng: number, r = SPHERE_R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// 经纬线
function Graticule() {
  const lines = useMemo(() => {
    const arr: { points: [number, number, number][] }[] = [];
    // 纬线（每 30°）
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: [number, number, number][] = [];
      for (let lng = -180; lng <= 180; lng += 5) {
        const v = latLngToVec3(lat, lng, SPHERE_R + 0.02);
        pts.push([v.x, v.y, v.z]);
      }
      arr.push({ points: pts });
    }
    // 经线（每 30°）
    for (let lng = -180; lng < 180; lng += 30) {
      const pts: [number, number, number][] = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        const v = latLngToVec3(lat, lng, SPHERE_R + 0.02);
        pts.push([v.x, v.y, v.z]);
      }
      arr.push({ points: pts });
    }
    return arr;
  }, []);

  return (
    <group>
      {lines.map((ln, i) => (
        <Line
          key={i}
          points={ln.points}
          color="#25d0c0"
          opacity={0.15}
          transparent
          lineWidth={0.5}
        />
      ))}
    </group>
  );
}

// 地球球体
function EarthSphere() {
  return (
    <mesh>
      <sphereGeometry args={[SPHERE_R, 64, 64]} />
      <meshStandardMaterial
        color="#0a2744"
        transparent
        opacity={0.75}
        roughness={0.85}
        metalness={0.1}
        emissive="#04162b"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

// 颜色配置
const STATUS_COLORS: Record<StationStatus, { main: string; emissive: string }> = {
  normal: { main: '#38d39f', emissive: '#1f8e69' },
  pending: { main: '#ffc93c', emissive: '#c79816' },
  exception: { main: '#ff5e62', emissive: '#b23a3d' },
};

// 单个站点 Marker
function StationMarker({
  station,
  selected,
  onClick,
}: {
  station: StationRecord;
  selected: boolean;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  // 跳过坐标为 null 的站
  if (station.latitude === null || station.longitude === null) return null;

  const basePos = latLngToVec3(station.latitude, station.longitude);
  const surfaceNormal = basePos.clone().normalize();
  const colors = STATUS_COLORS[station.status];

  // 上浮比例（选中上浮 30%）
  const liftR = selected ? SPHERE_R * 1.3 : SPHERE_R;
  const liftedPos = surfaceNormal.clone().multiplyScalar(liftR);

  // 动画帧
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // 平滑过渡位置
    groupRef.current.position.lerp(liftedPos, delta * 5);
    // 始终朝向球心外
    groupRef.current.lookAt(new THREE.Vector3(0, 0, 0));
    groupRef.current.rotateX(Math.PI / 2);

    // pending：呼吸透明度
    if (station.status === 'pending' && matRef.current) {
      const t = state.clock.elapsedTime * 2;
      matRef.current.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t));
    }
    // exception：闪烁 emissive
    if (station.status === 'exception' && matRef.current) {
      const t = state.clock.elapsedTime * 4;
      matRef.current.emissiveIntensity = 0.4 + 0.8 * (0.5 + 0.5 * Math.sin(t));
    }
    // Halo 旋转 + 缩放
    if (haloRef.current && selected) {
      haloRef.current.rotation.z += delta * 1.5;
      haloRef.current.scale.setScalar(1 + 0.05 * Math.sin(state.clock.elapsedTime * 3));
    }
  });

  const isNormal = station.status === 'normal';
  const isException = station.status === 'exception';

  return (
    <group ref={groupRef} position={basePos.toArray()}>
      {/* 圆柱主体 */}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <cylinderGeometry args={[0.12, 0.18, 0.6, 16]} />
        <meshStandardMaterial
          ref={matRef}
          color={colors.main}
          emissive={colors.emissive}
          emissiveIntensity={isNormal ? 0.8 : 0.5}
          transparent={station.status === 'pending'}
          opacity={1}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>

      {/* 顶部球 / 警戒锥 */}
      <mesh
        position={[0, 0.42, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {isException ? (
          <>
            <coneGeometry args={[0.18, 0.35, 6]} />
            <meshStandardMaterial
              color={colors.main}
              emissive={colors.emissive}
              emissiveIntensity={1.2}
              metalness={0.3}
              roughness={0.3}
            />
          </>
        ) : (
          <>
            <sphereGeometry args={[0.16, 20, 20]} />
            <meshStandardMaterial
              color={colors.main}
              emissive={colors.emissive}
              emissiveIntensity={isNormal ? 1.4 : 0.9}
              metalness={0.3}
              roughness={0.25}
            />
          </>
        )}
      </mesh>

      {/* Halo 选中环 */}
      {selected && (
        <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.48, 48]} />
          <meshBasicMaterial
            color="#25d0c0"
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* HTML 站名标签（选中时） */}
      {selected && (
        <Html position={[0, 1.1, 0]} center zIndexRange={[10, 0]}>
          <div className="label-sprite px-2.5 py-1 bg-ocean-surface/95 border border-glow-cyan
            rounded-sm clip-bevel-sm whitespace-nowrap shadow-glow">
            <span className="font-mono text-[11px] text-glow-cyan tracking-wide">
              {station.station_name}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

// 相机控制 + 视角切换
const VIEW_POSITIONS: Record<string, THREE.Vector3> = {
  top: new THREE.Vector3(0, SPHERE_R * 3, 0.001),
  sphere: new THREE.Vector3(SPHERE_R * 2, SPHERE_R * 1.2, SPHERE_R * 2),
  planar: new THREE.Vector3(0, SPHERE_R * 0.3, SPHERE_R * 3.2),
};

function CameraController({ view }: { view: string }) {
  const { camera } = useThree();
  const targetPos = useRef(VIEW_POSITIONS.sphere.clone());

  useEffect(() => {
    targetPos.current = VIEW_POSITIONS[view]?.clone() || VIEW_POSITIONS.sphere.clone();
  }, [view]);

  useFrame((_, delta) => {
    camera.position.lerp(targetPos.current, 1 - Math.pow(0.001, delta));
    camera.lookAt(0, 0, 0);
  });

  return (
    <OrbitControls
      enablePan={false}
      minDistance={SPHERE_R * 1.4}
      maxDistance={SPHERE_R * 6}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// 视角按钮 overlay（放在 Canvas 内部用 drei Html 不合适，改用 CSS overlay，这里用组内 Html）
function ViewButtons({
  current,
  onChange,
}: {
  current: string;
  onChange: (v: string) => void;
}) {
  const btn = (key: string, label: string) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(key);
      }}
      className={`px-3 py-1.5 font-mono text-[11px] tracking-wider border rounded-sm
        transition-all ${
          current === key
            ? 'bg-glow-cyan/20 border-glow-cyan text-glow-cyan shadow-glow'
            : 'bg-ocean-surface/80 border-ocean-line text-console-muted hover:border-glow-cyanDim hover:text-console-text'
        }`}
    >
      {label}
    </button>
  );
  return (
    <Html position={[0, SPHERE_R * 1.55, 0]} center zIndexRange={[100, 90]}>
      <div className="flex items-center gap-2 pointer-events-auto">
        {btn('top', 'TOP 俯视')}
        {btn('sphere', 'SPHERE 球面')}
        {btn('planar', 'PLANAR 平面')}
      </div>
    </Html>
  );
}

// 场景内部
function InnerScene({ view }: { view: string }) {
  const { stations, selected_station_id, selectStation } = useTidalStore();

  return (
    <>
      <color attach="background" args={['#050d1a']} />
      <fog attach="fog" args={['#050d1a', SPHERE_R * 3, SPHERE_R * 8]} />

      {/* 灯光 */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[SPHERE_R * 3, SPHERE_R * 2.5, SPHERE_R * 2]}
        intensity={0.9}
        color="#cfe8ff"
      />
      <pointLight position={[-SPHERE_R * 2, -SPHERE_R, -SPHERE_R * 2]} intensity={0.3} color="#25d0c0" />

      <CameraController view={view} />

      <EarthSphere />
      <Graticule />

      {/* 站点 */}
      {stations.map((s) => (
        <StationMarker
          key={s.annotation_id}
          station={s}
          selected={s.annotation_id === selected_station_id}
          onClick={() => selectStation(s.annotation_id)}
        />
      ))}

      {/* 视角按钮 */}
      <ViewButtons
        current={view}
        onChange={(v) => {
          // 通过外部 state 切换，这里通过 CustomEvent 简单传递
          window.dispatchEvent(new CustomEvent('tidal-view-change', { detail: v }));
        }}
      />

      {/* 后期 */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={0.6}
        />
      </EffectComposer>
    </>
  );
}

// 主组件
export default function Scene3D() {
  const [view, setView] = useState('sphere');

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setView(ce.detail);
    };
    window.addEventListener('tidal-view-change', handler);
    return () => window.removeEventListener('tidal-view-change', handler);
  }, []);

  return (
    <div className="relative w-full h-full radial-bg overflow-hidden">
      {/* 背景装饰扫描线 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07] z-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(37,208,192,0.5) 0, rgba(37,208,192,0.5) 1px, transparent 1px, transparent 4px)',
        }}
      />
      {/* 四角装饰 */}
      <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-glow-cyan/40 z-10 pointer-events-none" />
      <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-glow-cyan/40 z-10 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-glow-cyan/40 z-10 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-glow-cyan/40 z-10 pointer-events-none" />

      {/* 左上角 HUD 信息 */}
      <div className="absolute top-3 left-10 z-10 pointer-events-none">
        <div className="font-mono text-[10px] text-glow-cyan/70 tracking-widest uppercase">
          Global Buoy Network · 3D View
        </div>
      </div>

      <Canvas
        camera={{ position: [SPHERE_R * 2, SPHERE_R * 1.2, SPHERE_R * 2], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <InnerScene view={view} />
      </Canvas>
    </div>
  );
}
