import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { AttendanceRecord } from '@/types';
import { getTicketTypeLabel } from '@/utils';

interface Bar3DProps {
  position: [number, number, number];
  height: number;
  color: string;
  record: AttendanceRecord;
  onSelect: (record: AttendanceRecord) => void;
}

function Bar3D({ position, height, color, record, onSelect }: Bar3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      const targetScale = hovered ? 1.1 : 1;
      meshRef.current.scale.y = THREE.MathUtils.lerp(
        meshRef.current.scale.y,
        targetScale,
        0.1
      );
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        position={[0, height / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(record);
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.7, height, 0.7]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.3 : 0.1}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      {hovered && (
        <Html center position={[0, height + 0.5, 0]}>
          <div className="bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-xl border border-primary-200 whitespace-nowrap pointer-events-none">
            <p className="font-semibold text-primary-900 text-sm">{record.name}</p>
            <p className="text-xs text-primary-600">{getTicketTypeLabel(record.type)}</p>
            {record.remark && (
              <p className="text-xs text-primary-500 mt-0.5">{record.remark}</p>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

interface SceneProps {
  records: AttendanceRecord[];
  onSelect: (record: AttendanceRecord) => void;
}

function Scene({ records, onSelect }: SceneProps) {
  const maxHeight = 4;
  const barSpacing = 1.2;
  const perRow = 6;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#14b8a6" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#f0fdfa" transparent opacity={0.8} />
      </mesh>

      <gridHelper
        args={[30, 30, '#14b8a633', '#0f766e22']}
        position={[0, 0.01, 0]}
      />

      {records.map((record, index) => {
        const row = Math.floor(index / perRow);
        const col = index % perRow;
        const x = (col - perRow / 2 + 0.5) * barSpacing;
        const z = (row - Math.ceil(records.length / perRow) / 2 + 0.5) * barSpacing;
        const height = maxHeight * (0.4 + Math.random() * 0.6);
        const color = record.type === 'free' ? '#0ea5e9' : '#10b981';

        return (
          <Bar3D
            key={record.id}
            position={[x, 0, z]}
            height={height}
            color={color}
            record={record}
            onSelect={onSelect}
          />
        );
      })}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={25}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

interface View3DProps {
  records: AttendanceRecord[];
  onSelectRecord: (record: AttendanceRecord) => void;
}

export default function View3D({ records, onSelectRecord }: View3DProps) {
  return (
    <div className="glass rounded-2xl border border-white/50 overflow-hidden">
      <div className="p-4 border-b border-primary-100 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-primary-900">3D数据视图</h3>
          <p className="text-sm text-primary-500 mt-0.5">
            点击柱子可查看原始签到记录 · 鼠标拖拽旋转 · 滚轮缩放
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-sky-700">
            <span className="w-3 h-3 rounded bg-sky-500" />
            赠票 ({records.filter((r) => r.type === 'free').length})
          </span>
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            售票 ({records.filter((r) => r.type === 'paid').length})
          </span>
        </div>
      </div>
      <div className="h-[450px] bg-gradient-to-b from-primary-50/50 to-white">
        <Canvas
          camera={{ position: [12, 10, 12], fov: 45 }}
          shadows
        >
          <Scene records={records} onSelect={onSelectRecord} />
        </Canvas>
      </div>
    </div>
  );
}
