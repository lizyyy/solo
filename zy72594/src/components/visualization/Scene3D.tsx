import { useRef, useState } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { VisualizationDataPoint } from '../../types';

interface DataPointProps {
  point: VisualizationDataPoint;
  onClick: (point: VisualizationDataPoint) => void;
}

function DataPoint({ point, onClick }: DataPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(hovered ? 1.5 : 1);
    }
  });

  const color = point.sourceType === 'bucket'
    ? point.hasTimeWindowIssue ? '#fbbf24' : '#0ea5e9'
    : point.hasTimeWindowIssue ? '#fbbf24' : '#f43f5e';

  return (
    <mesh
      ref={meshRef}
      position={[point.x * 10 - 5, point.y * 10 - 5, (point.z || 0.5) * 10 - 5]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(point);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.5 : 0.2}
        transparent
        opacity={0.9}
      />
      {hovered && (
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {point.label}
        </Text>
      )}
    </mesh>
  );
}

function AxesGrid() {
  return (
    <group>
      <gridHelper args={[10, 10, '#334155', '#1e293b']} position={[0, -5, 0]} />
      <axesHelper args={[5]} position={[-5, -5, -5]} />
    </group>
  );
}

interface Scene3DProps {
  data: VisualizationDataPoint[];
  onPointClick: (point: VisualizationDataPoint) => void;
}

export function Scene3D({ data, onPointClick }: Scene3DProps) {
  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden" style={{ height: '500px' }}>
      <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
        <color attach="background" args={['#0f172a']} />
        <fog attach="fog" args={['#0f172a', 15, 30]} />
        
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <pointLight position={[-10, -5, -10]} intensity={0.5} color="#60a5fa" />
        <pointLight position={[0, 10, -10]} intensity={0.5} color="#34d399" />
        
        <AxesGrid />
        
        {data.map((point) => (
          <DataPoint key={point.id} point={point} onClick={onPointClick} />
        ))}
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={25}
        />
      </Canvas>
      <p className="text-center text-xs text-slate-500 py-3 bg-slate-900">
        拖拽旋转视角 · 滚轮缩放 · 点击数据点可回溯至对应线上实验桶或负样本列表
      </p>
    </div>
  );
}
