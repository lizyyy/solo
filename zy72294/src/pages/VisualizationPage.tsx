import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Box, BarChart3, RotateCcw, Ruler, FileText, X, MapPin, AlertTriangle, ClipboardCheck, Shield } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
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
        const isOccluded = record.alarmOccluded;
        const color = isSelected
          ? '#ff6b35'
          : isOccluded
            ? '#f4a261'
            : '#446b9e';
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
            {isOccluded && !isSelected && (
              <mesh position={[x, height + 0.2, z]}>
                <coneGeometry args={[0.15, 0.5, 32]} />
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

  const {
    getUniqueRecords,
    getEstimationForRecord,
    setSelectedRecordId,
    getReviewForRecord,
    getNoteForRecord,
    getHistoryForEntity,
  } = useAppStore();

  const uniqueRecords = getUniqueRecords();

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
    alarmOccluded: s.record.alarmOccluded,
  }));

  const selectedStack = stacks.find((s) => s.record.id === selectedId);

  const handleViewRecord = (path: string) => {
    if (selectedId) {
      setSelectedRecordId(selectedId);
      navigate(path);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900 mb-2">3D/图表展示</h1>
          <p className="text-gray-500">可视化展示堆垛位置与体积数据。橙色标记为存在遮挡告警的记录。</p>
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
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button
                className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
                title="重置视角"
              >
                <RotateCcw className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="absolute bottom-4 left-4 flex flex-col gap-2 text-xs bg-white/90 px-3 py-2 rounded shadow">
              <span className="text-gray-600">拖动旋转 · 滚轮缩放 · 点击堆垛查看详情</span>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-industrial-500 rounded-sm"></span>
                <span className="text-gray-600">正常记录</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-caution-500 rounded-sm"></span>
                <span className="text-gray-600">遮挡告警</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-warning-500 rounded-sm"></span>
                <span className="text-gray-600">当前选中</span>
              </div>
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
                  formatter={(value: number, _name: string, props: any) => {
                    const payload = props.payload;
                    return [
                      `${value.toFixed(2)} m³${payload?.alarmOccluded ? ' (有遮挡告警)' : ''}`,
                      '体积',
                    ];
                  }}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="volume" onClick={(data) => setSelectedId(data.id)} cursor="pointer">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        selectedId === entry.id
                          ? '#ff6b35'
                          : entry.alarmOccluded
                            ? '#f4a261'
                            : '#446b9e'
                      }
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
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-industrial-900">堆垛信息</h3>
                {selectedStack.record.alarmOccluded && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-700">
                    遮挡告警
                  </span>
                )}
              </div>
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
                    测距距离 / 估算体积
                  </p>
                  <p className="font-medium font-mono">
                    {selectedStack.record.distance} m / {selectedStack.estimation?.volume.toFixed(2)} m³
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500 mb-1">计算模型 / 参数版本</p>
                  <p className="font-medium">
                    {selectedStack.estimation?.calculationModel === 'cone' && '锥体模型'}
                    {selectedStack.estimation?.calculationModel === 'cuboid' && '长方体模型'}
                    {selectedStack.estimation?.calculationModel === 'irregular' && '不规则体模型'}
                    {' / '}{selectedStack.estimation?.paramVersion}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500 mb-1">取舍理由</p>
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {selectedStack.estimation?.tradeoffReason || '无'}
                  </p>
                </div>
              </div>

              {selectedStack.record.alarmOccluded && (
                <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg mb-6">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-warning-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-warning-800">移动端截图遮挡告警标签</p>
                  </div>
                  {(() => {
                    const review = getReviewForRecord(selectedStack.record.id);
                    const note = getNoteForRecord(selectedStack.record.id);
                    return (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-warning-700">复核状态：</span>
                          {review ? (
                            <StatusBadge status={review.reviewStatus} />
                          ) : (
                            <span className="text-gray-400">无</span>
                          )}
                        </div>
                        {review?.reviewedBy && (
                          <p className="text-warning-700">
                            复核人：{review.reviewedBy} · {formatTime(review.reviewedAt)}
                          </p>
                        )}
                        {review?.reviewComment && (
                          <p className="text-warning-700">处理意见：{review.reviewComment}</p>
                        )}
                        {note && (
                          <div className="pt-2 border-t border-warning-200 mt-2">
                            <p className="text-warning-700 mb-1">障碍物备注：</p>
                            <p className="text-gray-700 text-sm bg-white p-2 rounded">
                              {note.content || '(未填写)'}
                            </p>
                            {(() => {
                              const histories = getHistoryForEntity('obstacle_note', note.id);
                              if (histories.length === 0) return null;
                              return (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-500 mb-1">备注修改历史：</p>
                                  {histories.map((h) => (
                                    <div key={h.id} className="text-xs text-gray-500 mb-1">
                                      <span className="text-red-500 line-through">{h.oldValue || '(空)'}</span>
                                      <span className="mx-1">→</span>
                                      <span className="text-green-600">{h.newValue || '(空)'}</span>
                                      <span className="ml-1">{h.operator}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-3">
                {(() => {
                  const review = getReviewForRecord(selectedStack.record.id);
                  const needReviewFirst = selectedStack.record.alarmOccluded && review?.reviewStatus === 'pending';
                  return needReviewFirst ? (
                    <button
                      onClick={() => handleViewRecord('/review')}
                      className="flex-1 py-2.5 bg-warning-500 text-white font-medium rounded hover:bg-warning-600 transition-colors text-sm flex items-center justify-center gap-1"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      先去复核（遮挡告警）
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleViewRecord('/estimation')}
                        className="flex-1 py-2.5 bg-industrial-500 text-white font-medium rounded hover:bg-industrial-600 transition-colors text-sm flex items-center justify-center gap-1"
                      >
                        <Ruler className="w-4 h-4" />
                        查看测距记录
                      </button>
                      <button
                        onClick={() => handleViewRecord('/obstacles')}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-1"
                      >
                        <FileText className="w-4 h-4" />
                        查看障碍物备注
                      </button>
                    </>
                  );
                })()}
                <button
                  onClick={() => handleViewRecord('/report')}
                  className="flex-1 py-2.5 bg-success-600 text-white font-medium rounded hover:bg-success-700 transition-colors text-sm flex items-center justify-center gap-1"
                >
                  <Shield className="w-4 h-4" />
                  查看安全报告
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
