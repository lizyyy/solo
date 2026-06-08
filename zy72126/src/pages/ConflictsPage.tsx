import { useState } from 'react';
import { AlertTriangle, CheckCircle, ArrowLeft, ArrowRight, Edit3, Lightbulb, Music } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import type { ConflictResolution } from '@/types';

const fieldLabels: Record<string, string> = {
  trackName: '曲目名称',
  artist: '艺术家',
  duration: '时长',
  channelNo: '通道号',
  fileName: '文件名',
};

export const ConflictsPage = () => {
  const { tracks, conflicts, resolveConflict } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [manualValue, setManualValue] = useState('');
  const [editingConflictId, setEditingConflictId] = useState<string | null>(null);

  const filteredConflicts = conflicts.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const getTrackName = (trackId: string) => {
    if (!trackId) return '未关联曲目（缺失检测）';
    return tracks.find((t) => t.id === trackId)?.trackName || '未知曲目';
  };

  const handleResolve = (
    conflictId: string,
    resolution: ConflictResolution,
    manual?: string
  ) => {
    resolveConflict(conflictId, resolution, manual);
    setEditingConflictId(null);
    setManualValue('');
  };

  const pendingCount = conflicts.filter((c) => c.status === 'pending').length;

  return (
    <div>
      <PageHeader
        title="冲突审核"
        subtitle="对比舞台通道表与导入数据的差异，展示双方证据，由您人工裁决"
        action={
          <div className="flex items-center gap-2">
            {(['pending', 'resolved', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === f
                    ? 'bg-olive-700 text-white'
                    : 'bg-white text-olive-600 hover:bg-olive-50'
                )}
              >
                {f === 'pending' && `待处理 (${pendingCount})`}
                {f === 'resolved' && '已解决'}
                {f === 'all' && '全部'}
              </button>
            ))}
          </div>
        }
      />

      {filteredConflicts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-moss-400 mb-4" />
          <p className="text-olive-600 text-lg">
            {filter === 'pending' ? '暂无待处理的冲突' : '暂无冲突记录'}
          </p>
          <p className="text-sm text-olive-400 mt-2">
            {filter === 'pending'
              ? '所有数据冲突已处理完毕'
              : '导入文件后，系统会自动检测数据冲突'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredConflicts.map((conflict, index) => {
            const isEditing = editingConflictId === conflict.id;
            return (
              <div
                key={conflict.id}
                className={cn(
                  'bg-white rounded-xl shadow-soft overflow-hidden animate-slide-in',
                  conflict.status === 'resolved' && 'opacity-75'
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="px-6 py-4 bg-olive-50 border-b border-olive-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        conflict.status === 'pending' ? 'bg-amber-100' : 'bg-moss-100'
                      )}
                    >
                      {conflict.status === 'pending' ? (
                        <AlertTriangle size={20} className="text-amber-600" />
                      ) : (
                        <CheckCircle size={20} className="text-moss-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Music size={16} className="text-olive-500" />
                        <span className="font-semibold text-olive-900">
                          {getTrackName(conflict.trackId)}
                        </span>
                      </div>
                      <p className="text-sm text-olive-500">
                        字段：{fieldLabels[conflict.field] || conflict.field}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium',
                      conflict.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-moss-100 text-moss-700'
                    )}
                  >
                    {conflict.status === 'pending' ? '待处理' : '已解决'}
                  </span>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div
                      className={cn(
                        'p-4 rounded-xl border-2 transition-colors',
                        conflict.resolution === 'A'
                          ? 'border-moss-500 bg-moss-50'
                          : 'border-cream-300 bg-cream-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowLeft size={16} className="text-olive-500" />
                        <span className="font-semibold text-olive-800">{conflict.sourceA}</span>
                      </div>
                      <p className="text-lg font-serif text-olive-900">{conflict.valueA}</p>
                    </div>

                    <div
                      className={cn(
                        'p-4 rounded-xl border-2 transition-colors',
                        conflict.resolution === 'B'
                          ? 'border-moss-500 bg-moss-50'
                          : 'border-cream-300 bg-cream-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3 justify-end">
                        <span className="font-semibold text-olive-800">{conflict.sourceB}</span>
                        <ArrowRight size={16} className="text-olive-500" />
                      </div>
                      <p className="text-lg font-serif text-olive-900 text-right">
                        {conflict.valueB}
                      </p>
                    </div>
                  </div>

                  {conflict.resolution === 'manual' && conflict.manualValue && (
                    <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Edit3 size={16} className="text-amber-600" />
                        <span className="font-semibold text-amber-800">人工输入值</span>
                      </div>
                      <p className="text-lg font-serif text-amber-900">{conflict.manualValue}</p>
                    </div>
                  )}

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 mb-6">
                    <div className="flex items-start gap-2">
                      <Lightbulb size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-800 text-sm">系统建议</p>
                        <p className="text-amber-700 mt-1">{conflict.suggestedAction}</p>
                      </div>
                    </div>
                  </div>

                  {conflict.status === 'pending' && (
                    <div>
                      {isEditing ? (
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={manualValue}
                            onChange={(e) => setManualValue(e.target.value)}
                            placeholder="输入自定义值..."
                            className="flex-1 px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            autoFocus
                          />
                          <button
                            onClick={() =>
                              handleResolve(conflict.id, 'manual', manualValue)
                            }
                            disabled={!manualValue.trim()}
                            className={cn(
                              'px-4 py-2 rounded-lg font-medium transition-colors',
                              manualValue.trim()
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : 'bg-amber-200 text-amber-500 cursor-not-allowed'
                            )}
                          >
                            确认
                          </button>
                          <button
                            onClick={() => {
                              setEditingConflictId(null);
                              setManualValue('');
                            }}
                            className="px-4 py-2 bg-olive-100 text-olive-700 rounded-lg hover:bg-olive-200 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-olive-500">请选择保留哪个版本，或人工输入正确值</p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleResolve(conflict.id, 'A')}
                              className="px-4 py-2 bg-olive-100 text-olive-700 rounded-lg hover:bg-olive-200 transition-colors font-medium"
                            >
                              采用 A
                            </button>
                            <button
                              onClick={() => handleResolve(conflict.id, 'B')}
                              className="px-4 py-2 bg-olive-100 text-olive-700 rounded-lg hover:bg-olive-200 transition-colors font-medium"
                            >
                              采用 B
                            </button>
                            <button
                              onClick={() => setEditingConflictId(conflict.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                            >
                              <Edit3 size={16} />
                              人工输入
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {conflict.status === 'resolved' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-olive-500">
                        裁决结果：
                        <span className="font-medium text-moss-600 ml-1">
                          {conflict.resolution === 'A' && '采用数据源 A'}
                          {conflict.resolution === 'B' && '采用数据源 B'}
                          {conflict.resolution === 'manual' && '人工输入'}
                        </span>
                      </span>
                      <span className="text-olive-400">
                        {conflict.resolvedAt &&
                          new Date(conflict.resolvedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
