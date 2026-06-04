import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Droplets,
  AlertTriangle,
  Clock,
  Eye,
  Edit3,
  FileText,
  TrendingUp,
  Box,
  BarChart3,
  List,
  User,
  ChevronRight,
  Info,
  Zap,
  Thermometer,
  Gauge,
  Activity,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { DataTracePanel } from '@/components/DataTracePanel';
import * as THREE from 'three';
import {
  Canvas,
  useFrame,
} from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Float,
  Text,
} from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from 'recharts';
import type { ViewMode, DataTraceInfo } from '../../shared/types';

function Pump3DModel({ riskLevel, onDataPointClick }: { riskLevel: string; onDataPointClick: (index: number) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const impellerRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (impellerRef.current) {
      impellerRef.current.rotation.z += delta * 2;
    }
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    }
  });

  const colors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  };

  const mainColor = colors[riskLevel as keyof typeof colors] || '#06b6d4';

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.5, 0.8, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.8, 1.2, 1.5, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>

      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.8, 0.6, 32]} />
        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
      </mesh>

      <mesh position={[0, 0.6, 0]} ref={impellerRef}>
        <torusGeometry args={[0.5, 0.1, 8, 16]} />
        <meshStandardMaterial color={mainColor} emissive={mainColor} emissiveIntensity={0.3} metalness={0.9} roughness={0.1} />
      </mesh>

      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 1.8;
        const z = Math.sin(angle) * 1.8;
        return (
          <mesh
            key={i}
            position={[x, 0.3, z]}
            onClick={(e) => {
              e.stopPropagation();
              onDataPointClick(i);
            }}
          >
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              color={mainColor}
              emissive={mainColor}
              emissiveIntensity={0.5}
            />
          </mesh>
        );
      })}

      <mesh position={[1.8, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 1.2, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[-1.8, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 1.2, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      <Text
        position={[0, 2.8, 0]}
        fontSize={0.25}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
      >
        泵站3D模型
      </Text>
    </group>
  );
}

export const CalculationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    calculations,
    screenshots,
    samplingIntervals,
    loadAllData,
    isLoading,
    viewMode,
    setViewMode,
    setDataTraceInfo,
    dataTraceInfo,
    updateCalculationRemark,
    loadChangeRecords,
    changeRecords,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | '3d'>('overview');
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [remarkText, setRemarkText] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const calc = calculations.find(c => c.id === id);

  useEffect(() => {
    loadAllData();
    if (id) {
      loadChangeRecords('calculation', id);
    }
  }, [id]);

  useEffect(() => {
    if (calc) {
      setRemarkText(calc.remark);
    }
  }, [calc]);

  const handleDataPointClick = (index: number) => {
    if (!calc) return;
    const screenshotId = calc.screenshotIds[0];
    const screenshot = screenshots.find(s => s.id === screenshotId);

    const traceInfo: DataTraceInfo = {
      calculationId: calc.id,
      dataPointIndex: index,
      sourceType: 'screenshot',
      sourceId: screenshotId || '',
      fieldName: 'pressure',
      value: calc.parameters.pressure?.[index] || 0,
      timestamp: calc.parameters.sampleTimes?.[index] || new Date().toISOString(),
    };
    setDataTraceInfo(traceInfo);
  };

  const handleChartDataPointClick = (data: any, fieldName: string) => {
    if (!calc || !data || !data.payload) return;
    const index = data.payload.index || 0;

    const traceInfo: DataTraceInfo = {
      calculationId: calc.id,
      dataPointIndex: index,
      sourceType: 'screenshot',
      sourceId: calc.screenshotIds[0] || '',
      fieldName,
      value: data.payload[fieldName] || 0,
      timestamp: data.payload.time || new Date().toISOString(),
    };
    setDataTraceInfo(traceInfo);
  };

  const handleSaveRemark = async () => {
    if (!calc) return;
    await updateCalculationRemark(calc.id, remarkText, changeReason || '修改备注');
    setIsEditingRemark(false);
    setChangeReason('');
  };

  if (isLoading || !calc) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载数据中...</p>
        </div>
      </div>
    );
  }

  const chartData = calc.parameters.sampleTimes?.map((time, idx) => ({
    index: idx,
    time: new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    pressure: calc.parameters.pressure?.[idx] || 0,
    flowRate: calc.parameters.flowRate?.[idx] || 0,
    temperature: calc.parameters.temperatures?.[idx] || 0,
    isMissing: calc.parameters.missingIntervals?.some(
      m => new Date(time) >= new Date(m.start) && new Date(time) <= new Date(m.end)
    ),
  })) || [];

  const riskColors: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };

  const riskBgColors: Record<string, string> = {
    low: 'from-emerald-500/20 to-emerald-600/10',
    medium: 'from-amber-500/20 to-amber-600/10',
    high: 'from-orange-500/20 to-orange-600/10',
    critical: 'from-red-500/20 to-red-600/10',
  };

  const viewTabs = [
    { id: 'overview', label: '总览', icon: Eye },
    { id: 'chart', label: '图表', icon: BarChart3 },
    { id: '3d', label: '3D 模型', icon: Box },
  ];

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/calculations')}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{calc.name}</h1>
            <StatusBadge status={calc.status} />
            <StatusBadge status={calc.riskLevel} />
          </div>
          <p className="text-sm text-slate-400">
            泵站编号: {calc.pumpId} · 创建于 {new Date(calc.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className={cn(
          'col-span-1 p-5 rounded-2xl border bg-gradient-to-br',
          riskBgColors[calc.riskLevel],
          'border-slate-800'
        )}>
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              calc.riskLevel === 'low' && 'bg-emerald-500/20',
              calc.riskLevel === 'medium' && 'bg-amber-500/20',
              calc.riskLevel === 'high' && 'bg-orange-500/20',
              calc.riskLevel === 'critical' && 'bg-red-500/20'
            )}>
              <Gauge className={cn('w-6 h-6', riskColors[calc.riskLevel])} />
            </div>
            <div>
              <p className="text-sm text-slate-400">风险评分</p>
              <p className={cn('text-3xl font-bold', riskColors[calc.riskLevel])}>
                {calc.riskScore}
                <span className="text-sm font-normal text-slate-500 ml-1">分</span>
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-1000',
                calc.riskLevel === 'low' && 'bg-emerald-500',
                calc.riskLevel === 'medium' && 'bg-amber-500',
                calc.riskLevel === 'high' && 'bg-orange-500',
                calc.riskLevel === 'critical' && 'bg-red-500'
              )}
              style={{ width: `${Math.min(calc.riskScore, 100)}%` }}
            />
          </div>
        </div>

        <div className="col-span-1 p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Droplets className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">NPSH 可用值</p>
              <p className="text-2xl font-bold text-cyan-400">{calc.result.npshAvailable.toFixed(2)}m</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">必需值: {calc.result.npshRequired.toFixed(2)}m</p>
        </div>

        <div className="col-span-1 p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">汽蚀概率</p>
              <p className="text-2xl font-bold text-amber-400">{(calc.result.cavitationProbability * 100).toFixed(1)}%</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">数据点数: {calc.parameters.sampleTimes?.length || 0}</p>
        </div>

        <div className="col-span-1 p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">影响区域</p>
              <p className="text-2xl font-bold text-purple-400">{calc.result.affectedAreas.length}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">{calc.result.affectedAreas.slice(0, 2).join('、')}{calc.result.affectedAreas.length > 2 ? '...' : ''}</p>
        </div>
      </div>

      {calc.parameters.missingIntervals.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300 mb-1">
              检测到 {calc.parameters.missingIntervals.length} 个缺失采样间隔
            </p>
            <p className="text-xs text-amber-200/80 mb-2">
              {calc.parameters.missingIntervals.map((m, i) => (
                <span key={i} className="mr-3">
                  {new Date(m.start).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})} - {new Date(m.end).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}
                  ({m.duration}分钟)
                </span>
              ))}
            </p>
            <p className="text-xs text-amber-300/60">
              点击数据点可追溯原始截图或采样间隔说明，问题已流转质检员复核，别急着归正常
            </p>
          </div>
          <button
            onClick={() => navigate('/review')}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-medium transition-colors"
          >
            前往复核
          </button>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center border-b border-slate-800 px-4">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-400" />
                    计算参数
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">泵站编号</span>
                      <span className="font-mono">{calc.pumpId}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">数据来源</span>
                      <span>{calc.screenshotIds.length} 张截图</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">采样间隔说明</span>
                      <span>{calc.samplingIntervalIds.length} 条</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">创建人</span>
                      <span>{calc.createdBy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">最后更新</span>
                      <span>{new Date(calc.updatedAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">更新人</span>
                      <span>{calc.updatedBy}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    风险建议
                  </h3>
                  <ul className="space-y-2">
                    {calc.result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    备注信息
                  </h3>
                  {!isEditingRemark && (
                    <button
                      onClick={() => setIsEditingRemark(true)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      修改
                    </button>
                  )}
                </div>
                {isEditingRemark ? (
                  <div className="space-y-3">
                    <textarea
                      value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
                      rows={3}
                      placeholder="输入备注信息..."
                    />
                    <input
                      type="text"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
                      placeholder="修改原因（将记录在变更历史中）"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveRemark}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-medium"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingRemark(false);
                          setRemarkText(calc.remark);
                          setChangeReason('');
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 bg-slate-900/30 rounded-lg p-4">
                    {calc.remark || '暂无备注'}
                  </p>
                )}
              </div>

              {changeRecords.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      最近变更记录
                    </h3>
                    <button
                      onClick={() => navigate(`/audit?entityType=calculation&entityId=${calc.id}`)}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      查看全部
                    </button>
                  </div>
                  <div className="space-y-3">
                    {changeRecords.slice(0, 3).map((record) => (
                      <div key={record.id} className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold shrink-0">
                          {record.changedBy.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{record.changedBy}</span>
                            <span className="text-xs text-slate-500">
                              {new Date(record.changedAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            修改了 <span className="text-cyan-300">{record.fieldName}</span>
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded">
                              {record.oldValue || '空'}
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-500" />
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                              {record.newValue || '空'}
                            </span>
                          </div>
                          {record.changeReason && (
                            <p className="text-xs text-slate-500 mt-1">
                              原因: {record.changeReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chart' && (
            <div className="space-y-6">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-start gap-2 mb-4">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-xs text-cyan-300">
                  点击图表上的数据点可追溯原始维修群截图或采样间隔说明，不要只剩漂亮画面
                </p>
              </div>

              <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  压力趋势 (MPa)
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        cursor={{ stroke: '#06b6d4', strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pressure"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#pressureGradient)"
                        name="压力"
                        dot={{ fill: '#06b6d4', r: 4, onClick: (e: any) => handleChartDataPointClick(e, 'pressure') }}
                        activeDot={{ r: 6, fill: '#22d3ee', onClick: (e: any) => handleChartDataPointClick(e, 'pressure') }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  流量趋势 (m³/h)
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        cursor={{ stroke: '#10b981', strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="flowRate"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#flowGradient)"
                        name="流量"
                        dot={{ fill: '#10b981', r: 4, onClick: (e: any) => handleChartDataPointClick(e, 'flowRate') }}
                        activeDot={{ r: 6, fill: '#34d399', onClick: (e: any) => handleChartDataPointClick(e, 'flowRate') }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-amber-400" />
                  温度趋势 (℃)
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        cursor={{ stroke: '#f59e0b', strokeWidth: 1 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="温度"
                        dot={{ fill: '#f59e0b', r: 4, onClick: (e: any) => handleChartDataPointClick(e, 'temperature') }}
                        activeDot={{ r: 6, fill: '#fbbf24', onClick: (e: any) => handleChartDataPointClick(e, 'temperature') }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  综合参数对比
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis yAxisId="left" stroke="#64748b" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="pressure"
                        fill="#06b6d4"
                        name="压力 (MPa)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="flowRate"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="流量 (m³/h)"
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="temperature"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="温度 (℃)"
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === '3d' && (
            <div className="space-y-4">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-start gap-2 mb-4">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-xs text-cyan-300">
                  点击3D模型周围的发光数据点可追溯原始维修群截图，支持旋转、缩放查看模型细节
                </p>
              </div>

              <div className="h-[600px] bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <Canvas shadows dpr={[1, 2]}>
                  <PerspectiveCamera makeDefault position={[5, 4, 5]} fov={50} />
                  <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={3}
                    maxDistance={15}
                  />

                  <ambientLight intensity={0.4} />
                  <directionalLight
                    position={[10, 10, 5]}
                    intensity={1}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                  />
                  <pointLight position={[-5, 5, -5]} intensity={0.5} color="#06b6d4" />
                  <pointLight position={[5, 3, 5]} intensity={0.3} color="#f59e0b" />

                  <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
                    <Pump3DModel
                      riskLevel={calc.riskLevel}
                      onDataPointClick={handleDataPointClick}
                    />
                  </Float>

                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
                    <planeGeometry args={[30, 30]} />
                    <meshStandardMaterial
                      color="#0f172a"
                      metalness={0.5}
                      roughness={0.8}
                    />
                  </mesh>

                  <gridHelper args={[30, 30, '#1e293b', '#1e293b']} position={[0, -1.49, 0]} />

                  <EffectComposer>
                    <Bloom
                      luminanceThreshold={0.2}
                      luminanceSmoothing={0.9}
                      intensity={0.5}
                      mipmapBlur
                    />
                    <ChromaticAberration 
                      offset={new THREE.Vector2(0.0005, 0.0005)} 
                      radialModulation={false}
                      modulationOffset={0}
                    />
                  </EffectComposer>
                </Canvas>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">NPSH 可用值</p>
                  <p className="text-xl font-bold text-cyan-400">{calc.result.npshAvailable.toFixed(2)}m</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">NPSH 必需值</p>
                  <p className="text-xl font-bold text-slate-300">{calc.result.npshRequired.toFixed(2)}m</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">安全余量</p>
                  <p className={cn(
                    'text-xl font-bold',
                    (calc.result.npshAvailable - calc.result.npshRequired) > 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  )}>
                    {(calc.result.npshAvailable - calc.result.npshRequired).toFixed(2)}m
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => navigate(`/audit?entityType=calculation&entityId=${calc.id}`)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
        >
          <Clock className="w-4 h-4" />
          查看完整变更历史
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/report/${calc.id}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-medium hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-emerald-500/20"
          >
            <FileText className="w-4 h-4" />
            生成复盘报告
          </button>
        </div>
      </div>

      {dataTraceInfo && <DataTracePanel />}
    </div>
  );
};
