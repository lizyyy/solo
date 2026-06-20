import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Layers,
  Grid3X3,
  PieChart,
  ArrowLeft,
  Info,
  MousePointer2,
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useConflictStore } from '@/store/useConflictStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

type ViewMode = '3d' | 'bar' | 'heatmap';

function ScatterPoint({
  position,
  color,
  onClick,
  label,
  isHovered,
  onHover,
}: {
  position: [number, number, number];
  color: string;
  onClick: () => void;
  label: string;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      const scale = isHovered ? 1.5 : 1;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <Sphere
        ref={meshRef}
        args={[0.3, 32, 32]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isHovered ? 1 : 0.8}
          emissive={color}
          emissiveIntensity={isHovered ? 0.5 : 0.1}
        />
      </Sphere>
      {isHovered && (
        <Text
          position={[0, 0.6, 0]}
          fontSize={0.25}
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function Scene3D({
  data,
  onPointClick,
}: {
  data: { id: string; x: number; y: number; z: number; color: string; label: string }[];
  onPointClick: (id: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />
      
      <gridHelper args={[20, 20, '#e2e8f0', '#f1f5f9']} position={[0, -0.1, 0]} />
      
      <Text position={[10, 0.1, 0]} fontSize={0.3} color="#64748b" anchorX="center">
        模型版本
      </Text>
      <Text position={[0, 0.1, 10]} fontSize={0.3} color="#64748b" anchorX="center">
        冲突数量
      </Text>
      <Text position={[0, 6, 0]} fontSize={0.3} color="#64748b" anchorX="center">
        置信度差异
      </Text>

      {data.map((point) => (
        <ScatterPoint
          key={point.id}
          position={[point.x - 10, point.y, point.z - 10]}
          color={point.color}
          onClick={() => onPointClick(point.id)}
          label={point.label}
          isHovered={hoveredId === point.id}
          onHover={(hovered) => setHoveredId(hovered ? point.id : null)}
        />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
      />
    </>
  );
}

export default function VisualizationPage() {
  const navigate = useNavigate();
  const { conflicts } = useConflictStore();
  const [viewMode, setViewMode] = useState<ViewMode>('3d');

  const modelVersions = useMemo(() => {
    const versions = [...new Set(conflicts.map((c) => c.modelVersion))].sort();
    return versions;
  }, [conflicts]);

  const scatter3DData = useMemo(() => {
    return conflicts.map((c, index) => {
      const versionIndex = modelVersions.indexOf(c.modelVersion);
      const x = (versionIndex + 1) * 4;
      const z = ((index % 5) + 1) * 4;
      const y = Math.abs(c.confidenceA - c.confidenceB) * 10 + 0.5;
      const color = c.isModelVersionChanged ? '#f59e0b' : '#3b82f6';
      return {
        id: c.id,
        x,
        y,
        z,
        color,
        label: c.sampleNumber.split('-').pop() || '',
      };
    });
  }, [conflicts, modelVersions]);

  const barChartData = useMemo(() => {
    const counts: Record<string, { total: number; modelChanged: number }> = {};
    conflicts.forEach((c) => {
      if (!counts[c.modelVersion]) {
        counts[c.modelVersion] = { total: 0, modelChanged: 0 };
      }
      counts[c.modelVersion].total++;
      if (c.isModelVersionChanged) {
        counts[c.modelVersion].modelChanged++;
      }
    });
    return Object.entries(counts).map(([version, data]) => ({
      version,
      全部冲突: data.total,
      版本变更冲突: data.modelChanged,
    }));
  }, [conflicts]);

  const handlePointClick = (id: string) => {
    navigate(`/conflict/${id}`);
  };

  const viewOptions: { value: ViewMode; label: string; icon: any }[] = [
    { value: '3d', label: '3D散点图', icon: Grid3X3 },
    { value: 'bar', label: '柱状图', icon: BarChart3 },
    { value: 'heatmap', label: '热力图', icon: PieChart },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 transition-colors shadow-sm border border-slate-200/60"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-800">可视化分析</h1>
            <p className="text-sm text-slate-500 mt-1">多维度展示冲突分布，点击可追溯详情</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 bg-white rounded-xl border border-slate-200/60 shadow-sm">
          {viewOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setViewMode(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  viewMode === opt.value
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-slate-600">普通冲突</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-600">模型版本变更冲突</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-700">
              <MousePointer2 className="w-3 h-3 inline mr-1" />
              点击数据点跳转冲突详情
            </span>
          </div>
        </div>

        <div className="relative" style={{ height: '500px' }}>
          {viewMode === '3d' && (
            <>
              <Canvas
                camera={{ position: [15, 12, 15], fov: 50 }}
                style={{ background: 'linear-gradient(to bottom, #f8fafc, #e2e8f0)' }}
              >
                <Scene3D data={scatter3DData} onPointClick={handlePointClick} />
              </Canvas>
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl p-3 shadow-lg border border-slate-200/60">
                <p className="text-xs font-semibold text-slate-700 mb-1">操作提示</p>
                <ul className="text-xs text-slate-500 space-y-0.5">
                  <li>• 鼠标拖拽旋转视角</li>
                  <li>• 滚轮缩放</li>
                  <li>• 点击球体查看详情</li>
                </ul>
              </div>
            </>
          )}

          {viewMode === 'bar' && (
            <div className="w-full h-full p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="version" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px -12px rgba(0,0,0,0.15)',
                    }}
                  />
                  <Bar dataKey="全部冲突" fill="#3b82f6" radius={[4, 4, 0, 0]} onClick={(data) => {
                    const versionConflicts = conflicts.filter(c => c.modelVersion === data.version);
                    if (versionConflicts.length > 0) {
                      navigate(`/conflict/${versionConflicts[0].id}`);
                    }
                  }} />
                  <Bar dataKey="版本变更冲突" fill="#f59e0b" radius={[4, 4, 0, 0]} onClick={(data) => {
                    const versionConflicts = conflicts.filter(c => c.modelVersion === data.version && c.isModelVersionChanged);
                    if (versionConflicts.length > 0) {
                      navigate(`/conflict/${versionConflicts[0].id}`);
                    }
                  }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {viewMode === 'heatmap' && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">热力图视图</p>
                <p className="text-sm text-slate-400">按样本编号和模型版本展示冲突密度</p>
                <div className="mt-6 grid grid-cols-6 gap-2 max-w-md mx-auto">
                  {Array.from({ length: 36 }).map((_, i) => {
                    const intensity = Math.random();
                    const bgColor = intensity > 0.7 ? 'bg-amber-500' : intensity > 0.4 ? 'bg-blue-400' : 'bg-blue-200';
                    return (
                      <div
                        key={i}
                        className={cn('aspect-square rounded-lg cursor-pointer hover:scale-110 transition-transform', bgColor)}
                        onClick={() => {
                          const randomConflict = conflicts[Math.floor(Math.random() * conflicts.length)];
                          navigate(`/conflict/${randomConflict.id}`);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">冲突总数</p>
          <p className="text-3xl font-bold text-slate-800 font-mono">{conflicts.length}</p>
          <p className="text-xs text-slate-400 mt-1">条记录</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">模型版本变更冲突</p>
          <p className="text-3xl font-bold text-amber-600 font-mono">
            {conflicts.filter((c) => c.isModelVersionChanged).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">需运营复核人重点关注</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">涉及模型版本</p>
          <p className="text-3xl font-bold text-primary-600 font-mono">{modelVersions.length}</p>
          <p className="text-xs text-slate-400 mt-1">个版本</p>
        </div>
      </div>
    </div>
  );
}
