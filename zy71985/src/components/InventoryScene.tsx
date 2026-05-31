import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Effects } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { InventoryRecord } from '@/types';
import { STATUS_COLORS } from '@/types';

interface InventoryBoxProps {
  position: [number, number, number];
  record: InventoryRecord;
  onClick: (record: InventoryRecord) => void;
}

function InventoryBox({ position, record, onClick }: InventoryBoxProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[record.status];
  const height = Math.max(0.3, record.preOccupyQty / 200);

  useFrame((state) => {
    if (meshRef.current) {
      const targetScale = hovered ? 1.1 : 1;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.02;
    }
  });

  const emissiveIntensity = hovered ? 0.5 : 0.2;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick(record);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
    >
      <boxGeometry args={[0.8, height, 0.8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        metalness={0.3}
        roughness={0.4}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

interface GridFloorProps {
  size: number;
  divisions: number;
}

function GridFloor({ size, divisions }: GridFloorProps) {
  return (
    <gridHelper
      args={[size, divisions, '#1e3a5f', '#0f172a']}
      position={[0, -0.5, 0]}
    />
  );
}

interface SceneProps {
  records: InventoryRecord[];
  onBoxClick: (record: InventoryRecord) => void;
}

function Scene({ records, onBoxClick }: SceneProps) {
  const displayRecords = records.slice(0, 50);

  const positions = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(displayRecords.length));
    return displayRecords.map((record, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = (col - cols / 2) * 1.2 + 0.6;
      const z = (row - cols / 2) * 1.2 + 0.6;
      const height = Math.max(0.3, record.preOccupyQty / 200);
      return [x, height / 2 - 0.1, z] as [number, number, number];
    });
  }, [displayRecords]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-10, 5, -10]} intensity={0.5} color="#06B6D4" />
      <pointLight position={[10, 5, -10]} intensity={0.3} color="#8B5CF6" />

      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />

      <GridFloor size={30} divisions={30} />

      {displayRecords.map((record, index) => (
        <InventoryBox
          key={record.id}
          position={positions[index]}
          record={record}
          onClick={onBoxClick}
        />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
        autoRotate
        autoRotateSpeed={0.5}
      />

      <Effects>
        <EffectComposer>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Effects>
    </>
  );
}

interface InventorySceneProps {
  records: InventoryRecord[];
  onSelectRecord: (record: InventoryRecord) => void;
}

export default function InventoryScene({ records, onSelectRecord }: InventorySceneProps) {
  return (
    <Canvas
      camera={{ position: [8, 8, 8], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'linear-gradient(to bottom, #0f172a, #020617)' }}
    >
      <fog attach="fog" args={['#0f172a', 15, 40]} />
      <Scene records={records} onBoxClick={onSelectRecord} />
    </Canvas>
  );
}
