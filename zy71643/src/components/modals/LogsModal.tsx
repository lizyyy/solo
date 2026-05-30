import { useState } from 'react';
import { X, FileText, Info, AlertTriangle, AlertCircle, Download, Trash2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { logger } from '../../utils/logger';
import type { OperationLog } from '../../types';
import { cn } from '../../lib/utils';

export function LogsModal() {
  const show = useUIStore((state) => state.showLogsModal);
  const setShow = useUIStore((state) => state.setShowLogsModal);
  const showNotification = useUIStore((state) => state.showNotification);

  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [logs, setLogs] = useState<OperationLog[]>(logger.getAll());

  if (!show) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterModule !== 'all' && log.module !== filterModule) return false;
    return true;
  });

  const handleClear = () => {
    logger.clear();
    setLogs([]);
    showNotification('日志已清空', 'info');
  };

  const handleExport = () => {
    const logText = logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.module}] ${log.message}${
            log.details ? ' ' + JSON.stringify(log.details) : ''
          }`
      )
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `管线巡检日志_${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('日志导出成功', 'success');
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle size={12} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={12} className="text-yellow-400" />;
      default:
        return <Info size={12} className="text-blue-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'border-red-500/30 bg-red-500/5';
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-500/5';
      default:
        return 'border-blue-500/30 bg-blue-500/5';
    }
  };

  const moduleLabels: Record<string, string> = {
    data: '数据处理',
    collision: '碰撞检测',
    workflow: '问题流转',
    report: '报告导出',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <FileText size={18} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">操作日志</h2>
              <p className="text-slate-400 text-xs">共 {logs.length} 条记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={logs.length === 0}
              className={cn(
                'p-2 rounded-lg transition-colors',
                logs.length > 0
                  ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              )}
              title="导出日志"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleClear}
              disabled={logs.length === 0}
              className={cn(
                'p-2 rounded-lg transition-colors',
                logs.length > 0
                  ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                  : 'text-slate-600 cursor-not-allowed'
              )}
              title="清空日志"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setShow(false)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/30">
          <div className="flex items-center gap-3">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">全部级别</option>
              <option value="info">信息</option>
              <option value="warning">警告</option>
              <option value="error">错误</option>
            </select>

            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">全部模块</option>
              <option value="data">数据处理</option>
              <option value="collision">碰撞检测</option>
              <option value="workflow">问题流转</option>
              <option value="report">报告导出</option>
            </select>

            <span className="text-xs text-slate-400 ml-auto">
              显示 {filteredLogs.length} 条
            </span>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <FileText size={40} className="mb-3 opacity-50" />
              <p className="text-sm">暂无日志记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'border rounded-lg p-3 text-xs',
                    getLevelColor(log.level)
                  )}
                >
                  <div className="flex items-start gap-2">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium',
                          log.module === 'data' && 'bg-green-500/20 text-green-400',
                          log.module === 'collision' && 'bg-blue-500/20 text-blue-400',
                          log.module === 'workflow' && 'bg-purple-500/20 text-purple-400',
                          log.module === 'report' && 'bg-orange-500/20 text-orange-400'
                        )}>
                          {moduleLabels[log.module] || log.module}
                        </span>
                        <span className="text-slate-500 text-[10px] font-mono">
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-slate-300">{log.message}</p>
                      {log.details && (
                        <pre className="mt-1 text-[10px] text-slate-500 font-mono bg-slate-800/50 rounded p-2 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-3 border-t border-slate-700 bg-slate-800/30">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
