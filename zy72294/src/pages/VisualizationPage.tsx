import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Box, BarChart3, RotateCcw, Ruler, FileText, X, MapPin } from 'lucide-react';
import { useAppStore } from '@/store';
import type { RangefinderRecord, VolumeEstimation } from '@/types';

type ViewMode = '3d' | 'chart';

interface StackInfo {
  record: RangefinderRecord;
  estimation: VolumeEstimation | undefined;
}

function Scene({
  stacks,
  selectedId,
  onSelect,
}: {
  stacks: StackInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const handleDoubleClick = () => {
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
    controlsRef.current?.reset();
  };

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <gridHelper args={[20, 20, '#ccc', '#eee']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>

      {stacks.map(({ record, estimation }) => {
        const height = estimation ? Math.min(estimation.volume / 10, 5) : 2;
        const isSelected = selectedId === record.id;
        const color = isSelected ? '#ff6b35' : '#446b9e';
        const x = (record.pointX - 2) * 3;
        const z = (record.pointY - 1.5) * 3;

        return (
          <group key={record.id}>
            {estimation?.calculationModel === 'cone' ? (
              <mesh
                position={[x, height / 2, z]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(record.id);
                }}
                castShadow
              >
                <coneGeometry args={[1.2, height, 32]} />
                <meshStandardMaterial color={color} transparent opacity={0.9} />
              </mesh>
            ) : estimation?.calculationModel === 'cuboid' ? (
              <mesh
                position={[x, height / 2, z]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(record.id);
                }}
                castShadow
              >
                <boxGeometry args={[2, height, 2]} />
                <meshStandardMaterial color={color} transparent opacity={0.9} />
              </mesh>
            ) : (
              <mesh
                position={[x, height / 2, z]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(record.id);
                }}
                castShadow
              >
                <cylinderGeometry args={[1, 1.3, height, 8]} />
                <meshStandardMaterial color={color} transparent opacity={0.9} />
              </mesh>
            )}
            {isSelected && (
              <mesh position={[x, height + 0.1, z]}>
                <ringGeometry args={[1.5, 1.6, 32]} />
                <meshBasicMaterial color="#ff6b35" />
              </mesh>
            )}
          </group>
        );
      })}

      <OrbitControls ref={controlsRef} makeDefault />
    </>
  );
}

export default function VisualizationPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { rangefinderRecords, volumeEstimations, getEstimationForRecord, setSelectedRecordId } = useAppStore();

  const uniqueRecords = rangefinderRecords.filter(
    (r, i, arr) => arr.findIndex((x) => x.batchNo === r.batchNo && x.pointX === r.pointX && x.pointY === r.pointY) === i
  );

  const stacks: StackInfo[] = uniqueRecords.map((record) => ({
    record,
    estimation: getEstimationForRecord(record.id),
  }));

  const chartData = stacks.map((s) => ({
    id: s.record.id,
    name: `堆垛 ${s.record.pointX}-${s.record.pointY}`,
    volume: s.estimation?.volume || 0,
    pointX: s.record.pointX,
    pointY: s.record.pointY,
  }));

  const selectedStack = stacks.find((s) => s.record.id === selectedId);

  const handleViewRecord = (path: string) => {
    if (selectedId) {
      setSelectedRecordId(selectedId);
      navigate(path);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900 mb-2">3D/图表展示</h1>
          <p className="text-gray-500">可视化展示堆垛位置与体积数据</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded">
          <button
            onClick={() => setViewMode('3d')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === '3d' ? 'bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Box className="w-4 h-4" />
            3D视图
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === 'chart' ? 'bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            图表视图
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
        {viewMode === '3d' ? (
          <div className="relative w-full h-full">
            <Canvas camera={{ position: [10, 10, 10] }} style={{ height: '500px' }}>
              <Scene stacks={stacks} selectedId={selectedId} onSelect={setSelectedId} />
            </Canvas>
            <button
              onClick={() => {
              }}
              className="absolute bottom-4 right-4 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
              title="重置视角（双击场景也可重置"
            >
              <RotateCcw className="w-5 h-5 text-gray-600" />
            </button>
            <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/80 px-3 py-2 rounded">
              拖动旋转 · 滚轮缩放 · 双击重置
            </div>
          </div>
        ) : (
          <div className="p-6 h-full">
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis label={{ value: '体积 (m³)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} m³`, '体积']}
                  labelFormatter={(label) => `堆垛 ${label}`}
                />
                <Bar dataKey="volume" onClick={(data) => setSelectedId(data.id)} cursor="pointer">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={selectedId === entry.id ? '#ff6b35' : '#446b9e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {selectedStack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-industrial-900">堆垛信息</h3>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    测距点
                  </p>
                  <p className="font-medium">
                    ({selectedStack.record.pointX}, {selectedStack.record.pointY})
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Ruler className="w-3 h-3" />
                    体积
                  </p>
                  <p className="font-medium">{selectedStack.estimation?.volume.toFixed(2)} m³</p>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded mb-6">
                <p className="text-xs text-gray-500 mb-1">计算模型</p>
                <p className="font-medium">
                  {selectedStack.estimation?.calculationModel === 'cone' && '锥体'}
                  {selectedStack.estimation?.calculationModel === 'cuboid' && '长方体'}
                  {selectedStack.estimation?.calculationModel === 'irregular' && '不规则体'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleViewRecord('/estimation')}
                  className="flex-1 py-2.5 bg-industrial-500 text-white font-medium rounded hover:bg-industrial-600 transition-colors text-sm"
                >
                  <Ruler className="w-4 h-4 inline mr-1" />
                  查看测距记录
                </button>
                <button
                  onClick={() => handleViewRecord('/obstacles')}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 transition-colors text-sm"
                >
                  <FileText className="w-4 h-4 inline mr-1" />
                  查看障碍物备注
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
