import { Search, AlertTriangle, GitBranch, CloudRain } from 'lucide-react';
import type { BuoyRecord } from '../../types';
import { useRecordStore } from '../../store/useRecordStore';

interface Props {
  records: BuoyRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const statusLabels: Record<string, string> = {
  pending: '待复核',
  reviewed: '已复核',
  anomaly: '异常',
  boundary: '边界样本',
};

const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  reviewed: 'bg-green-100 text-green-700',
  anomaly: 'bg-alert-400/20 text-alert-500',
  boundary: 'bg-purple-100 text-purple-700',
};

export default function RecordList({ records, selectedId, onSelect }: Props) {
  const filters = useRecordStore(s => s.filters);
  const setFilter = useRecordStore(s => s.setFilter);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-200 space-y-3">
        <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="搜索浮标编号..."
          value={filters.search || ''}
          onChange={e => setFilter('search', e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500/30 focus:border-ocean-400 bg-white"
        />
      </div>

      <div className="flex gap-1 text-xs">
        <button
          onClick={() => setFilter('status', undefined)}
          className={`px-2 py-1 rounded-md transition-colors ${
            !filters.status ? 'bg-ocean-100 text-ocean-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          全部
        </button>
        <button
          onClick={() => setFilter('status', 'anomaly')}
          className={`px-2 py-1 rounded-md flex items-center gap-1 transition-colors ${
            filters.status === 'anomaly' ? 'bg-alert-400/20 text-alert-500' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          异常
        </button>
        <button
          onClick={() => setFilter('status', 'pending')}
          className={`px-2 py-1 rounded-md transition-colors ${
            filters.status === 'pending' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          待复核
        </button>
        <button
          onClick={() => setFilter('status', 'boundary')}
          className={`px-2 py-1 rounded-md flex items-center gap-1 transition-colors ${
            filters.status === 'boundary' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <GitBranch className="w-3 h-3" />
          边界
        </button>
      </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">暂无匹配记录</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map(record => (
              <button
                key={record.id}
                onClick={() => onSelect(record.id)}
                className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${
                  selectedId === record.id ? 'bg-ocean-50 border-l-2 border-l-ocean-500' : ''
                } ${record.isAnomaly ? 'bg-alert-400/5' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-800">{record.buoyId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[record.status]}`}>
                    {statusLabels[record.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>海况 {record.seaState} 级</span>
                  <span>·</span>
                  <span>波高 {record.waveHeight}m</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-slate-400 font-mono">
                    {record.rawLogEntry.latRaw}, {record.rawLogEntry.lonRaw}
                  </span>
                  {record.isCloudOccluded && (
                    <CloudRain className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                {record.isAnomaly && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-alert-500">
                    <AlertTriangle className="w-3 h-3" />
                    <span>点击查看异常详情</span>
                  </div>
                )}
                {record.isBoundary && (
                  <div className="mt-1 text-xs text-purple-600 flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    <span>边界样本</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
