import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { DiffViewer } from '@/components/DiffViewer';
import { FileText, Upload, History, AlertTriangle, Check, X, Eye, Hash, FileCode } from 'lucide-react';

export function TrainingLogs() {
  const { trainingLogs, updateLogStatus, updateLogRemark, getHistoryByEntityId, rollbackChange, importTrainingLogs, lastImportReport } = useAppStore();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editingRemark, setEditingRemark] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [showImportDemo, setShowImportDemo] = useState(false);

  const selectedLog = trainingLogs.find((l) => l.id === selectedLogId);
  const logHistory = selectedLogId ? getHistoryByEntityId(selectedLogId) : [];

  const handleStatusUpdate = (logId: string, status: 'confirmed' | 'rejected') => {
    updateLogStatus(logId, status);
  };

  const startEditRemark = (log: any) => {
    setEditingRemark(log.id);
    setRemarkText(log.remark);
  };

  const saveRemark = (logId: string) => {
    updateLogRemark(logId, remarkText);
    setEditingRemark(null);
    setRemarkText('');
  };

  const handleDemoImport = async () => {
    const demoLogs = [
      { originalLineNumber: 200, epoch: 500, reward: 1720.5, loss: 0.0125, minorityMetric: 0.72, overallMetric: 0.91 },
      { originalLineNumber: 85, epoch: 200, reward: 1480.2, loss: 0.0189, minorityMetric: 0.78, overallMetric: 0.82 },
      { originalLineNumber: 210, epoch: 520, reward: 1750.3, loss: 0.0118, minorityMetric: 0.60, overallMetric: 0.87 },
    ];
    await importTrainingLogs(demoLogs, 'demo_rl_log_20260607.log');
    setShowImportDemo(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={24} className="text-blue-400" />
            训练日志管理
          </h1>
          <p className="text-slate-400 text-sm mt-1">管理强化学习仓储调度的训练日志曲线，保留原始行号和处理状态</p>
        </div>
        <button
          onClick={() => setShowImportDemo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          <Upload size={16} />
          模拟导入训练日志
        </button>
      </div>

      {lastImportReport && (
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-300 mb-2">上次导入报告</h3>
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-slate-400">总行数：</span>
              <span className="text-white font-mono">{lastImportReport.totalRows}</span>
            </div>
            <div>
              <span className="text-slate-400">新增：</span>
              <span className="text-emerald-400 font-mono">{lastImportReport.newRows}</span>
            </div>
            <div>
              <span className="text-slate-400">重复跳过：</span>
              <span className="text-amber-400 font-mono">{lastImportReport.duplicateRows}</span>
            </div>
            <div>
              <span className="text-slate-400">边界案例：</span>
              <span className="text-red-400 font-mono">{lastImportReport.boundaryCases}</span>
            </div>
          </div>
        </div>
      )}

      {showImportDemo && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">模拟导入训练日志</h3>
          <p className="text-slate-400 text-sm mb-4">
            将导入 3 条模拟日志，其中第 2 条（行号 85）已存在会被跳过，第 3 条会触发边界规则（少数类被总指标盖住）。
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDemoImport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              确认导入
            </button>
            <button
              onClick={() => setShowImportDemo(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/80">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-20">
                  <div className="flex items-center gap-1">
                    <Hash size={12} />
                    原始行号
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <FileCode size={12} />
                    源文件
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">轮次</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">奖励值</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">损失值</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">总指标</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">少数类指标</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">状态</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">备注</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {trainingLogs.map((log) => (
                <tr
                  key={log.id}
                  className={`hover:bg-slate-700/30 transition-colors ${
                    log.isBoundaryCase ? 'bg-amber-900/10' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <code className="text-sm font-mono text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
                      L{log.originalLineNumber}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-mono text-xs">
                    {log.fileName}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-mono">{log.epoch}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-mono">{log.reward.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-mono">{log.loss.toFixed(4)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-mono ${log.overallMetric >= 0.85 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {(log.overallMetric * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`font-mono ${
                        log.isBoundaryCase ? 'text-red-400 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      {(log.minorityMetric * 100).toFixed(1)}%
                    </span>
                    {log.isBoundaryCase && (
                      <AlertTriangle size={12} className="inline ml-1 text-amber-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} isBoundaryCase={log.isBoundaryCase} />
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {editingRemark === log.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={remarkText}
                          onChange={(e) => setRemarkText(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                          autoFocus
                        />
                        <button onClick={() => saveRemark(log.id)} className="text-emerald-400 hover:text-emerald-300">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingRemark(null)} className="text-red-400 hover:text-red-300">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <p
                        className="text-xs text-slate-400 truncate cursor-pointer hover:text-slate-300"
                        onClick={() => startEditRemark(log)}
                        title={log.remark || '点击添加备注'}
                      >
                        {log.remark || <span className="text-slate-600">点击添加备注</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedLogId(log.id);
                          setShowHistory(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title="查看变更历史"
                      >
                        <History size={16} />
                      </button>
                      {log.status === 'reviewing' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(log.id, 'confirmed')}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 rounded transition-colors"
                            title="确认通过"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(log.id, 'rejected')}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                            title="驳回"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedLogId(log.id === selectedLogId ? null : log.id)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title="查看详情"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && !showHistory && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Eye size={20} className="text-blue-400" />
            日志详情 - 原始行号 L{selectedLog.originalLineNumber}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 p-3 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">源文件</div>
              <div className="text-sm text-white font-mono">{selectedLog.fileName}</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">文件哈希</div>
              <div className="text-sm text-white font-mono truncate">{selectedLog.fileHash}</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">创建人</div>
              <div className="text-sm text-white">{selectedLog.createdBy}</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">创建时间</div>
              <div className="text-sm text-white">{new Date(selectedLog.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          </div>
          {selectedLog.boundaryReason && (
            <div className="mt-4 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-amber-300">边界案例触发</div>
                  <div className="text-xs text-amber-200/80 mt-1">{selectedLog.boundaryReason}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showHistory && selectedLogId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <History size={20} className="text-blue-400" />
              变更历史 - 日志 {selectedLogId}
            </h3>
            <button
              onClick={() => {
                setShowHistory(false);
                setSelectedLogId(null);
              }}
              className="text-sm text-slate-400 hover:text-white"
            >
              关闭
            </button>
          </div>
          {logHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">暂无变更记录</div>
          ) : (
            <div className="space-y-3">
              {logHistory.map((h) => (
                <DiffViewer key={h.id} history={h} onRollback={rollbackChange} showRollback />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
