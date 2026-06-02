import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ShelterPoint, ShelterStatus } from '@/types';
import { useUIStore } from '@/store/uiStore';

interface ShelterMarkerProps {
  shelter: ShelterPoint;
  isSelected: boolean;
  onClick: () => void;
}

const ShelterMarker: React.FC<ShelterMarkerProps> = ({ shelter, isSelected, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  const isOverCapacity = shelter.reportedCount > shelter.designCapacity;
  const height = Math.min(5 + (shelter.reportedCount / shelter.designCapacity) * 10, 20);

  const color = isOverCapacity ? '#DC2626' :
    shelter.status === ShelterStatus.PROCESSED ? '#16A34A' :
    shelter.status === ShelterStatus.PENDING_VERIFY ? '#F97316' : '#DC2626';

  useFrame((state) => {
    if (isOverCapacity && pulseRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
      pulseRef.current.scale.setScalar(scale);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
    if (isSelected && meshRef.current) {
      meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });

  const x = (shelter.longitude - 116.395) * 1000;
  const z = (shelter.latitude - 39.915) * 1000;

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={meshRef}
        position={[0, height / 2, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <boxGeometry args={[3, height, 3]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.9 : 0.7}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : 0.2}
        />
      </mesh>

      {isOverCapacity && (
        <mesh ref={pulseRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4, 5, 32]} />
          <meshBasicMaterial color="#DC2626" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {isSelected && (
        <Html position={[0, height + 2, 0]} center>
          <div className="whitespace-nowrap rounded-lg bg-gray-800/95 px-3 py-2 text-sm text-white shadow-xl backdrop-blur-md border border-gray-600">
            <p className="font-bold">{shelter.standardName}</p>
            <p className="text-xs text-gray-400">{shelter.reportedCount} / {shelter.designCapacity}人</p>
            {isOverCapacity && <p className="text-xs text-red-400">⚠️ 超限{Math.round((shelter.reportedCount / shelter.designCapacity - 1) * 100)}%</p>}
          </div>
        </Html>
      )}

      <Html position={[0, height + 0.5, 0]} center distanceFactor={15}>
        <div className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-lg text-white text-xs font-bold',
          isOverCapacity ? 'bg-red-500' :
          shelter.status === ShelterStatus.PROCESSED ? 'bg-green-500' :
          shelter.status === ShelterStatus.PENDING_VERIFY ? 'bg-orange-500' : 'bg-red-500'
        )}>
          {shelter.reportedCount > shelter.designCapacity ? '!' : '✓'}
        </div>
      </Html>
    </group>
  );
};

const cn = (...args: any[]) => args.filter(Boolean).join(' ');

interface GroundProps {
  shelters: ShelterPoint[];
}

const Ground: React.FC<GroundProps> = ({ shelters }) => {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>

      <gridHelper args={[200, 50, '#334155', '#1E293B']} position={[0, 0.01, 0]} />

      {shelters.map((shelter) => {
        if (!shelter.reportedLatitude || !shelter.reportedLongitude) return null;
        if (shelter.latitude === shelter.reportedLatitude && shelter.longitude === shelter.reportedLongitude) return null;

        const x1 = (shelter.longitude - 116.395) * 1000;
        const z1 = (shelter.latitude - 39.915) * 1000;
        const x2 = (shelter.reportedLongitude - 116.395) * 1000;
        const z2 = (shelter.reportedLatitude - 39.915) * 1000;

        return (
          <group key={`offset-${shelter.id}`}>
            <mesh position={[x2, 0.05, z2]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.5, 2, 16]} />
              <meshBasicMaterial color="#F59E0B" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([x1, 0.1, z1, x2, 0.1, z2])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineDashedMaterial color="#F59E0B" dashSize={2} gapSize={1} />
            </line>
          </group>
        );
      })}
    </group>
  );
};

interface Map3DProps {
  shelters: ShelterPoint[];
  selectedShelter: ShelterPoint | null;
  onSelectShelter: (shelterId: string) => void;
}

export const Map3D: React.FC<Map3DProps> = ({ shelters, selectedShelter, onSelectShelter }) => {
  const { openDetailPanel } = useUIStore();

  const handleMarkerClick = (shelter: ShelterPoint) => {
    onSelectShelter(shelter.id);
    openDetailPanel(shelter.id);
  };

  const cameraPosition = useMemo(() => {
    if (selectedShelter) {
      const x = (selectedShelter.longitude - 116.395) * 1000;
      const z = (selectedShelter.latitude - 39.915) * 1000;
      return [x + 30, 40, z + 30] as [number, number, number];
    }
    return [50, 60, 50] as [number, number, number];
  }, [selectedShelter]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: cameraPosition, fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0F172A']} />
        <fog attach="fog" args={['#0F172A', 50, 200]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[50, 80, 30]}
          intensity={1}
          color="#FEF3C7"
          castShadow
        />
        <hemisphereLight args={['#FFE4B5', '#1E3A5F', 0.6]} />

        <Stars radius={300} depth={60} count={2000} factor={4} saturation={0} fade speed={0.5} />

        <Ground shelters={shelters} />

        {shelters.map((shelter) => (
          <ShelterMarker
            key={shelter.id}
            shelter={shelter}
            isSelected={selectedShelter?.id === shelter.id}
            onClick={() => handleMarkerClick(shelter)}
          />
        ))}

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={20}
          maxDistance={150}
          maxPolarAngle={Math.PI / 2.2}
          target={selectedShelter ? [
            (selectedShelter.longitude - 116.395) * 1000,
            0,
            (selectedShelter.latitude - 39.915) * 1000
          ] : [0, 0, 0]}
        />
      </Canvas>

      <div className="absolute bottom-4 left-4 rounded-lg border border-gray-600 bg-gray-800/90 p-3 backdrop-blur-md">
        <p className="mb-2 text-xs font-medium text-gray-300">3D 操作提示</p>
        <div className="space-y-1 text-xs text-gray-400">
          <p>🖱️ 左键拖拽：旋转视角</p>
          <p>🖱️ 右键拖拽：平移</p>
          <p>🖱️ 滚轮：缩放</p>
          <p>👆 点击建筑：查看详情</p>
        </div>
      </div>
    </div>
  );
};
