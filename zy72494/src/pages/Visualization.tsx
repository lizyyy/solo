import { useState, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Box } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowLeft, MapPin, AlertTriangle, Layers, PieChart, X, ChevronRight, Info } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useAppStore } from '../store/appStore';

interface RampData {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  areaName: string;
  rampCount: number;
  hasIssue: boolean;
  complaintId?: string;
  score?: number;
  scoreUnchanged?: boolean;
}

function Ramp({ data, onClick, isSelected }: { data: RampData; onClick: () => void; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current && data.scoreUnchanged) {
      meshRef.current.position.y = data.position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  const color = data.hasIssue 
    ? (data.scoreUnchanged ? '#F59E0B' : '#EF4444') 
    : '#10B981';

  return (
    <group position={data.position}>
      <Box
        ref={meshRef}
        args={data.size}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={hovered || isSelected ? 0.9 : 0.7}
        />
      </Box>
      
      {(hovered || isSelected) && (
        <Html position={[0, data.size[1] / 2 + 0.3, 0]} center>
          <div className="bg-white px-3 py-2 rounded-lg shadow-lg whitespace-nowrap text-sm">
            <p className="font-medium text-gray-900">{data.areaName}</p>
            <p className="text-xs text-gray-500">坡道: {data.rampCount}个</p>
            {data.score !== undefined && (
              <p className={`text-xs font-bold ${data.score >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                评分: {data.score}
              </p>
            )}
          </div>
        </Html>
      )}

      {data.scoreUnchanged && (
        <Html position={[0, data.size[1] / 2 + 0.8, 0]} center>
          <div className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium animate-pulse">
            评分无变化，待复核
          </div>
        </Html>
      )}
    </group>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#E5E7EB" />
    </mesh>
  );
}

function Building({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <Box position={position} args={size}>
      <meshStandardMaterial color={color} />
    </Box>
  );
}

function Scene({ ramps, selectedRamp, onRampClick }: { 
  ramps: RampData[]; 
  selectedRamp: string | null;
  onRampClick: (id: string) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.4} />
      
      <Ground />
      
      <Building position={[-6, 2, -4]} size={[5, 4, 5]} color="#94A3B8" />
      <Building position={[6, 2.5, -3]} size={[4, 5, 5]} color="#A3A3A3" />
      <Building position={[-4, 1.5, 6]} size={[6, 3, 4]} color="#9CA3AF" />
      <Building position={[5, 2, 5]} size={[4, 4, 5]} color="#A8A29E" />

      <Box position={[0, 0.05, 0]} args={[8, 0.1, 8]}>
        <meshStandardMaterial color="#BBF7D0" />
      </Box>
      
      {ramps.map((ramp) => (
        <Ramp 
          key={ramp.id} 
          data={ramp} 
          onClick={() => onRampClick(ramp.id)}
          isSelected={selectedRamp === ramp.id}
        />
      ))}
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

export default function Visualization() {
  const navigate = useNavigate();
  const { complaints, redlineRemarks } = useAppStore();
  const [viewMode, setViewMode] = useState<'3d' | 'chart'>('3d');
  const [selectedRamp, setSelectedRamp] = useState<string | null>(null);

  const ramps: RampData[] = [
    {
      id: 'ramp-1',
      position: [-2, 0.15, -1],
      size: [1.5, 0.3, 2],
      areaName: '阳光花园A区',
      rampCount: 2,
      hasIssue: true,
      complaintId: 'c-001',
      score: 72,
      scoreUnchanged: true,
    },
    {
      id: 'ramp-2',
      position: [1, 0.15, 2],
      size: [1.2, 0.3, 1.8],
      areaName: '阳光花园B区',
      rampCount: 1,
      hasIssue: true,
      complaintId: 'c-002',
      score: 85,
    },
    {
      id: 'ramp-3',
      position: [2.5, 0.15, -1.5],
      size: [1.4, 0.3, 1.6],
      areaName: '和谐家园东区',
      rampCount: 3,
      hasIssue: false,
      complaintId: 'c-003',
      score: 90,
    },
    {
      id: 'ramp-4',
      position: [-1, 0.15, 2.5],
      size: [1.3, 0.3, 1.7],
      areaName: '和谐家园西区',
      rampCount: 2,
      hasIssue: true,
      complaintId: 'c-004',
      score: 65,
    },
  ];

  const selectedRampData = ramps.find((r) => r.id === selectedRamp);
  const selectedComplaint = selectedRampData?.complaintId 
    ? complaints.find((c) => c.id === selectedRampData.complaintId)
    : null;
  const selectedRedline = selectedComplaint?.redlineRemarkId
    ? redlineRemarks.find((r) => r.id === selectedComplaint.redlineRemarkId)
    : null;

  const chartData = [
    { area: '阳光A区', 投诉数: 3, 坡道问题: 2, 评分: 72 },
    { area: '阳光B区', 投诉数: 5, 坡道问题: 1, 评分: 85 },
    { area: '和谐东区', 投诉数: 1, 坡道问题: 0, 评分: 90 },
    { area: '和谐西区', 投诉数: 0, 坡道问题: 2, 评分: 65 },
  ];

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/complaints')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回
      </button>

      <PageHeader
        title="3D/图表可视化"
        subtitle="空间展示与数据分析，支持服务复核快速回退"
        action={
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === '3d' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-2" />
              3D 视图
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'chart' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PieChart className="w-4 h-4 inline mr-2" />
              图表视图
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {viewMode === '3d' ? (
            <div className="card overflow-hidden" style={{ height: '600px' }}>
              <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
                <p className="text-sm text-gray-600">
                  <Info className="w-4 h-4 inline mr-1" />
                  点击坡道查看详情，评分无变化的坡道会闪烁提示
                </p>
              </div>
              <Canvas camera={{ position: [12, 10, 12], fov: 50 }} shadows>
                <Suspense fallback={null}>
                  <Scene 
                    ramps={ramps} 
                    selectedRamp={selectedRamp}
                    onRampClick={setSelectedRamp}
                  />
                </Suspense>
              </Canvas>
            </div>
          ) : (
            <div className="card p-6" style={{ height: '600px' }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">各区域数据对比</h3>
              <div className="space-y-6">
                {chartData.map((item, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{item.area}</h4>
                      <span className={`font-bold ${
                        item.评分 >= 80 ? 'text-green-600' : item.评分 >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        评分: {item.评分}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>投诉数</span>
                          <span>{item.投诉数}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-600 rounded-full transition-all duration-500"
                            style={{ width: `${(item.投诉数 / 6) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>坡道问题</span>
                          <span>{item.坡道问题}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 rounded-full transition-all duration-500"
                            style={{ width: `${(item.坡道问题 / 3) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {selectedRampData ? (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">坡道详情</h3>
                <button onClick={() => setSelectedRamp(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">区域名称</p>
                  <p className="font-medium text-gray-900">{selectedRampData.areaName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">坡道数量</p>
                  <p className="font-medium text-gray-900">{selectedRampData.rampCount} 个</p>
                </div>
                {selectedRampData.score !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">当前评分</p>
                    <p className={`text-2xl font-bold ${
                      selectedRampData.score >= 80 ? 'text-green-600' : 
                      selectedRampData.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedRampData.score}
                    </p>
                  </div>
                )}

                {selectedRampData.scoreUnchanged && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-medium text-orange-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      评分无变化
                    </p>
                    <p className="text-xs text-orange-700 mt-1">坡道补录后评分未变化，请回到源数据复核</p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-sm font-medium text-gray-700">服务复核：快速回退</p>
                {selectedRedline && (
                  <button
                    onClick={() => navigate(`/redline/${selectedRedline.id}`)}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">查看红线图备注</p>
                      <p className="text-xs text-gray-500">{selectedRedline.code}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </button>
                )}
                {selectedComplaint?.inspectionId && (
                  <button
                    onClick={() => navigate(`/inspection/${selectedComplaint.inspectionId}`)}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">查看网格员巡查表</p>
                      <p className="text-xs text-gray-500">关联巡查记录</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </button>
                )}
                {selectedComplaint && (
                  <button
                    onClick={() => navigate(`/complaints/${selectedComplaint.id}`)}
                    className="w-full p-3 bg-primary-50 hover:bg-primary-100 rounded-lg text-left transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-medium text-primary-700">查看投诉详情</p>
                      <p className="text-xs text-primary-600">完整处理流程</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-primary-400 group-hover:text-primary-600 transition-colors" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center py-12">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">点击3D视图中的坡道</p>
              <p className="text-sm text-gray-400 mt-1">查看详细信息和复核入口</p>
            </div>
          )}

          <div className="card p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">图例说明</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-green-500" />
                <span className="text-sm text-gray-600">正常坡道</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span className="text-sm text-gray-600">有问题坡道</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-orange-500 animate-pulse" />
                <span className="text-sm text-gray-600">评分无变化，待复核</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
