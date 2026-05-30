import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowLeft,
  User,
  Calendar,
  Target,
  AlertCircle,
  FileDown,
  CheckCircle,
  RotateCcw,
  MapPin,
  Navigation,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useRecordStore } from '../store/recordStore';
import { useWorkflowStore } from '../store/workflowStore';
import StatusBadge from '../components/common/StatusBadge';
import Timeline from '../components/Timeline/Timeline';
import {
  WorkflowStatus,
  BearingData,
  PositionMark,
  SelectedRoute,
  OperationLog,
  TrainingRecord
} from '../types';
import { getScenarioById } from '../data/scenarios';
import { getLighthousesByScenario } from '../data/lighthouses';
import {
  formatDateTime,
  formatDistance,
  formatBearing,
  getRiskLabel,
  getRiskColor,
  getDifficultyLabel,
  getDifficultyColor
} from '../utils/formatters';
import { exportHTMLReport } from '../utils/exportReport';
import { calculateLineIntersection, calculateFinalError } from '../utils/geoCalculations';
import { estimatePosition } from '../utils/triangulation';

const ReviewPage: React.FC = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { records, updateRecordWorkflow } = useRecordStore();
  const { currentUser } = useWorkflowStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'bearings' | 'timeline'>('overview');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnComment, setReturnComment] = useState('');

  const record = records.find(r => r.id === recordId);
  const scenario = record ? getScenarioById(record.scenarioId) : undefined;
  const lighthouses = scenario ? getLighthousesByScenario(scenario.lighthouseIds) : [];

  const isInstructor = currentUser?.role === 'instructor';
  const canReview = isInstructor && record?.workflow.status === WorkflowStatus.PENDING;

  if (!record || !scenario) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-xl font-bold mb-2">记录未找到</h2>
          <p className="text-slate-400 mb-4">该训练记录不存在或已被删除</p>
          <button
            onClick={() => navigate('/records')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            返回记录列表
          </button>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    await exportHTMLReport(record, scenario, lighthouses);
  };

  const handleApprove = () => {
    if (!canReview) return;
    updateRecordWorkflow(record.id, WorkflowStatus.APPROVED, currentUser.name, '训练完成，数据准确，已通过复核。');
  };

  const handleReturn = () => {
    if (!canReview || !returnComment.trim()) return;
    updateRecordWorkflow(record.id, WorkflowStatus.RETURNED, currentUser.name, returnComment);
    setShowReturnModal(false);
    setReturnComment('');
  };

  const duration = record.endTime
    ? Math.round((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 1000 / 60)
    : 0;

  const hasUnitErrors = Object.values(record.bearings).some(b => b.hasUnitError);
  const bearingsArray = Object.entries(record.bearings);

  const renderBearingCard = (lighthouseId: string, bearing: BearingData) => {
    const lighthouse = lighthouses.find(l => l.id === lighthouseId);
    if (!lighthouse) return null;

    return (
      <div key={lighthouseId} className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MapPin size={20} className="text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white">{lighthouse.name}</h4>
              <p className="text-xs text-slate-400">
                {lighthouse.position.lat.toFixed(4)}, {lighthouse.position.lng.toFixed(4)}
              </p>
            </div>
          </div>
          {bearing.hasUnitError && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle size={10} />
              单位错误
            </span>
          )}
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">输入值</span>
            <span className="text-white font-mono">
              {bearing.unit === 'dms'
                ? `${bearing.degrees}°${bearing.minutes}'${bearing.seconds.toFixed(1)}"`
                : `${bearing.decimalDegrees.toFixed(4)}°`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">十进制度</span>
            <span className="text-blue-400 font-mono">{bearing.decimalDegrees.toFixed(4)}°</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">数据来源</span>
            <span className="text-slate-300">{bearing.source}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">输入时间</span>
            <span className="text-slate-300 text-xs">{formatDateTime(new Date(bearing.inputTime))}</span>
          </div>
        </div>

        {bearing.modifyHistory.length > 0 && (
          <div className="pt-3 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-2">修改历史（{bearing.modifyHistory.length}次）</div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {bearing.modifyHistory.map((h, i) => (
                <div key={i} className="text-xs text-slate-500 flex justify-between">
                  <span>{formatDateTime(new Date(h.timestamp))}</span>
                  <span className="font-mono">
                    {h.oldValue.toFixed(2)} → {h.newValue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/records')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Compass size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">训练复盘</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{scenario.name}</span>
                  <span className="text-slate-600">|</span>
                  <span className={`text-xs font-semibold ${getDifficultyColor(scenario.difficulty)}`}>
                    {getDifficultyLabel(scenario.difficulty)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={record.workflow.status} size="lg" />
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 hover:text-white transition-colors"
              >
                <FileDown size={18} />
                导出报告
              </button>
              {canReview && (
                <>
                  <button
                    onClick={handleApprove}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
                  >
                    <CheckCircle size={18} />
                    通过
                  </button>
                  <button
                    onClick={() => setShowReturnModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
                  >
                    <RotateCcw size={18} />
                    退回
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-6">
            <div className="flex gap-2 border-b border-slate-700">
              {(['overview', 'bearings', 'timeline'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab
                      ? 'text-blue-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'overview' ? '总览' : tab === 'bearings' ? '方位角详情' : '操作时间线'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4 text-center">
                    <div className="text-3xl font-bold font-mono text-blue-400 mb-1">
                      {record.finalError !== undefined ? Math.round(record.finalError) : '-'}
                    </div>
                    <div className="text-sm text-slate-400">定位误差 (米)</div>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4 text-center">
                    <div className="text-3xl font-bold font-mono text-purple-400 mb-1">
                      {record.operations.length}
                    </div>
                    <div className="text-sm text-slate-400">操作步骤</div>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4 text-center">
                    <div className="text-3xl font-bold font-mono text-orange-400 mb-1">
                      {duration}
                    </div>
                    <div className="text-sm text-slate-400">用时 (分钟)</div>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4 text-center">
                    <div className="text-3xl font-bold font-mono text-green-400 mb-1">
                      {bearingsArray.length}
                    </div>
                    <div className="text-sm text-slate-400">灯塔数量</div>
                  </div>
                </div>

                {record.positionMark && scenario && (
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-6">
                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <Target size={18} className="text-blue-400" />
                      定位结果分析
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm text-slate-400 mb-2">学员标注位置</h4>
                        <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-white">
                          {record.positionMark.position.lat.toFixed(6)}°N<br />
                          {record.positionMark.position.lng.toFixed(6)}°E
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm text-slate-400 mb-2">实际遇险船位置</h4>
                        <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-white">
                          {scenario.trueShipPosition.lat.toFixed(6)}°N<br />
                          {scenario.trueShipPosition.lng.toFixed(6)}°E
                        </div>
                      </div>
                    </div>

                    {record.positionMark.snappedToEstimate && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <div className="text-sm text-yellow-400 flex items-center gap-2">
                          <AlertTriangle size={16} />
                          位置标注使用了磁力吸附功能（自动吸附到估算位置）
                        </div>
                      </div>
                    )}

                    {hasUnitErrors && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="text-sm text-red-400 flex items-center gap-2">
                          <AlertTriangle size={16} />
                          存在角度单位错误，已在历史记录中留痕
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {record.selectedRoute && (
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-6">
                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <Navigation size={18} className="text-blue-400" />
                      救援路线选择
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold font-mono text-blue-400">
                          {formatDistance(record.selectedRoute.distance)}
                        </div>
                        <div className="text-xs text-slate-400">航行距离</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold font-mono text-green-400">
                          {record.selectedRoute.estimatedTime}分钟
                        </div>
                        <div className="text-xs text-slate-400">预计时间</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                        <div className={`text-lg font-bold ${getRiskColor(record.selectedRoute.riskLevel)}`}>
                          {getRiskLabel(record.selectedRoute.riskLevel)}
                        </div>
                        <div className="text-xs text-slate-400">风险等级</div>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="text-xs text-slate-400 mb-1">选择理由</div>
                      <div className="text-sm text-slate-200">{record.selectedRoute?.decisionReason}</div>
                    </div>
                  </div>
                )}

                {record.triangleData && (
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-6">
                    <h3 className="font-semibold text-white mb-4">误差三角形分析</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">三角形面积</div>
                        <div className="text-lg font-mono text-white">
                          {(record.triangleData.area / 1000000).toFixed(2)} km²
                        </div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">重心位置</div>
                        <div className="text-sm font-mono text-white">
                          {record.triangleData.centroid.lat.toFixed(4)}°,
                          {record.triangleData.centroid.lng.toFixed(4)}°
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bearings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bearingsArray.map(([id, bearing]) => renderBearingCard(id, bearing))}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="font-semibold text-white">完整操作时间线</h3>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {record.operations.map((op, index) => {
                      const typeIcons: Record<string, string> = {
                        bearing_input: '📐',
                        unit_error: '⚠️',
                        bearing_modify: '✏️',
                        position_mark: '📍',
                        position_adjust: '🔄',
                        route_select: '🛤️',
                        record_submit: '📤'
                      };

                      const typeColors: Record<string, string> = {
                        bearing_input: 'border-blue-500',
                        unit_error: 'border-red-500',
                        bearing_modify: 'border-yellow-500',
                        position_mark: 'border-green-500',
                        position_adjust: 'border-purple-500',
                        route_select: 'border-indigo-500',
                        record_submit: 'border-slate-500'
                      };

                      return (
                        <div key={index} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full border-2 ${typeColors[op.actionType] || 'border-slate-600'} bg-slate-800 flex items-center justify-center text-sm flex-shrink-0`}>
                              {typeIcons[op.actionType] || '•'}
                            </div>
                            {index < record.operations.length - 1 && (
                              <div className="w-0.5 flex-1 bg-slate-700 my-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">{op.actionDetail}</span>
                              {(op as any).hasUnitError && (
                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                  单位错误
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mb-1">
                              {formatDateTime(new Date(op.timestamp))}
                            </div>
                            {(op as any).details && Object.keys((op as any).details).length > 0 && (
                              <div className="text-xs text-slate-400 bg-slate-900/50 rounded p-2 mt-1">
                                {Object.entries((op as any).details).map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <span className="text-slate-500">{k}:</span>
                                    <span className="text-slate-300">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="col-span-4 space-y-4">
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-4">基本信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <User size={14} />
                    学员姓名
                  </span>
                  <span className="text-white">{record.traineeName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Calendar size={14} />
                    开始时间
                  </span>
                  <span className="text-white">{formatDateTime(new Date(record.startTime))}</span>
                </div>
                {record.endTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Clock size={14} />
                      完成时间
                    </span>
                    <span className="text-white">{formatDateTime(new Date(record.endTime))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">记录编号</span>
                  <span className="text-white font-mono text-xs">{record.id}</span>
                </div>
              </div>
            </div>

            {record.workflow.reviewComment && (
              <div className={`p-4 rounded-xl border ${
                record.workflow.status === WorkflowStatus.APPROVED
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                  {record.workflow.status === WorkflowStatus.APPROVED ? (
                    <><CheckCircle size={16} className="text-green-400" /> 复核意见</>
                  ) : (
                    <><RotateCcw size={16} className="text-red-400" /> 退回原因</>
                  )}
                </div>
                <div className="text-sm text-slate-200 mb-2">
                  {record.workflow.reviewComment}
                </div>
                {record.workflow.reviewerId && (
                  <div className="text-xs text-slate-400">
                    — {record.workflow.reviewerId}
                    {record.workflow.reviewTime && ` · ${formatDateTime(new Date(record.workflow.reviewTime))}`}
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-3">场景描述</h3>
              <p className="text-sm text-slate-400">{scenario.description}</p>
            </div>

            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-3">参与灯塔</h3>
              <div className="space-y-2">
                {lighthouses.map(lh => (
                  <div key={lh.id} className="flex items-center gap-2 text-sm">
                    <MapPin size={14} className="text-blue-400" />
                    <span className="text-slate-300">{lh.name}</span>
                    <span className="text-xs text-slate-500 ml-auto">
                      射程 {lh.range}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {showReturnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <RotateCcw size={24} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">退回训练记录</h2>
                <p className="text-sm text-slate-400">请说明退回原因</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">
                退回原因（必填）
              </label>
              <textarea
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="例如：方位角数据不完整，请补充所有灯塔的测量值..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors resize-none h-28"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowReturnModal(false); setReturnComment(''); }}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleReturn}
                disabled={!returnComment.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认退回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPage;
