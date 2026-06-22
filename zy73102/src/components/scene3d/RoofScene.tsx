import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Html } from '@react-three/drei';
import { useMemo, useRef, useEffect } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import { useSceneStore } from '@/store/useSceneStore';
import type { MaterialItem } from '@/types';
import * as THREE from 'three';

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

function MaterialMarker({
  material,
  isSelected,
  isHighlighted,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  material: MaterialItem;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scaleRef = useRef(1);
  const targetScale = isSelected ? 1.5 : isHighlighted ? 1.3 : 1;

  useFrame(() => {
    if (meshRef.current) {
      scaleRef.current += (targetScale - scaleRef.current) * 0.15;
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  });

  const colors: Record<string, string> = {
    pipe: '#3b82f6',
    hopper: '#10b981',
    gutter: '#f59e0b',
    fitting: '#8b5cf6',
    sealant: '#ef4444',
  };

  const baseColor = colors[material.materialType] || '#64748b';
  const emissiveColor = isSelected ? '#ffffff' : isHighlighted ? baseColor : baseColor;
  const emissiveIntensity = isSelected ? 0.9 : isHighlighted ? 0.6 : 0.25;

  return (
    <group position={[material.position.x * 0.01, material.position.y * 0.01 + 0.2, material.position.z * 0.01]}>
      <mesh
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onPointerOver();
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = 'default';
          onPointerOut();
        }}
      >
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={isSelected ? 1 : isHighlighted ? 0.95 : 0.85}
        />
      </mesh>
      {isSelected && (
        <Html
          position={[0, 0.6, 0]}
          center
          distanceFactor={8}
          zIndexRange={[100, 0]}
        >
          <div className="pointer-events-none whitespace-nowrap rounded-lg bg-[#1F3A5F] px-2.5 py-1 text-[10px] font-medium text-white shadow-lg">
            {material.standardName}
          </div>
        </Html>
      )}
    </group>
  );
}

function MaterialMarkers() {
  const materials = useTrackStore((s) => s.materials);
  const currentRunId = useTrackStore((s) => s.currentRunId);
  const filterState = useTrackStore((s) => s.filterState);
  const collisions = useTrackStore((s) => s.collisions);
  const selectedMaterialId = useSceneStore((s) => s.selectedMaterialId);
  const highlightMaterialId = useSceneStore((s) => s.highlightMaterialId);
  const setSelectedMaterial = useSceneStore((s) => s.setSelectedMaterial);
  const highlightMaterial = useSceneStore((s) => s.highlightMaterial);
  const isCameraAnimating = useSceneStore((s) => s.isCameraAnimating);
  const setCameraAnimating = useSceneStore((s) => s.setCameraAnimating);
  const controlsRef = useRef<any>(null);

  const visible = useMemo(() => {
    const collisionMaterialIds = new Set(
      currentRunId
        ? collisions.filter((c) => c.runId === currentRunId).flatMap((c) => c.involvedMaterialIds)
        : collisions.flatMap((c) => c.involvedMaterialIds)
    );

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
      if (filterState.collisionOnly && !collisionMaterialIds.has(m.materialId))
        return false;
      return true;
    });
  }, [materials, currentRunId, filterState, collisions]);

  useEffect(() => {
    if (isCameraAnimating && highlightMaterialId && controlsRef.current) {
      const target = visible.find((m) => m.materialId === highlightMaterialId);
      if (target) {
        const pos = new THREE.Vector3(
          target.position.x * 0.01,
          target.position.y * 0.01 + 2,
          target.position.z * 0.01 + 4
        );
        controlsRef.current.target.set(
          target.position.x * 0.01,
          target.position.y * 0.01 + 0.2,
          target.position.z * 0.01
        );
        controlsRef.current.object.position.lerp(pos, 0.1);
        setTimeout(() => setCameraAnimating(false), 500);
      }
    }
  }, [isCameraAnimating, highlightMaterialId, visible, setCameraAnimating]);

  const handleClick = (material: MaterialItem) => {
    if (selectedMaterialId === material.materialId) {
      setSelectedMaterial(null, null);
    } else {
      setSelectedMaterial(material.materialId, material.standardName);
    }
  };

  return (
    <group>
      {visible.map((m: MaterialItem) => (
        <MaterialMarker
          key={m.materialId}
          material={m}
          isSelected={selectedMaterialId === m.materialId}
          isHighlighted={highlightMaterialId === m.materialId}
          onClick={() => handleClick(m)}
          onPointerOver={() => highlightMaterial(m.materialId)}
          onPointerOut={() => highlightMaterial(null)}
        />
      ))}
    </group>
  );
}

export default function RoofScene() {
  return (
    <div className="relative h-full w-full rounded-lg bg-gradient-to-b from-[#e8ecf1] to-[#cfd6de]">
      <Canvas shadows camera={{ position: [18, 16, 22], fov: 45 }}>
        <OrbitControls
          ref={(ref) => {
            (window as unknown as { __orbitControls?: unknown }).__orbitControls = ref;
          }}
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
        3D 场景 · 鼠标左键旋转 · 右键平移 · 滚轮缩放 · 点击球选中材料
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
