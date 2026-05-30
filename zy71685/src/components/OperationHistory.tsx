import React, { useState } from 'react';
import { useAppStore } from '@/store';
import {
  OperationLog,
  OPERATION_TYPE_LABELS,
  formatTime,
  CONFIRMATION_STATUS_LABELS,
  PROBLEM_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
} from '@/types';
import {
  History,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Plus,
  FileDown,
  MessageSquare,
  Search,
  Filter,
} from 'lucide-react';

const OPERATION_ICONS: Record<string, React.ReactNode> = {
  detection_run: <Search className="w-4 h-4" />,
  rerun: <RefreshCw className="w-4 h-4" />,
  undo: <RotateCcw className="w-4 h-4" />,
  manual_add: <Plus className="w-4 h-4" />,
  confirm: <Check className="w-4 h-4" />,
  reject: <X className="w-4 h-4" />,
  comment_add: <MessageSquare className="w-4 h-4" />,
  export: <FileDown className="w-4 h-4" />,
};

const OPERATION_COLORS: Record<string, string> = {
  detection_run: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rerun: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  undo: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  manual_add: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  confirm: 'bg-green-500/20 text-green-400 border-green-500/30',
  reject: 'bg-red-500/20 text-red-400 border-red-500/30',
  comment_add: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  export: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

function canUndo(log: OperationLog): boolean {
  return ['confirm', 'reject', 'manual_add'].includes(log.operationType);
}

function canRerun(log: OperationLog): boolean {
  return ['detection_run', 'rerun'].includes(log.operationType);
}

function formatSnapshot(snapshot: string): string {
  if (!snapshot) return '无';
  try {
    const data = JSON.parse(snapshot);
    if (typeof data === 'object' && data !== null) {
      if ('count' in data) {
        return `错音数量: ${data.count}`;
      }
      const parts: string[] = [];
      if ('time' in data) parts.push(`时间: ${formatTime(data.time)}`);
      if ('confirmationStatus' in data) {
        parts.push(`状态: ${CONFIRMATION_STATUS_LABELS[data.confirmationStatus as keyof typeof CONFIRMATION_STATUS_LABELS] || data.confirmationStatus}`);
      }
      if ('problemType' in data) {
        parts.push(`问题: ${PROBLEM_TYPE_LABELS[data.problemType as keyof typeof PROBLEM_TYPE_LABELS] || data.problemType}`);
      }
      if ('sourceType' in data) {
        parts.push(`来源: ${SOURCE_TYPE_LABELS[data.sourceType as keyof typeof SOURCE_TYPE_LABELS] || data.sourceType}`);
      }
      if ('deviationCents' in data) {
        parts.push(`偏差: ${data.deviationCents}音分`);
      }
      if ('confidence' in data) {
        parts.push(`置信度: ${(data.confidence * 100).toFixed(0)}%`);
      }
      if (parts.length > 0) return parts.join(' | ');
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  } catch {
    return snapshot;
  }
}

export default function OperationHistory() {
  const { operationLogs, undoOperation, rerunDetection, detectionRuns } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);

  const operationTypes = [
    { value: 'all', label: '全部操作' },
    { value: 'detection_run', label: '运行检测' },
    { value: 'rerun', label: '重新计算' },
    { value: 'manual_add', label: '人工补录' },
    { value: 'confirm', label: '确认错音' },
    { value: 'reject', label: '驳回错音' },
    { value: 'undo', label: '撤回操作' },
    { value: 'comment_add', label: '添加备注' },
    { value: 'export', label: '导出报告' },
  ];

  const filteredLogs = operationLogs
    .filter((log) => filterType === 'all' || log.operationType === filterType)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleUndo = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await undoOperation(logId);
  };

  const handleRerun = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const log = operationLogs.find((l) => l.id === logId);
    if (log) {
      await rerunDetection(log.targetId);
    }
  };

  const getDetectionRunInfo = (targetId: string) => {
    const run = detectionRuns.find((r) => r.id === targetId);
    if (run?.timeRangeStart !== undefined && run?.timeRangeEnd !== undefined) {
      return `区域: ${formatTime(run.timeRangeStart)} - ${formatTime(run.timeRangeEnd)}`;
    }
    return '完整检测';
  };

  return (
    <div className="h-full flex flex-col bg-bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-text-primary">操作历史</h3>
          <span className="text-xs text-text-secondary bg-bg-subtle px-2 py-0.5 rounded-full">
            {filteredLogs.length}
          </span>
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`p-1.5 rounded transition-colors ${
            showFilter ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {showFilter && (
        <div className="p-3 border-b border-border bg-bg-subtle">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 bg-bg-card border border-border rounded-md text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {operationTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary p-8">
            <History className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无操作记录</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredLogs.map((log, index) => (
              <div key={log.id} className="group">
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="p-3 hover:bg-bg-subtle cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center ${
                        OPERATION_COLORS[log.operationType] || 'bg-bg-subtle text-text-secondary border-border'
                      }`}
                    >
                      {OPERATION_ICONS[log.operationType]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary text-sm">
                          {OPERATION_TYPE_LABELS[log.operationType] || log.operationType}
                        </span>
                        {log.operationType === 'detection_run' || log.operationType === 'rerun' ? (
                          <span className="text-xs text-text-secondary bg-bg-subtle px-1.5 py-0.5 rounded">
                            {getDetectionRunInfo(log.targetId)}
                          </span>
                        ) : null}
                      </div>

                      {log.note && (
                        <p className="text-sm text-text-secondary mb-1 line-clamp-1">{log.note}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-text-tertiary">
                        <span>{log.operator}</span>
                        <span>·</span>
                        <span>
                          {new Date(log.createdAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {(canUndo(log) || canRerun(log)) && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          {canRerun(log) && (
                            <button
                              onClick={(e) => handleRerun(log.id, e)}
                              className="p-1.5 rounded hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                              title="重新计算"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canUndo(log) && (
                            <button
                              onClick={(e) => handleUndo(log.id, e)}
                              className="p-1.5 rounded hover:bg-amber-500/20 text-amber-400 transition-colors"
                              title="撤回操作"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      <button className="p-1 text-text-tertiary hover:text-text-primary">
                        {expandedId === log.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {expandedId === log.id && (
                  <div className="px-3 pb-3 pl-14">
                    <div className="p-3 bg-bg-subtle rounded-lg border border-border">
                      <div className="grid grid-cols-1 gap-3">
                        {(log.snapshotBefore || log.snapshotAfter) && (
                          <>
                            {log.snapshotBefore && (
                              <div>
                                <div className="text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                  操作前
                                </div>
                                <pre className="text-xs text-text-primary bg-bg-card p-2 rounded border border-border overflow-x-auto whitespace-pre-wrap">
                                  {formatSnapshot(log.snapshotBefore)}
                                </pre>
                              </div>
                            )}

                            {log.snapshotAfter && (
                              <div>
                                <div className="text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                  操作后
                                </div>
                                <pre className="text-xs text-text-primary bg-bg-card p-2 rounded border border-border overflow-x-auto whitespace-pre-wrap">
                                  {formatSnapshot(log.snapshotAfter)}
                                </pre>
                              </div>
                            )}
                          </>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-text-secondary">操作类型: </span>
                            <span className="text-text-primary">
                              {OPERATION_TYPE_LABELS[log.operationType]}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-secondary">目标实体: </span>
                            <span className="text-text-primary">{log.targetEntity}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-text-secondary">目标ID: </span>
                            <span className="text-text-primary font-mono text-xs">
                              {log.targetId}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
