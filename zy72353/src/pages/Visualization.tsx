import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  LineChart,
  AlertTriangle,
  Thermometer,
  Eye,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useThresholdStore } from '../store/thresholdStore';
import { temperatureChartData } from '../data/mockData';
import { cn } from '../lib/utils';

interface CondenserPipeProps {
  position: [number, number, number];
  temperature: number;
  threshold: number;
  hasAlert: boolean;
  onHover: (show: boolean) => void;
  onClick: () => void;
  isSelected: boolean;
}

const CondenserPipe = ({
  position,
  temperature,
  threshold,
  hasAlert,
  onHover,
  onClick,
  isSelected,
}: CondenserPipeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current && hasAlert) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 1;
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current && isSelected) {
      const glow = Math.sin(state.clock.elapsedTime * 2) * 0.2 + 0.8;
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = glow * 0.3;
    }
  });

  const getColor = () => {
    if (hasAlert) return '#FF7D00';
    if (temperature < threshold) return '#165DFF';
    return '#00B42A';
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => onHover(true)}
        onPointerOut={() => onHover(false)}
        onClick={onClick}
      >
        <cylinderGeometry args={[0.3, 0.3, 4, 32]} />
        <meshStandardMaterial
          color={getColor()}
          metalness={0.8}
          roughness={0.2}
          emissive={getColor()}
          emissiveIntensity={hasAlert ? 0.3 : 0.1}
        />
      </mesh>

      {isSelected && (
        <mesh ref={glowRef} scale={1.2}>
          <cylinderGeometry args={[0.3, 0.3, 4, 32]} />
          <meshBasicMaterial color="#165DFF" transparent opacity={0.3} />
        </mesh>
      )}

      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={getColor()}
          emissive={getColor()}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, -2.2, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={getColor()}
          emissive={getColor()}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

const Scene = ({
  thresholds,
  selectedId,
  onSelect,
}: {
  thresholds: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const positions: [number, number, number][] = [
    [-3, 0, 0],
    [0, 0, 0],
    [3, 0, 0],
    [-1.5, 0, 3],
    [1.5, 0, 3],
  ];

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#165DFF" />

      <OrbitControls enableDamping dampingFactor={0.05} />

      <gridHelper args={[20, 20, '#4E5969', '#272E3B']} position={[0, -3, 0]} />

      {thresholds.slice(0, 5).map((threshold, index) => (
        <CondenserPipe
          key={threshold.id}
          position={positions[index] || [0, 0, 0]}
          temperature={threshold.value}
          threshold={-5}
          hasAlert={threshold.hasUnitMix}
          onHover={(show) => setHoveredId(show ? threshold.id : null)}
          onClick={() => onSelect(selectedId === threshold.id ? null : threshold.id)}
          isSelected={selectedId === threshold.id}
        />
      ))}

      {hoveredId && (
        <Float>
          <Html position={[0, 3, 0]} center>
            <div className="bg-industrial-600 border border-industrial-500 rounded-lg p-3 shadow-xl whitespace-nowrap">
              {(() => {
                const t = thresholds.find((th) => th.id === hoveredId);
                return t ? (
                  <>
                    <p className="text-white font-medium text-sm">{t.name}</p>
                    <p className="text-primary-400 font-mono">
                      {t.value} {t.unit === 'Celsius' ? '℃' : 'K'}
                    </p>
                    {t.hasUnitMix && (
                      <p className="text-warning-400 text-xs flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        单位混用
                      </p>
                    )}
                  </>
                ) : null;
              })()}
            </div>
          </Html>
        </Float>
      )}
    </>
  );
};

const Visualization = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const { thresholds, getDeviceById, currentRole } = useThresholdStore();
  const [viewMode, setViewMode] = useState<'3d' | 'chart'>('3d');
  const [selectedThreshold, setSelectedThreshold] = useState<string | null>(highlightId);

  useEffect(() => {
    if (highlightId) {
      setSelectedThreshold(highlightId);
    }
  }, [highlightId]);

  const selectedData = selectedThreshold
    ? thresholds.find((t) => t.id === selectedThreshold)
    : null;
  const selectedDevice = selectedData ? getDeviceById(selectedData.deviceId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">可视化展示</h1>
          <p className="text-industrial-300">
            当前角色：<span className="text-primary-400 font-medium">{currentRole === 'engineer' ? '设备工程师 何工' : '训练教练'}</span>
          </p>
        </div>
        <div className="flex bg-industrial-600 rounded-lg p-1">
          <button
            onClick={() => setViewMode('3d')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              viewMode === '3d'
                ? "bg-primary-500 text-white"
                : "text-industrial-300 hover:text-white"
            )}
          >
            <Box className="w-4 h-4" />
            3D 视图
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              viewMode === 'chart'
                ? "bg-primary-500 text-white"
                : "text-industrial-300 hover:text-white"
            )}
          >
            <LineChart className="w-4 h-4" />
            图表视图
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-industrial-600 rounded-xl border border-industrial-500 overflow-hidden">
            <div className="p-4 border-b border-industrial-500 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary-400" />
                <span className="text-white font-medium">
                  {viewMode === '3d' ? '冷凝管 3D 模型' : '温度趋势图表'}
                </span>
              </div>
              {selectedData && (
                <span className="text-industrial-400 text-sm">
                  已选择：{selectedData.name}
                </span>
              )}
            </div>

            {viewMode === '3d' ? (
              <div className="h-[500px] bg-industrial-700">
                <Canvas camera={{ position: [8, 5, 8], fov: 50 }}>
                  <color attach="background" args={['#171A21']} />
                  <fog attach="fog" args={['#171A21', 10, 30]} />
                  <Scene
                    thresholds={thresholds}
                    selectedId={selectedThreshold}
                    onSelect={setSelectedThreshold}
                  />
                </Canvas>
              </div>
            ) : (
              <div className="h-[500px] p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={temperatureChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#272E3B" />
                    <XAxis dataKey="time" stroke="#86909C" />
                    <YAxis stroke="#86909C" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1D2129',
                        border: '1px solid #272E3B',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                    <Legend />
                    <ReferenceLine
                      y={selectedData?.value || -5}
                      stroke="#FF7D00"
                      strokeDasharray="5 5"
                      label={{ value: '阈值', fill: '#FF7D00', fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke="#165DFF"
                      strokeWidth={3}
                      dot={{ fill: '#165DFF', strokeWidth: 2 }}
                      name="实际温度"
                    />
                    <Line
                      type="monotone"
                      dataKey="threshold"
                      stroke="#FF7D00"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="阈值线"
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-primary-400" />
              数据溯源
            </h3>

            {selectedData ? (
              <div className="space-y-4">
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">阈值名称</p>
                  <p className="text-white font-medium">{selectedData.name}</p>
                </div>
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">当前值</p>
                  <p className="text-white font-mono text-2xl">
                    {selectedData.value}
                    <span className="text-industrial-300 text-lg ml-1">
                      {selectedData.unit === 'Celsius' ? '℃' : 'K'}
                    </span>
                  </p>
                </div>
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">关联设备</p>
                  <p className="text-white">{selectedDevice?.name || '-'}</p>
                  <p className="text-industrial-400 text-sm">{selectedDevice?.model || '-'}</p>
                </div>

                {selectedData.hasUnitMix && (
                  <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-warning-400 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium text-sm">单位混用警告</span>
                    </div>
                    <p className="text-industrial-300 text-sm">
                      该设备下同时存在摄氏度和开尔文两种单位，请返回数据表或设备铭牌参数进行复核。
                    </p>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/threshold/${selectedData.id}`)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  查看完整数据
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Box className="w-12 h-12 text-industrial-400 mx-auto mb-3" />
                <p className="text-industrial-300 text-sm">点击模型上的冷凝管</p>
                <p className="text-industrial-400 text-sm">查看详细数据</p>
              </div>
            )}
          </div>

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-5">
            <h3 className="text-white font-semibold mb-4">图例说明</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-primary-500" />
                <span className="text-industrial-300 text-sm">正常温度</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-success-500" />
                <span className="text-industrial-300 text-sm">温度达标</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-warning-500 animate-pulse" />
                <span className="text-industrial-300 text-sm">单位混用警报</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Visualization;
