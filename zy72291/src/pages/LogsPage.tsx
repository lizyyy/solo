import React, { useState } from 'react';
import { Upload, Eye, AlertTriangle, MapPin, Clock, CheckCircle, XCircle, Info, RefreshCw, Edit3 } from 'lucide-react';
import { useWindStore } from '../store/useWindStore';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateTime, formatNumber } from '../utils/windUtils';
import type { PointCloudLog, Alert } from '../../shared/types';
import { ALERT_TYPE_LABELS, ALERT_LEVEL_LABELS } from '../../shared/types';

export const LogsPage: React.FC = () => {
  const { logs, importLogFile, updateLogStatus, addManualCorrection, incrementRerun, currentRole, generateReport } = useWindStore();
  const [selectedLog, setSelectedLog] = useState<PointCloudLog | null>(null);
  const [showOcclusionModal, setShowOcclusionModal] = useState(false);
  const [occlusionNote, setOcclusionNote] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const handleImport = () => {
    importLogFile({});
  };

  const handleMarkOcclusion = (log: PointCloudLog) => {
    setSelectedLog(log);
    setOcclusionNote(log.screenshotNote || '');
    setShowOcclusionModal(true);
  };

  const confirmMarkOcclusion = () => {
    if (selectedLog) {
      updateLogStatus(selectedLog.id, 'pending_review', occlusionNote);
      setShowOcclusionModal(false);
      setSelectedLog(null);
      setOcclusionNote('');
    }
  };

  const handleManualCorrection = (log: PointCloudLog) => {
    setSelectedLog(log);
    const lastCorrection: string | undefined = log.manualCorrections?.[log.manualCorrections.length - 1]?.reason;
    setCorrectionNote(lastCorrection || '');
    setShowCorrectionModal(true);
  };

  const confirmCorrection = () => {
    if (selectedLog && correctionNote.trim()) {
      addManualCorrection({
        logId: selectedLog.id,
        field: 'notes',
        oldValue: selectedLog.notes ?? '',
        newValue: `${selectedLog.notes ?? ''}${selectedLog.notes ? ' | ' : ''}人工修正：${correctionNote}`,
        operator: currentRole === 'engineer' ? '许工' : '施工经理',
        reason: correctionNote,
      });
      setShowCorrectionModal(false);
      setSelectedLog(null);
      setCorrectionNote('');
    }
  };

  const handleRerun = (logId: string) => {
    incrementRerun(logId);
    generateReport();
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'danger': return <XCircle size={14} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
      default: return <Info size={14} className="text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-industrial-800 font-mono">点云抽稀日志</h2>
          <p className="text-sm text-industrial-500 mt-1">管理点云抽稀处理日志，标记告警遮挡，人工修正数据</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Upload size={16} />
            导入日志
          </button>
          <button
            onClick={generateReport}
            className="btn-industrial text-sm flex items-center gap-2"
          >
            <RefreshCw size={16} />
            更新报告
          </button>
        </div>
      </div>

      {/* 三步流程提示 */}
      <div className="bg-industrial-50 border border-industrial-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-industrial-800 mb-2 flex items-center gap-2">
          <Clock size={16} />
          三步处理流程
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-industrial-700 text-white rounded-full flex items-center justify-center text-xs font-mono">1</span>
            <span className="text-industrial-700">导入点云抽稀日志</span>
          </div>
          <div className="w-8 h-0.5 bg-industrial-300"></div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-industrial-700 text-white rounded-full flex items-center justify-center text-xs font-mono">2</span>
            <span className="text-industrial-700">检测截图遮挡，标记待复核</span>
          </div>
          <div className="w-8 h-0.5 bg-industrial-300"></div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-industrial-700 text-white rounded-full flex items-center justify-center text-xs font-mono">3</span>
            <span className="text-industrial-700">人工修正 + 重跑分析</span>
          </div>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="card-industrial rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">批次号</th>
                <th className="table-header">时间</th>
                <th className="table-header">点数量</th>
                <th className="table-header">抽稀率</th>
                <th className="table-header">来源</th>
                <th className="table-header">告警</th>
                <th className="table-header">重跑</th>
                <th className="table-header">状态</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-industrial-50 transition-colors">
                  <td className="table-cell font-mono text-sm font-medium text-industrial-800">{log.batchNo}</td>
                  <td className="table-cell text-sm text-industrial-600">{formatDateTime(log.timestamp)}</td>
                  <td className="table-cell font-mono text-sm">{formatNumber(log.pointCount)}</td>
                  <td className="table-cell font-mono text-sm">{(log.thinningRate * 100).toFixed(1)}%</td>
                  <td className="table-cell text-sm text-industrial-600">{log.source}</td>
                  <td className="table-cell">
                    <div className="flex flex-col gap-1">
                      {log.alerts.map((alert) => (
                        <div key={alert.id} className="flex items-center gap-1 text-xs">
                          {getAlertIcon(alert.level)}
                          <span className={alert.isOccluded ? 'text-amber-600 line-through' : 'text-industrial-600'}>
                            {ALERT_TYPE_LABELS[alert.type]}
                          </span>
                          {alert.isOccluded && (
                            <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">遮挡</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`text-sm font-mono ${log.rerunCount > 0 ? 'text-blue-600' : 'text-industrial-400'}`}>
                      {log.rerunCount > 0 ? `${log.rerunCount} 次` : '-'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={log.status} size="sm" />
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 hover:bg-industrial-100 rounded transition-colors text-industrial-600 hover:text-industrial-800"
                        title="查看详情"
                      >
                        <Eye size={16} />
                      </button>
                      {log.hasScreenshotOcclusion && log.status !== 'pending_review' && (
                        <button
                          onClick={() => handleMarkOcclusion(log)}
                          className="p-1.5 hover:bg-amber-50 rounded transition-colors text-amber-600 hover:text-amber-700"
                          title="标记截图遮挡"
                        >
                          <AlertTriangle size={16} />
                        </button>
                      )}
                      {currentRole === 'engineer' && (
                        <button
                          onClick={() => handleManualCorrection(log)}
                          className="p-1.5 hover:bg-blue-50 rounded transition-colors text-blue-600 hover:text-blue-700"
                          title="人工修正"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                      {currentRole === 'engineer' && (
                        <button
                          onClick={() => handleRerun(log.id)}
                          className="p-1.5 hover:bg-emerald-50 rounded transition-colors text-emerald-600 hover:text-emerald-700"
                          title="重跑分析"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 日志详情弹窗 */}
      {selectedLog && !showOcclusionModal && !showCorrectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <MapPin size={18} />
                日志详情 - {selectedLog.batchNo}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 hover:bg-industrial-100 rounded transition-colors"
              >
                <XCircle size={20} className="text-industrial-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-130px)]">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-industrial-500 mb-1">日志ID</p>
                  <p className="font-mono text-sm text-industrial-800">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-xs text-industrial-500 mb-1">处理时间</p>
                  <p className="text-sm text-industrial-800">{formatDateTime(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs text-industrial-500 mb-1">点数量</p>
                  <p className="font-mono text-sm text-industrial-800">{formatNumber(selectedLog.pointCount)}</p>
                </div>
                <div>
                  <p className="text-xs text-industrial-500 mb-1">抽稀率</p>
                  <p className="font-mono text-sm text-industrial-800">{(selectedLog.thinningRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-industrial-500 mb-1">数据来源</p>
                  <p className="text-sm text-industrial-800">{selectedLog.source}</p>
                </div>
                <div>
                  <p className="text-xs text-industrial-500 mb-1">当前状态</p>
                  <StatusBadge status={selectedLog.status} size="sm" />
                </div>
              </div>

              {/* 截图遮挡说明 */}
              {selectedLog.hasScreenshotOcclusion && selectedLog.screenshotNote && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    移动端截图遮挡说明
                  </h4>
                  <p className="text-sm text-amber-700">{selectedLog.screenshotNote}</p>
                </div>
              )}

              {/* 人工修正 */}
              {selectedLog.manualCorrections && selectedLog.manualCorrections.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Edit3 size={16} />
                    人工修正记录 ({selectedLog.manualCorrections.length} 条)
                  </h4>
                  <div className="space-y-2">
                    {selectedLog.manualCorrections.map((corr) => (
                      <div key={corr.id} className="text-sm">
                        <p className="text-blue-700">
                          <span className="font-medium">[{corr.field}]</span>{' '}
                          {String(corr.oldValue)} → {String(corr.newValue)}
                        </p>
                        <p className="text-xs text-blue-500 mt-0.5">
                          {corr.operator} · {new Date(corr.timestamp).toLocaleString('zh-CN')} · {corr.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 mt-2 pt-2 border-t border-blue-200">重跑次数：{selectedLog.rerunCount} 次</p>
                </div>
              )}

              {/* 告警列表 */}
              <div>
                <h4 className="text-sm font-semibold text-industrial-800 mb-3">告警详情 ({selectedLog.alerts.length} 条)</h4>
                <div className="space-y-3">
                  {selectedLog.alerts.map((alert: Alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border ${
                        alert.isOccluded
                          ? 'bg-amber-50 border-amber-200'
                          : alert.level === 'danger'
                            ? 'bg-red-50 border-red-200'
                            : alert.level === 'warning'
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          {getAlertIcon(alert.level)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${
                                alert.level === 'danger' ? 'text-red-800' :
                                alert.level === 'warning' ? 'text-amber-800' : 'text-emerald-800'
                              }`}>
                                {ALERT_LEVEL_LABELS[alert.level]} - {ALERT_TYPE_LABELS[alert.type]}
                              </span>
                              {alert.isOccluded && (
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-medium">
                                  标签被遮挡
                                </span>
                              )}
                            </div>
                            <p className={`text-sm mt-1 ${
                              alert.isOccluded ? 'text-amber-700 line-through' :
                              alert.level === 'danger' ? 'text-red-700' :
                              alert.level === 'warning' ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              {alert.message}
                            </p>
                            <p className="text-xs text-industrial-500 mt-1 font-mono">
                              坐标: ({alert.position.x}, {alert.position.y}, {alert.position.z})
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-industrial-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn-industrial text-sm"
              >
                关闭
              </button>
              {selectedLog.hasScreenshotOcclusion && selectedLog.status !== 'pending_review' && (
                <button
                  onClick={() => {
                    setSelectedLog(null);
                    handleMarkOcclusion(selectedLog);
                  }}
                  className="btn-warning text-sm flex items-center gap-2"
                >
                  <AlertTriangle size={14} />
                  标记待复核
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 标记截图遮挡弹窗 */}
      {showOcclusionModal && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                标记移动端截图遮挡
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-industrial-600 mb-4">
                批次 <span className="font-mono font-medium">{selectedLog.batchNo}</span> 的告警标签被移动端截图遮挡，
                请填写说明后标记为"待施工经理复核"状态。
                <strong className="block mt-2 text-amber-700">
                  注意：标记后将不归为正常，需施工经理复核后才能确认结论。
                </strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-industrial-700 mb-2">
                  遮挡说明
                </label>
                <textarea
                  value={occlusionNote}
                  onChange={(e) => setOcclusionNote(e.target.value)}
                  placeholder="请描述截图遮挡的具体情况..."
                  className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange"
                  rows={4}
                />
              </div>
            </div>
            <div className="p-4 border-t border-industrial-200 flex justify-end gap-2">
              <button
                onClick={() => { setShowOcclusionModal(false); setSelectedLog(null); }}
                className="btn-industrial text-sm"
              >
                取消
              </button>
              <button
                onClick={confirmMarkOcclusion}
                disabled={!occlusionNote.trim()}
                className="btn-warning text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={14} />
                确认标记待复核
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 人工修正弹窗 */}
      {showCorrectionModal && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <Edit3 size={18} className="text-blue-500" />
                人工修正 - {selectedLog.batchNo}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-industrial-600 mb-4">
                设备工程师许工可以对数据进行人工修正。修正后请点击"重跑分析"更新安全距离报告。
              </p>
              <div>
                <label className="block text-sm font-medium text-industrial-700 mb-2">
                  修正说明
                </label>
                <textarea
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="请填写人工修正的内容和依据..."
                  className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange"
                  rows={4}
                />
              </div>
            </div>
            <div className="p-4 border-t border-industrial-200 flex justify-end gap-2">
              <button
                onClick={() => { setShowCorrectionModal(false); setSelectedLog(null); }}
                className="btn-industrial text-sm"
              >
                取消
              </button>
              <button
                onClick={confirmCorrection}
                disabled={!correctionNote.trim()}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={14} />
                保存修正
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
