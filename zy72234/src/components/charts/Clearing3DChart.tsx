import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ChartDataPoint } from '@shared/types';
import { useNavigate } from 'react-router-dom';
import { useClearingStore } from '@/store/useClearingStore';

interface BarProps {
  position: [number, number, number];
  height: number;
  color: string;
  isFlagged: boolean;
  onClick: () => void;
  date: string;
  amount: number;
}

function Bar({ position, height, color, isFlagged, onClick, date, amount }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [pulseScale, setPulseScale] = useState(1);

  useFrame((state) => {
    if (isFlagged) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      setPulseScale(pulse);
    }
    if (meshRef.current && hovered) {
      meshRef.current.scale.y = 1.05;
    } else if (meshRef.current) {
      meshRef.current.scale.y = 1;
    }
  });

  const barColor = isFlagged ? '#ef4444' : color;
  const displayHeight = Math.max(height, 0.5);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        position={[0, displayHeight / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={[1, pulseScale, 1]}
        castShadow
      >
        <boxGeometry args={[0.6, displayHeight, 0.6]} />
        <meshStandardMaterial
          color={barColor}
          emissive={isFlagged ? barColor : '#000000'}
          emissiveIntensity={isFlagged ? 0.3 : 0}
          metalness={0.3}
          roughness={0.4}
          transparent
          opacity={hovered ? 0.9 : 1}
        />
      </mesh>
      {hovered && (
        <Text
          position={[0, displayHeight + 0.5, 0]}
          fontSize={0.3}
          color="#1a1f2e"
          anchorX="center"
          anchorY="middle"
        >
          {`${date}: ¥${amount.toLocaleString()}`}
        </Text>
      )}
    </group>
  );
}

function Scene({ data, onBarClick }: { data: ChartDataPoint[]; onBarClick: (point: ChartDataPoint) => void }) {
  const maxAmount = useMemo(() => Math.max(...data.map((d) => d.amount)), [data]);
  const normalizedData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        normalizedHeight: (d.amount / maxAmount) * 8 + 0.5,
      })),
    [data, maxAmount]
  );

  const spacing = 1.2;
  const startX = -((data.length - 1) * spacing) / 2;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[data.length * spacing + 2, 12]} />
        <meshStandardMaterial color="#f4f6fa" />
      </mesh>

      <gridHelper args={[data.length * spacing + 2, 12, '#c7cfe0', '#e6e9f2']} position={[0, 0.01, 0]} />

      {normalizedData.map((point, index) => (
        <Bar
          key={point.date}
          position={[startX + index * spacing, 0, 0]}
          height={point.normalizedHeight}
          color="#3a4b73"
          isFlagged={point.hasFlagged}
          onClick={() => onBarClick(point)}
          date={point.date.slice(5)}
          amount={point.amount}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={20}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

interface Clearing3DChartProps {
  data: ChartDataPoint[];
}

export default function Clearing3DChart({ data }: Clearing3DChartProps) {
  const navigate = useNavigate();
  const navigateToAdjustmentOrCustody = useClearingStore((state) => state.navigateToAdjustmentOrCustody);

  const handleBarClick = (point: ChartDataPoint) => {
    if (point.adjustmentIds && point.adjustmentIds.length > 0) {
      const firstId = point.adjustmentIds[0];
      navigateToAdjustmentOrCustody(firstId, navigate);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-carbon-400">
        暂无图表数据
      </div>
    );
  }

  return (
    <div className="w-full h-96 relative">
      <Canvas
        camera={{ position: [0, 8, 12], fov: 45 }}
        shadows
        gl={{ antialias: true }}
      >
        <Scene data={data} onBarClick={handleBarClick} />
      </Canvas>
      <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs text-carbon-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-carbon-500 rounded" />
          <span>正常</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-risk-red rounded animate-pulse-slow" />
          <span>异常（点击跳转）</span>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 text-xs text-carbon-400">
        鼠标拖拽可旋转视角
      </div>
    </div>
  );
}
