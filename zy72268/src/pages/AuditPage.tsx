import React, { useState, useEffect } from 'react';
import {
  History,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Tag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileJson,
} from 'lucide-react';
import { useAppStore } from '../store';
import { getAllHistory, getActionDescription } from '../services/auditService';
import type { AuditLog } from '../types';
import { cn } from '../lib/utils';

export const AuditPage: React.FC = () => {
  const { auditLogs, exportData, setAuditLogs } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    getAllHistory().then(setAuditLogs);
  }, [setAuditLogs]);

  const filteredLogs = auditLogs.filter((log) => {
    if (filterAction === 'all') return true;
    return log.action === filterAction;
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'import':
        return <Download size={16} />;
      case 'export':
        return <FileJson size={16} />;
      case 'confirm':
        return <CheckCircle size={16} />;
      case 'reject':
        return <XCircle size={16} />;
      case 'merge':
        return <Tag size={16} />;
      case 'review':
        return <Eye size={16} />;
      case 'update':
        return <History size={16} />;
      default:
        return <AlertTriangle size={16} />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'import':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400' };
      case 'export':
        return { bg: 'bg-green-500/20', text: 'text-green-400' };
      case 'confirm':
        return { bg: 'bg-green-500/20', text: 'text-green-400' };
      case 'reject':
        return { bg: 'bg-red-500/20', text: 'text-red-400' };
      case 'merge':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400' };
      case 'review':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400' };
      default:
        return { bg: 'bg-zinc-500/20', text: 'text-zinc-400' };
    }
  };

  const actionTypes = [
    { value: 'all', label: '全部操作' },
    { value: 'import', label: '导入' },
    { value: 'export', label: '导出' },
    { value: 'confirm', label: '确认' },
    { value: 'reject', label: '驳回' },
    { value: 'merge', label: '合并' },
    { value: 'review', label: '复核' },
    { value: 'update', label: '更新' },
  ];

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">审计追踪</h1>
            <p className="text-zinc-500">
              查看所有操作记录，追踪谁改了什么、为什么改、影响哪些结果
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <Download size={18} />
            {isExporting ? '导出中...' : '导出明细'}
          </button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <History size={16} className="text-zinc-500" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
            >
              {actionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-zinc-500">共 {filteredLogs.length} 条记录</div>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-zinc-800" />

          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <History size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg">暂无操作记录</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;
                const colors = getActionColor(log.action);

                return (
                  <div key={log.id} className="relative pl-14">
                    <div
                      className={cn(
                        'absolute left-4 w-5 h-5 rounded-full flex items-center justify-center border-2 border-zinc-950',
                        colors.bg
                      )}
                    >
                      <span className={cn('scale-75', colors.text)}>
                        {getActionIcon(log.action)}
                      </span>
                    </div>

                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="w-full p-4 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-medium text-zinc-200">
                              {getActionDescription(log.action, log.targetType)}
                            </div>
                            <div className="text-sm text-zinc-500 flex items-center gap-4 mt-1">
                              <span className="flex items-center gap-1">
                                <User size={12} />
                                {log.userName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(log.createdAt).toLocaleString('zh-CN')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {log.reason && (
                            <span className="text-sm text-zinc-400 bg-zinc-800 px-3 py-1 rounded">
                              {log.reason}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp size={20} className="text-zinc-500" />
                          ) : (
                            <ChevronDown size={20} className="text-zinc-500" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-zinc-800 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            {log.oldValue && Object.keys(log.oldValue).length > 0 && (
                              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                                <div className="text-xs text-red-400 mb-2 font-medium">
                                  修改前
                                </div>
                                <pre className="text-xs text-zinc-400 overflow-x-auto font-mono whitespace-pre-wrap">
                                  {JSON.stringify(log.oldValue, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.newValue && Object.keys(log.newValue).length > 0 && (
                              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                                <div className="text-xs text-green-400 mb-2 font-medium">
                                  修改后
                                </div>
                                <pre className="text-xs text-zinc-400 overflow-x-auto font-mono whitespace-pre-wrap">
                                  {JSON.stringify(log.newValue, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {log.affectedItems.length > 0 && (
                            <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg">
                              <div className="text-xs text-zinc-500 mb-2 font-medium">
                                影响范围 ({log.affectedItems.length} 项)
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {log.affectedItems.map((itemId, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded font-mono"
                                  >
                                    {itemId.slice(0, 16)}...
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
                            <span>目标类型: {log.targetType}</span>
                            <span>目标ID: {log.targetId}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-8 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <h3 className="font-semibold text-zinc-200 mb-4">真实复核说明</h3>
          <div className="space-y-3 text-sm text-zinc-500">
            <p>
              <span className="text-blue-400 font-medium">谁改了什么：</span>
              每条记录清晰显示操作人、操作类型和时间戳，支持按操作类型筛选。
            </p>
            <p>
              <span className="text-orange-400 font-medium">为什么改：</span>
              所有操作都需要填写原因，在列表中直接显示，展开可查看详细变更内容。
            </p>
            <p>
              <span className="text-green-400 font-medium">改完影响哪些结果：</span>
              每次操作自动记录受影响的障碍物ID，展开可查看完整影响范围分析。
            </p>
            <p>
              <span className="text-purple-400 font-medium">导出一致：</span>
              导出的明细数据与页面展示使用同一数据源，确保培训学员看到的内容与实际数据一致。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
