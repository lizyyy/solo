import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useBatchStore } from '@/store/useBatchStore';
import type { HistoryRecord, ChangeType } from '@/types';
import { User, Cpu, Clock, Filter, RotateCcw, History as HistoryIcon, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

const typeConfig: Record<ChangeType, { icon: typeof User; color: string; label: string }> = {
  manual: {
    icon: User,
    color: 'bg-amber-500 border-amber-200 dark:border-amber-700',
    label: '人工修改',
  },
  automatic: {
    icon: Cpu,
    color: 'bg-blue-500 border-blue-200 dark:border-blue-700',
    label: '系统计算',
  },
};

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const currentBatch = useBatchStore((state) => state.currentBatch);
  const historyRecords = useBatchStore((state) => state.historyRecords);
  const revertToVersion = useBatchStore((state) => state.revertToVersion);
  const setCurrentBatch = useBatchStore((state) => state.setCurrentBatch);
  const dataVersion = useBatchStore((state) => state.dataVersion);

  const [versionFilter, setVersionFilter] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      setCurrentBatch(id);
    }
    return () => setCurrentBatch(null);
  }, [id, setCurrentBatch]);

  const versions = useMemo(() => {
    const vs = new Set<number>();
    historyRecords.forEach((r) => vs.add(r.version));
    return Array.from(vs).sort((a, b) => b - a);
  }, [historyRecords]);

  const filteredRecords = useMemo(() => {
    let records = [...historyRecords];
    if (versionFilter !== null) {
      records = records.filter((r) => r.version === versionFilter);
    }
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [historyRecords, versionFilter]);

  const handleRevert = (record: HistoryRecord) => {
    if (confirm(`确定要恢复到版本 ${record.version} 吗？这将撤销此版本之后的所有修改。`)) {
      revertToVersion(record.version);
    }
  };

  const formatValue = (value: string | null) => {
    if (value === null) return <span className="text-slate-400 dark:text-slate-500">空</span>;
    return <span className="text-slate-800 dark:text-slate-200 font-mono">{value}</span>;
  };

  if (!currentBatch) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <HistoryIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">修改历史</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                共 {historyRecords.length} 条记录，当前版本 v{dataVersion}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={versionFilter ?? ''}
                onChange={(e) => setVersionFilter(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="">所有版本</option>
                {versions.map((v) => (
                  <option key={v} value={v}>
                    版本 v{v}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-500 dark:text-slate-400">人工修改</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-500 dark:text-slate-400">系统计算</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">
            {versionFilter ? '该版本暂无记录' : '暂无历史记录'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {versionFilter ? '请选择其他版本或清除筛选' : '对批次进行修改后，修改记录将显示在这里'}
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

          <div className="space-y-4">
            {filteredRecords.map((record, index) => {
              const config = typeConfig[record.changeType];
              const Icon = config.icon;
              const isLatest = index === 0 && versionFilter === null;

              return (
                <div key={record.id} className="relative pl-16">
                  <div
                    className={cn(
                      'absolute left-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10',
                      config.color,
                      'bg-white dark:bg-slate-800'
                    )}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  {record.version !== (filteredRecords[index - 1]?.version ?? -1) && (
                    <div className="flex items-center gap-2 mb-3 -ml-2">
                      <GitBranch className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        版本 v{record.version}
                      </span>
                      {record.version === dataVersion && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
                          当前版本
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={cn(
                      'bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200',
                      isLatest
                        ? 'border-blue-200 dark:border-blue-800 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    )}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-800 dark:text-white">
                              {record.description}
                            </h4>
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs font-medium rounded-full',
                                record.changeType === 'manual'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              )}
                            >
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{record.modifiedBy}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{dayjs(record.timestamp).format('YYYY-MM-DD HH:mm:ss')}</span>
                            </div>
                          </div>
                        </div>

                        {record.version < dataVersion && (
                          <button
                            onClick={() => handleRevert(record)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            恢复此版本
                          </button>
                        )}
                      </div>

                      {record.oldValue !== null || record.newValue !== null ? (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">修改前</div>
                              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/30">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                    {record.fieldName}
                                  </span>
                                </div>
                                <div className="mt-1 text-sm">{formatValue(record.oldValue)}</div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">修改后</div>
                              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    {record.fieldName}
                                  </span>
                                </div>
                                <div className="mt-1 text-sm">{formatValue(record.newValue)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
