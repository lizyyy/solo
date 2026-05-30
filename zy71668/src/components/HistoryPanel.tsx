import { useState } from 'react';
import { History, Clock, User, FileText, ChevronRight, Download, Eye, RotateCcw, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { formatTime, formatDistance } from '@/utils/calculator';
import type { HistoryRecord } from '@/types';

export default function HistoryPanel() {
  const historyRecords = useAppStore((state) => state.historyRecords);
  const loadFromHistory = useAppStore((state) => state.loadFromHistory);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLoadRecord = (record: HistoryRecord) => {
    loadFromHistory(record.id);
    setActiveTab('workspace');
  };

  if (historyRecords.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
          <History className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-400 mb-2">
          暂无历史记录
        </h3>
        <p className="text-sm text-slate-500">
          完成计算并保存后，记录将显示在这里
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <History className="w-6 h-6 text-aviation-400" />
          历史版本记录
        </h2>
        <span className="text-sm text-slate-400">
          共 {historyRecords.length} 条记录
        </span>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700" />

        <div className="space-y-4">
          {historyRecords.map((record, index) => (
            <div key={record.id} className="relative pl-14">
              <div
                className={`absolute left-4 w-5 h-5 rounded-full border-4 ${
                  index === 0
                    ? 'bg-aviation-500 border-aviation-300'
                    : 'bg-slate-700 border-slate-600'
                }`}
              />

              <div className="card p-4 hover:border-aviation-500/30 transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="px-2 py-0.5 bg-aviation-500/20 text-aviation-300 text-xs font-mono rounded">
                        v{record.version}
                      </span>
                      <h4 className="font-semibold text-slate-200">
                        {record.description || '未命名计算'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {record.author || '匿名用户'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(record.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleLoadRecord(record)}
                      className="p-2 hover:bg-aviation-500/20 rounded-lg transition-colors text-aviation-400 hover:text-aviation-300"
                      title="加载此版本"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center p-2 bg-slate-700/30 rounded">
                    <div className="text-xs text-slate-400 mb-1">飞行时间</div>
                    <div className="font-mono text-sm text-slate-200">
                      {formatTime(record.calculationResult.estimatedFlightTime)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/30 rounded">
                    <div className="text-xs text-slate-400 mb-1">航程</div>
                    <div className="font-mono text-sm text-slate-200">
                      {formatDistance(record.calculationResult.estimatedRange)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/30 rounded">
                    <div className="text-xs text-slate-400 mb-1">电量余量</div>
                    <div
                      className={`font-mono text-sm ${
                        record.calculationResult.remainingBatteryMargin < 0
                          ? 'text-danger-400'
                          : record.calculationResult.remainingBatteryMargin < 10
                            ? 'text-warning-400'
                            : 'text-success-400'
                      }`}
                    >
                      {record.calculationResult.remainingBatteryMargin.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/30 rounded">
                    <div className="text-xs text-slate-400 mb-1">风险数</div>
                    <div className="font-mono text-sm text-slate-200">
                      {record.calculationResult.risks.length}
                    </div>
                  </div>
                </div>

                {record.changes.length > 0 && (
                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">
                      本次修改 ({record.changes.length} 项)
                    </div>
                    <div className="space-y-1">
                      {record.changes.slice(0, 3).map((change, idx) => (
                        <div key={idx} className="text-xs text-slate-500 flex items-center gap-2">
                          <ChevronRight className="w-3 h-3" />
                          <span className="font-mono text-aviation-400">{change.field}:</span>
                          <span className="text-slate-400">
                            {String(change.oldValue)} → {String(change.newValue)}
                          </span>
                        </div>
                      ))}
                      {record.changes.length > 3 && (
                        <div className="text-xs text-slate-500">
                          还有 {record.changes.length - 3} 项修改...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-aviation-400" />
                版本详情 - v{selectedRecord.version}
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-400 mb-2">基本信息</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-700/30 rounded">
                      <div className="text-xs text-slate-500">作者</div>
                      <div className="text-slate-200">{selectedRecord.author}</div>
                    </div>
                    <div className="p-3 bg-slate-700/30 rounded">
                      <div className="text-xs text-slate-500">时间</div>
                      <div className="text-slate-200">{formatDate(selectedRecord.timestamp)}</div>
                    </div>
                    <div className="p-3 bg-slate-700/30 rounded">
                      <div className="text-xs text-slate-500">无人机型号</div>
                      <div className="text-slate-200">{selectedRecord.calculationResult.droneParams.model}</div>
                    </div>
                    <div className="p-3 bg-slate-700/30 rounded">
                      <div className="text-xs text-slate-500">置信度</div>
                      <div className="text-slate-200">{selectedRecord.calculationResult.confidenceScore}%</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-slate-400 mb-2">修改记录</div>
                  <div className="space-y-2">
                    {selectedRecord.changes.map((change, idx) => (
                      <div key={idx} className="p-3 bg-slate-700/30 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm text-aviation-300">{change.field}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-400">{String(change.oldValue)}</span>
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                          <span className="text-success-400">{String(change.newValue)}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{change.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      handleLoadRecord(selectedRecord);
                      setSelectedRecord(null);
                    }}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    加载此版本
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="px-4 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
