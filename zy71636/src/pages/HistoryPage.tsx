import { useState } from 'react';
import {
  ArrowLeft,
  History,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  MapPin,
  Activity,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

interface HistoryPageProps {
  onBack: () => void;
}

export function HistoryPage({ onBack }: HistoryPageProps) {
  const historyRecords = useAppStore((state) => state.historyRecords);
  const cracks = useAppStore((state) => state.cracks);
  const sensors = useAppStore((state) => state.sensors);
  const confirmObjectManually = useAppStore((state) => state.confirmObjectManually);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  const toggleRecord = (id: string) => {
    setExpandedRecords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getTargetName = (targetType: string, targetId: string) => {
    if (targetType === 'crack') {
      return cracks.find((c) => c.id === targetId)?.name || targetId;
    } else if (targetType === 'sensor') {
      return sensors.find((s) => s.id === targetId)?.name || targetId;
    }
    return targetId;
  };

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      coordinate_correction: '坐标修正',
      duplicate_merge: '重复合并',
      breakpoint_fix: '断点修复',
      manual_confirm: '人工确认',
      status_update: '状态更新',
    };
    return labels[type] || type;
  };

  const getChangeTypeIcon = (type: string) => {
    if (type === 'coordinate_correction') return <MapPin size={14} />;
    if (type === 'breakpoint_fix') return <Activity size={14} />;
    return <History size={14} />;
  };

  const filteredRecords = historyRecords.filter((record) => {
    if (filterType !== 'all' && record.targetType !== filterType) return false;
    if (filterStatus === 'confirmed' && !record.manualConfirmed) return false;
    if (filterStatus === 'pending' && record.manualConfirmed) return false;
    return true;
  });

  const pendingCount = historyRecords.filter((r) => !r.manualConfirmed).length;

  const handleQuickConfirm = (record: typeof historyRecords[0]) => {
    confirmObjectManually(
      record.targetType as 'crack' | 'sensor',
      record.targetId,
      '批量确认',
      '通过历史追溯页面批量确认'
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <div className="h-12 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-white font-semibold text-sm flex items-center gap-2">
              <History size={16} />
              历史追溯
            </h1>
            <p className="text-xs text-slate-500">数据变更记录与人工确认追踪</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                filterStatus === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              全部 ({historyRecords.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1',
                filterStatus === 'pending'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              待确认 ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('confirmed')}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                filterStatus === 'confirmed'
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              已确认 ({historyRecords.length - pendingCount})
            </button>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                filterType === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              全部
            </button>
            <button
              onClick={() => setFilterType('crack')}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                filterType === 'crack'
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              裂缝
            </button>
            <button
              onClick={() => setFilterType('sensor')}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                filterType === 'sensor'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              传感器
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <History size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无历史记录</p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <div
                key={record.id}
                className={cn(
                  'bg-slate-800 rounded-xl overflow-hidden transition-all',
                  !record.manualConfirmed && 'ring-1 ring-yellow-500/30'
                )}
              >
                <button
                  onClick={() => toggleRecord(record.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        record.targetType === 'crack'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      )}
                    >
                      {getChangeTypeIcon(record.changeType)}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">
                          {getChangeTypeLabel(record.changeType)}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            record.manualConfirmed
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          )}
                        >
                          {record.manualConfirmed ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle size={12} />
                              已确认
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <AlertCircle size={12} />
                              待确认
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500">
                          {record.targetType === 'crack' ? '裂缝' : '传感器'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {getTargetName(record.targetType, record.targetId)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(record.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!record.manualConfirmed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickConfirm(record);
                        }}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-400 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        快速确认
                      </button>
                    )}
                    {expandedRecords.has(record.id) ? (
                      <ChevronUp size={18} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={18} className="text-slate-400" />
                    )}
                  </div>
                </button>

                {expandedRecords.has(record.id) && (
                  <div className="px-4 pb-4 border-t border-slate-700/50">
                    <div className="pt-4 grid grid-cols-2 gap-4">
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <label className="text-xs text-slate-400 block mb-1">
                          变更前
                        </label>
                        <p className="text-sm text-slate-300">{record.beforeValue}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-3">
                        <label className="text-xs text-slate-400 block mb-1">
                          变更后
                        </label>
                        <p className="text-sm text-slate-300">{record.afterValue}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          变更原因
                        </label>
                        <p className="text-sm text-slate-300">{record.reason}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1">
                          <User size={10} />
                          操作人
                        </label>
                        <p className="text-sm text-slate-300">{record.operator}</p>
                      </div>
                    </div>

                    {record.manualConfirmed && (
                      <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle size={14} />
                          <span>此变更已人工确认，不会被自动覆盖</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-slate-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <span>共 {historyRecords.length} 条历史记录</span>
          <span>
            待确认 {pendingCount} 条 · 已确认 {historyRecords.length - pendingCount} 条
          </span>
        </div>
      </div>
    </div>
  );
}
