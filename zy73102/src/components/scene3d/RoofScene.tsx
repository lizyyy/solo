import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useMemo } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import type { MaterialItem } from '@/types';

function mockRoof() {
  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[30, 0.2, 20]} />
        <meshStandardMaterial color="#b8bec4" />
      </mesh>
      <mesh position={[-12, 2, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 4, 16]} />
        <meshStandardMaterial color="#5b6772" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[12, 2, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 4, 16]} />
        <meshStandardMaterial color="#5b6772" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, -8]}>
        <boxGeometry args={[30, 0.1, 0.4]} />
        <meshStandardMaterial color="#8a95a0" />
      </mesh>
      <mesh position={[0, 0.05, 8]}>
        <boxGeometry args={[30, 0.1, 0.4]} />
        <meshStandardMaterial color="#8a95a0" />
      </mesh>
    </group>
  );
}

function MaterialMarkers() {
  const materials = useTrackStore((s) => s.materials);
  const currentRunId = useTrackStore((s) => s.currentRunId);
  const filterState = useTrackStore((s) => s.filterState);

  const visible = useMemo(() => {
    return materials.filter((m: MaterialItem) => {
      if (currentRunId && m.runId !== currentRunId) return false;
      if (filterState.materialTypes.length > 0 && !filterState.materialTypes.includes(m.materialType))
        return false;
      if (
        filterState.processingStatuses.length > 0 &&
        !filterState.processingStatuses.includes(m.processingStatus)
      )
        return false;
      if (
        filterState.drawingVersions.length > 0 &&
        !filterState.drawingVersions.includes(m.drawingVersion)
      )
        return false;
      return true;
    });
  }, [materials, currentRunId, filterState]);

  const colors: Record<string, string> = {
    pipe: '#3b82f6',
    hopper: '#10b981',
    gutter: '#f59e0b',
    fitting: '#8b5cf6',
    sealant: '#ef4444',
  };

  return (
    <group>
      {visible.slice(0, 30).map((m: MaterialItem) => {
        const color = colors[m.materialType] || '#64748b';
        return (
          <mesh
            key={m.materialId}
            position={[m.position.x * 0.01, m.position.y * 0.01 + 0.2, m.position.z * 0.01]}
          >
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.25}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function RoofScene() {
  return (
    <div className="relative h-full w-full rounded-lg bg-gradient-to-b from-[#e8ecf1] to-[#cfd6de]">
      <Canvas shadows camera={{ position: [18, 16, 22], fov: 45 }}>
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2.1}
        />
        <Environment preset="city" />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 8]} intensity={1.1} castShadow />
        <Grid args={[40, 40]} cellSize={1} sectionSize={5} position={[0, -0.2, 0]} fadeDistance={60} infiniteGrid />
        {mockRoof()}
        <MaterialMarkers />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/80 px-3 py-1.5 text-xs text-slate-600 shadow backdrop-blur">
        3D 场景 · 鼠标左键旋转 · 右键平移 · 滚轮缩放
      </div>
      <div className="pointer-events-none absolute right-3 top-3 space-y-1 rounded bg-white/80 p-2 text-xs shadow backdrop-blur">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]"></span>管道 pipe</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#10b981]"></span>雨水斗 hopper</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]"></span>天沟 gutter</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]"></span>管件 fitting</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]"></span>密封 sealant</div>
      </div>
    </div>
  );
}
