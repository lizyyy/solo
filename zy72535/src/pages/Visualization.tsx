import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Float } from '@react-three/drei';
import * as THREE from 'three';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { Layers, Box, Table, Eye } from 'lucide-react';
import { useReviewStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';

type ViewMode = '3d' | 'chart' | 'list';

function DataNode({
  position,
  color,
  label,
  recordId,
  onSelect,
  isSelected,
}: {
  position: [number, number, number];
  color: string;
  label: string;
  recordId?: string;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}) {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <group position={position}>
        <Sphere args={[isSelected ? 0.4 : 0.25, 16, 16]}
          onClick={(e) => {
            e.stopPropagation();
            if (recordId && onSelect) {
              onSelect(recordId);
            }
          }}
        >
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isSelected ? 0.5 : 0.2}
            transparent
            opacity={0.9}
          />
        </Sphere>
        {isSelected && (
          <Sphere args={[0.5, 16, 16]}>
            <meshBasicMaterial color={color} transparent opacity={0.2} />
          </Sphere>
        )}
      </group>
    </Float>
  );
}

function Scene3D({
  records,
  selectedId,
  onSelect,
}: {
  records: ReturnType<typeof useReviewStore.getState>['records'];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const nodes = useMemo(() => {
    return records.map((record, i) => {
      const angle = (i / records.length) * Math.PI * 2;
      const radius = 3;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (i % 3 - 1) * 1.5;

      let color = '#94a3b8';
      if (record.status === 'CONFIRMED') color = '#2EC4B6';
      else if (record.status === 'PENDING_REVIEW') color = '#FF9F1C';
      else if (record.hasManualJudgment) color = '#f43f5e';
      else if (record.autoResult === 'PASS') color = '#10b981';
      else if (record.autoResult === 'FAIL') color = '#ef4444';

      return {
        id: record.id,
        position: [x, y, z] as [number, number, number],
        color,
        label: record.id,
      };
    });
  }, [records]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#7badff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#FF9F1C" />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <gridHelper args={[15, 15, '#1e293b', '#1e293b']} position={[0, -2, 0]} />

      {nodes.map((node) => (
        <DataNode
          key={node.id}
          position={node.position}
          color={node.color}
          label={node.label}
          recordId={node.id}
          onSelect={onSelect}
          isSelected={selectedId === node.id}
        />
      ))}
    </>
  );
}

export default function Visualization() {
  const navigate = useNavigate();
  const { records, rules, batches, getRuleById, getBatchById } = useReviewStore();
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRecord = selectedId ? records.find(r => r.id === selectedId) : null;
  const selectedRule = selectedRecord ? getRuleById(selectedRecord.ruleId) : null;
  const selectedBatch = selectedRecord?.batchId ? getBatchById(selectedRecord.batchId) : null;

  const chartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    records.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    return [
      { name: '草稿', value: statusCounts['DRAFT'] || 0, color: '#64748b' },
      { name: '审查中', value: statusCounts['REVIEWING'] || 0, color: '#3b82f6' },
      { name: '待复核', value: statusCounts['PENDING_REVIEW'] || 0, color: '#FF9F1C' },
      { name: '已确认', value: statusCounts['CONFIRMED'] || 0, color: '#2EC4B6' },
    ];
  }, [records]);

  const barData = useMemo(() => {
    return batches.map(batch => {
      const batchRecords = records.filter(r => r.batchId === batch.id);
      return {
        name: batch.batchName.substring(0, 8),
        通过: batchRecords.filter(r => r.autoResult === 'PASS').length,
        未通过: batchRecords.filter(r => r.autoResult === 'FAIL').length,
        待处理: batchRecords.filter(r => r.autoResult === 'PENDING').length,
      };
    });
  }, [records, batches]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary-500">
            可视化展示
          </h1>
          <p className="mt-2 text-slate-600">
            点击节点或图表数据可溯源至原始审查记录、脱敏规则备注或灰度批次
          </p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-lg shadow-sm">
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              viewMode === '3d'
                ? 'bg-primary-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Box className="w-4 h-4" />
            3D 视图
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              viewMode === 'chart'
                ? 'bg-primary-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            图表视图
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Table className="w-4 h-4" />
            列表视图
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3">
          {viewMode === '3d' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden" style={{ height: '600px' }}>
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-medium text-primary-500">3D 节点视图</h3>
                <p className="text-xs text-slate-500 mt-1">
                  拖拽旋转视角，点击节点查看详情
                </p>
              </div>
              <div style={{ height: 'calc(100% - 60px)' }}>
                <Canvas
                  camera={{ position: [0, 5, 8], fov: 50 }}
                  style={{ background: 'linear-gradient(180deg, #0F2B5B 0%, #071833 100%)' }}
                >
                  <Scene3D
                    records={records}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </Canvas>
              </div>
            </div>
          )}

          {viewMode === 'chart' && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="font-medium text-primary-500 mb-4">审查状态分布</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        onClick={(data) => {
                          const statusRecords = records.filter(
                            r => r.status === Object.keys({ DRAFT: 'DRAFT', REVIEWING: 'REVIEWING', PENDING_REVIEW: 'PENDING_REVIEW', CONFIRMED: 'CONFIRMED' })[chartData.findIndex(d => d.name === data.name)]
                          );
                          if (statusRecords.length > 0) {
                            setSelectedId(statusRecords[0].id);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="font-medium text-primary-500 mb-4">各批次审查结果</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="通过" fill="#2EC4B6" />
                      <Bar dataKey="未通过" fill="#ef4444" />
                      <Bar dataKey="待处理" fill="#94a3b8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-primary-50">
                  <tr>
                    <th className="text-left py-4 px-6 font-medium text-primary-500">脚本内容</th>
                    <th className="text-left py-4 px-6 font-medium text-primary-500">状态</th>
                    <th className="text-left py-4 px-6 font-medium text-primary-500">关联规则</th>
                    <th className="text-left py-4 px-6 font-medium text-primary-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const rule = getRuleById(record.ruleId);
                    return (
                      <tr
                        key={record.id}
                        className={`border-t border-slate-100 cursor-pointer transition-colors ${
                          selectedId === record.id ? 'bg-primary-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedId(record.id)}
                      >
                        <td className="py-3 px-6">
                          <p className="text-sm text-slate-800 max-w-xs truncate">
                            {record.scriptContent}
                          </p>
                        </td>
                        <td className="py-3 px-6">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="py-3 px-6">
                          <p className="text-sm text-slate-600 max-w-[200px] truncate">
                            {rule?.content || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-6">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/review/${record.id}`);
                            }}
                            className="text-primary-500 hover:text-primary-600 text-sm flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            查看详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-md p-4">
            <h3 className="font-medium text-primary-500 mb-3">节点图例</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">通过 / 已确认</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-slate-600">未通过</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-slate-600">待复核</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span className="text-slate-600">有人工改判</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                <span className="text-slate-600">待处理</span>
              </div>
            </div>
          </div>

          {selectedRecord && (
            <div className="bg-white rounded-xl shadow-md p-4 border-2 border-primary-300">
              <h3 className="font-medium text-primary-500 mb-3">已选中节点</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">脚本内容</p>
                  <p className="text-sm text-slate-800 mt-1">
                    {selectedRecord.scriptContent}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">状态</span>
                  <StatusBadge status={selectedRecord.status} />
                </div>
                {selectedRule && (
                  <div>
                    <p className="text-xs text-slate-500">关联脱敏规则</p>
                    <p className="text-xs text-primary-600 mt-1 bg-primary-50 p-2 rounded">
                      {selectedRule.content}
                    </p>
                  </div>
                )}
                {selectedBatch && (
                  <div>
                    <p className="text-xs text-slate-500">关联灰度批次</p>
                    <p className="text-xs text-accent-teal mt-1 bg-teal-50 p-2 rounded">
                      {selectedBatch.batchName} ({selectedBatch.batchNo})
                    </p>
                  </div>
                )}
                <button
                  onClick={() => navigate(`/review/${selectedRecord.id}`)}
                  className="w-full py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition-colors flex items-center justify-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  跳转至详情页
                </button>
              </div>
            </div>
          )}

          {!selectedRecord && (
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-500">
                点击左侧视图中的节点或数据<br />查看详细信息并溯源
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
