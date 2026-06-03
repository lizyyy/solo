import { useState, useMemo } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import type { HistoryEntry } from '@/types';
import { Clock, Upload, FileCode, AlertTriangle, FileText, Compass, ChevronRight, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_LABELS: Record<HistoryEntry['action'], string> = {
  import: '导入数据',
  update_cad: '更新CAD图层',
  resolve_conflict: '裁决冲突',
  update_instruction: '更新说明',
  review_coordinate: '坐标复核',
};

const ACTION_COLORS: Record<HistoryEntry['action'], string> = {
  import: 'bg-blue-500',
  update_cad: 'bg-purple-500',
  resolve_conflict: 'bg-orange-500',
  update_instruction: 'bg-green-500',
  review_coordinate: 'bg-teal-500',
};

const ACTION_ICONS: Record<HistoryEntry['action'], React.ReactNode> = {
  import: <Upload className="w-3.5 h-3.5" />,
  update_cad: <FileCode className="w-3.5 h-3.5" />,
  resolve_conflict: <AlertTriangle className="w-3.5 h-3.5" />,
  update_instruction: <FileText className="w-3.5 h-3.5" />,
  review_coordinate: <Compass className="w-3.5 h-3.5" />,
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function HistoryPage() {
  const { history, records } = usePipelineStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchPhoto, setSearchPhoto] = useState('');

  const filteredHistory = useMemo(() => {
    return history
      .filter((h) => filterAction === 'all' || h.action === filterAction)
      .filter((h) => {
        if (!searchPhoto) return true;
        const record = records.find((r) => r.id === h.recordId);
        return record?.photoNumber.toLowerCase().includes(searchPhoto.toLowerCase());
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [history, records, filterAction, searchPhoto]);

  const selectedEntry = filteredHistory.find((h) => h.id === selectedId);
  const selectedRecord = selectedEntry ? records.find((r) => r.id === selectedEntry.recordId) : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200">
        <h1 className="text-2xl font-bold font-display text-gray-900">历史追溯</h1>
        <p className="text-sm text-gray-500 mt-1">完整操作日志、版本对比、证据链查看</p>
      </div>

      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">操作类型:</span>
          <select
            className="input-field px-3 py-1.5 text-sm"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="all">全部</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            className="input-field flex-1 text-sm"
            placeholder="搜索照片编号..."
            value={searchPhoto}
            onChange={(e) => setSearchPhoto(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500 font-mono-data">
          共 {filteredHistory.length} 条记录
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Clock className="w-10 h-10 mb-3 opacity-30" />
              <p>暂无历史记录</p>
            </div>
          ) : (
            <div className="relative pl-8 pr-4 py-4">
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200" />
              {filteredHistory.map((entry) => {
                const record = records.find((r) => r.id === entry.recordId);
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'relative mb-6 last:mb-0 cursor-pointer animate-slide-in',
                      selectedId === entry.id && 'opacity-100'
                    )}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <div className={cn(
                      'absolute -left-[22px] w-4 h-4 rounded-full flex items-center justify-center text-white',
                      ACTION_COLORS[entry.action]
                    )}>
                      {ACTION_ICONS[entry.action]}
                    </div>
                    <div className={cn(
                      'card p-3 hover:shadow-md transition-shadow',
                      selectedId === entry.id && 'ring-2 ring-primary-500'
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="status-tag bg-gray-100 text-gray-700">
                          {ACTION_LABELS[entry.action]}
                        </span>
                        <span className="text-xs text-gray-400 font-mono-data">
                          {new Date(entry.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      {record && (
                        <div className="font-mono-data text-sm text-primary-800 mb-1">
                          {record.photoNumber}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 font-mono-data">
                        操作人: {entry.operator}
                      </div>
                      {entry.evidence && (
                        <div className="mt-2 text-xs bg-orange-50 text-orange-700 p-2 rounded border border-orange-200">
                          <span className="font-medium">证据:</span> {entry.evidence}
                        </div>
                      )}
                      {entry.changes.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-primary-600">
                          {entry.changes.length} 处变更
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-1/2 overflow-y-auto bg-gray-50 p-4">
          {!selectedEntry ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ChevronRight className="w-10 h-10 mb-3 opacity-30" />
              <p>选择左侧记录查看详情</p>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('status-tag text-white', ACTION_COLORS[selectedEntry.action])}>
                    {ACTION_LABELS[selectedEntry.action]}
                  </span>
                  {selectedRecord && (
                    <span className="font-mono-data text-sm">{selectedRecord.photoNumber}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 space-y-1 font-mono-data">
                  <p>操作人: {selectedEntry.operator}</p>
                  <p>时间: {new Date(selectedEntry.timestamp).toLocaleString('zh-CN')}</p>
                </div>
              </div>

              {selectedEntry.changes.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-display font-semibold text-gray-800">变更详情</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {selectedEntry.changes.map((change, idx) => (
                      <div key={idx} className="p-4">
                        <div className="text-xs text-gray-500 font-display mb-2">
                          {change.field}
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="text-xs text-gray-400 mb-1">旧值</div>
                            <div className="font-mono-data text-sm bg-red-50 text-red-700 p-2 rounded border border-red-200 line-through">
                              {formatValue(change.oldValue)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-gray-400 mb-1">新值</div>
                            <div className="font-mono-data text-sm bg-green-50 text-green-700 p-2 rounded border border-green-200">
                              {formatValue(change.newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEntry.evidence && (
                <div className="card p-4 bg-orange-50 border-orange-200">
                  <h3 className="font-display font-semibold text-orange-800 mb-2">证据链</h3>
                  <p className="text-sm text-orange-700">{selectedEntry.evidence}</p>
                </div>
              )}

              {selectedRecord && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-display font-semibold text-gray-800">当前记录状态</h3>
                  </div>
                  <div className="p-4 space-y-2 text-sm font-mono-data">
                    <div className="flex justify-between">
                      <span className="text-gray-500">照片编号:</span>
                      <span>{selectedRecord.photoNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">CAD图层:</span>
                      <span>{selectedRecord.cadLayer || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">状态:</span>
                      <span>{selectedRecord.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">坐标类型:</span>
                      <span>{selectedRecord.coordinate.type}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
