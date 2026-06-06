import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import {
  Box,
  BarChart3,
  Table,
  Thermometer,
  Eye,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRecordStore } from '@/store/useRecordStore';
import { useThresholdStore } from '@/store/useThresholdStore';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDateShort, getTemperatureColor, getResponsiblePerson } from '@/utils/helpers';
import type { TemperatureRecord, ViewMode } from '@/types';

function TemperatureBlock({
  position,
  temperature,
  threshold,
  onClick,
  isSelected,
}: {
  position: [number, number, number];
  temperature: number;
  threshold?: number;
  onClick: () => void;
  isSelected: boolean;
}) {
  const color = useMemo(() => {
    if (!threshold) return '#64748b';
    if (temperature > threshold) return '#ef4444';
    if (temperature > threshold - 5) return '#f59e0b';
    return '#10b981';
  }, [temperature, threshold]);

  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 0.5 : 0.2}
        transparent
        opacity={0.8}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(0.85, 0.85, 0.85)]} />
          <lineBasicMaterial color="#ffffff" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  );
}

function Scene3D({
  records,
  selectedId,
  onSelect,
  threshold,
}: {
  records: TemperatureRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  threshold?: number;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#60a5fa" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#fbbf24" />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <gridHelper args={[20, 20, '#374151', '#1f2937']} />

      {records.map((record) => (
        <TemperatureBlock
          key={record.id}
          position={[
            record.position?.x || 0,
            record.position?.y || 0,
            record.position?.z || 0,
          ]}
          temperature={record.temperature}
          threshold={threshold}
          onClick={() => onSelect(record.id)}
          isSelected={selectedId === record.id}
        />
      ))}
    </>
  );
}

export function Tracking() {
  const navigate = useNavigate();
  const records = useRecordStore(state => state.records);
  const selectRecord = useRecordStore(state => state.selectRecord);
  const selectedRecordId = useRecordStore(state => state.selectedRecordId);
  const getRecordById = useRecordStore(state => state.getRecordById);
  const getThresholdById = useThresholdStore(state => state.getThresholdById);
  const getEquipmentById = useEquipmentStore(state => state.getEquipmentById);

  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [showDetail, setShowDetail] = useState(false);

  const selectedRecord = selectedRecordId ? getRecordById(selectedRecordId) : null;
  const selectedThreshold = selectedRecord ? getThresholdById(selectedRecord.thresholdId) : null;
  const selectedEquipment = selectedRecord ? getEquipmentById(selectedRecord.equipmentId) : null;

  const chartData = useMemo(() => {
    return records.slice(0, 10).map((r) => {
      const threshold = getThresholdById(r.thresholdId);
      return {
        time: formatDateShort(r.createdAt),
        temperature: r.temperature,
        adjusted: r.manualCoefficient ? r.temperature * r.manualCoefficient : r.temperature,
        warning: threshold?.warningTemp || 30,
        max: threshold?.maxTemp || 35,
        status: r.status,
      };
    });
  }, [records, getThresholdById]);

  const handleSelectRecord = (id: string | null) => {
    selectRecord(id);
    if (id) setShowDetail(true);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">温度追踪看板</h1>
          <p className="text-gray-500 mt-1">3D可视化展示温度分布，支持数据钻取和溯源</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === '3d'
                ? 'bg-white shadow text-primary-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Box className="w-4 h-4" />
            3D 视图
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-white shadow text-primary-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            图表视图
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-white shadow text-primary-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Table className="w-4 h-4" />
            表格视图
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
          {viewMode === '3d' && (
            <div className="flex-1 relative bg-gray-900">
              <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
                <Scene3D
                  records={records}
                  selectedId={selectedRecordId}
                  onSelect={handleSelectRecord}
                  threshold={selectedThreshold?.warningTemp}
                />
              </Canvas>
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-xs">
                <p className="font-medium mb-2">温度图例</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-industry-success"></span>
                    <span>正常</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-industry-warning"></span>
                    <span>预警</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-industry-danger"></span>
                    <span>异常</span>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 text-white/60 text-xs">
                拖拽旋转 · 滚轮缩放 · 点击方块查看详情
              </div>
            </div>
          )}

          {viewMode === 'chart' && (
            <div className="flex-1 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">温度趋势图</h3>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" unit="°C" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend />
                  <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="3 3" label="预警线" />
                  <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" label="上限" />
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#tempGradient)"
                    name="实测温度"
                  />
                  <Line
                    type="monotone"
                    dataKey="adjusted"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="修正后温度"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {viewMode === 'table' && (
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      记录ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      温度
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      人工系数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      备注
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      时间
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedRecordId === record.id ? 'bg-primary-50' : ''
                      }`}
                      onClick={() => handleSelectRecord(record.id)}
                    >
                      <td className="px-6 py-3 text-sm font-mono text-gray-900">
                        {record.id.slice(-8)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className="text-sm font-mono font-medium"
                          style={{
                            color: getTemperatureColor(
                              record.temperature,
                              getThresholdById(record.thresholdId)
                            ),
                          }}
                        >
                          {record.temperature}°C
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {record.manualCoefficient ? (
                          <span className="font-mono text-amber-600">
                            ×{record.manualCoefficient}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {record.remark}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {formatDateShort(record.createdAt)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          className="text-primary-500 hover:text-primary-600 text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRecord(record.id);
                          }}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="w-80 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">快速统计</h3>
            <div className="space-y-3">
              <MiniStat
                icon={<Thermometer className="w-4 h-4 text-primary-500" />}
                label="当前记录"
                value={records.length}
              />
              <MiniStat
                icon={<CheckCircle className="w-4 h-4 text-industry-success" />}
                label="正常"
                value={records.filter(r => r.status === 'normal').length}
              />
              <MiniStat
                icon={<AlertTriangle className="w-4 h-4 text-industry-warning" />}
                label="预警/异常"
                value={records.filter(r => r.status === 'warning' || r.status === 'error').length}
              />
              <MiniStat
                icon={<RefreshCw className="w-4 h-4 text-amber-600" />}
                label="待复核"
                value={records.filter(r => r.status === 'pending_review').length}
              />
            </div>
          </div>

          {selectedRecord && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800">选中记录</h3>
                <StatusBadge status={selectedRecord.status} />
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">温度值</span>
                  <span className="font-mono font-medium">{selectedRecord.temperature}°C</span>
                </div>
                {selectedRecord.manualCoefficient && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">人工系数</span>
                    <span className="font-mono text-amber-600">×{selectedRecord.manualCoefficient}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">参数版本</span>
                  <span className="font-mono text-primary-600">{selectedRecord.parameterVersion || '-'}</span>
                </div>
                {selectedRecord.tradeOffReason && (
                  <div className="pt-2 border-t">
                    <span className="text-gray-500 text-xs">取舍理由</span>
                    <p className="text-xs text-gray-700 mt-1">{selectedRecord.tradeOffReason}</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowDetail(true)}
                className="w-full mt-4 py-2 bg-primary-50 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
              >
                查看完整详情
              </button>
            </div>
          )}
        </div>
      </div>

      {showDetail && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">温度记录详情</h2>
                <p className="text-sm text-gray-500 mt-1">
                  记录ID: {selectedRecord.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetail(false);
                  selectRecord(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">实测温度</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {selectedRecord.temperature}°C
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">当前状态</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedRecord.status} className="text-sm" />
                  </div>
                </div>
              </div>

              {selectedRecord.remark && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs text-blue-600 font-medium mb-1">备注信息</p>
                  <p className="text-sm text-blue-800">{selectedRecord.remark}</p>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">溯源信息</h3>

                <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-amber-600 font-medium mb-1">关联安全阈值表</p>
                      <p className="text-sm text-amber-800 font-mono">
                        {selectedThreshold?.thresholdCode || '未关联'}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        {selectedThreshold?.description}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowDetail(false);
                        navigate('/thresholds');
                      }}
                      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
                    >
                      跳转 <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-amber-200">
                    <div>
                      <p className="text-xs text-amber-500">最低</p>
                      <p className="text-sm font-mono text-amber-700">{selectedThreshold?.minTemp}°C</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-500">预警</p>
                      <p className="text-sm font-mono text-amber-700">{selectedThreshold?.warningTemp}°C</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-500">最高</p>
                      <p className="text-sm font-mono text-amber-700">{selectedThreshold?.maxTemp}°C</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-green-200 bg-green-50 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-green-600 font-medium mb-1">关联设备铭牌</p>
                      <p className="text-sm text-green-800">
                        {selectedEquipment?.equipmentName || '未关联'}
                      </p>
                      <p className="text-xs text-green-600 mt-1 font-mono">
                        {selectedEquipment?.equipmentCode}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowDetail(false);
                        navigate('/equipment');
                      }}
                      className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800"
                    >
                      跳转 <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-green-200">
                    <div>
                      <p className="text-xs text-green-500">型号</p>
                      <p className="text-sm font-mono text-green-700">{selectedEquipment?.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-500">精度</p>
                      <p className="text-sm font-mono text-green-700">±{selectedEquipment?.accuracy}°C</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRecord.status === 'pending_review' && !selectedRecord.reviewReason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">需要设备工程师复核</p>
                      <p className="text-xs text-red-600 mt-1">
                        该记录人工修改了系数但未填写原因，已标记为待复核，
                        请联系设备工程师进行审核。
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-red-700">负责人：</span>
                        <span className="text-xs font-medium text-red-800">
                          {getResponsiblePerson(selectedRecord.status, !!selectedRecord.reviewReason)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedRecord.parameterVersion && (
                <div className="p-4 border border-gray-200 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">专业参数说明</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">参数版本</p>
                      <p className="font-mono text-primary-600">{selectedRecord.parameterVersion}</p>
                    </div>
                    {selectedRecord.tradeOffReason && (
                      <div>
                        <p className="text-xs text-gray-500">取舍理由</p>
                        <p className="text-gray-700">{selectedRecord.tradeOffReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex items-center justify-between">
              <button
                onClick={() => {
                  setShowDetail(false);
                  navigate('/playback', { state: { recordId: selectedRecord.id } });
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                查看历史变更 →
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDetail(false);
                    selectRecord(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={() => {
                    setShowDetail(false);
                    navigate('/review');
                  }}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  前往复核
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}
