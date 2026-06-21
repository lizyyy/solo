import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Edit3,
  Lightbulb,
  Music,
  FilePlus,
  X,
  User,
  Clock,
  Save,
  FileX,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import type { ConflictType } from '@/types';

const fieldLabels: Record<string, string> = {
  trackName: '曲目名称',
  artist: '艺术家',
  duration: '时长',
  channelNo: '通道号',
  fileName: '文件名',
};

const conflictTypeLabels: Record<ConflictType, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  value_mismatch: {
    label: '字段值冲突',
    desc: '通道表与导入文件同一字段值不一致',
    icon: <AlertTriangle size={16} />,
    color: 'text-amber-600 bg-amber-100',
  },
  extra_file: {
    label: '多余文件',
    desc: '导入的文件在通道表中找不到对应条目',
    icon: <FilePlus size={16} />,
    color: 'text-brick-600 bg-brick-100',
  },
  missing_file: {
    label: '缺失文件',
    desc: '通道表有条目但没有对应导入文件',
    icon: <FileX size={16} />,
    color: 'text-olive-600 bg-olive-100',
  },
};

export const ConflictsPage = () => {
  const { tracks, channelTable, conflicts, resolveConflict } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [editingConflictId, setEditingConflictId] = useState<string | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [resolutionReasons, setResolutionReasons] = useState<Record<string, string>>({});
  const [resolvedBys, setResolvedBys] = useState<Record<string, string>>({});

  const getReason = (id: string) => resolutionReasons[id] || '';
  const getHandler = (id: string) => resolvedBys[id] || '林老师';
  const getManual = (id: string) => manualValues[id] || '';
  const setReason = (id: string, v: string) =>
    setResolutionReasons((s) => ({ ...s, [id]: v }));
  const setHandler = (id: string, v: string) =>
    setResolvedBys((s) => ({ ...s, [id]: v }));
  const setManual = (id: string, v: string) =>
    setManualValues((s) => ({ ...s, [id]: v }));

  const filteredConflicts = conflicts.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const pendingCount = conflicts.filter((c) => c.status === 'pending').length;

  const getTrackName = (trackId?: string): string => {
    if (!trackId) return '—';
    return tracks.find((t) => t.id === trackId)?.trackName || '未知曲目';
  };

  const getChannelName = (channelEntryId?: string): string => {
    if (!channelEntryId) return '—';
    const e = channelTable.find((c) => c.id === channelEntryId);
    return e ? `第${e.channelNo}通道 · ${e.trackName}` : '未知通道';
  };

  const handleResolve = (
    conflictId: string,
    resolution: any,
    options?: { manualValue?: string }
  ) => {
    resolveConflict(conflictId, resolution, {
      manualValue: options?.manualValue,
      resolvedBy: getHandler(conflictId),
      resolutionReason: getReason(conflictId).trim() || undefined,
    });
    setEditingConflictId(null);
    setManual(conflictId, '');
    setReason(conflictId, '');
  };

  const renderResolutionLabel = (c: any): string => {
    if (c.conflictType === 'value_mismatch') {
      if (c.resolution === 'A') return '采用数据源A';
      if (c.resolution === 'B') return '采用数据源B';
      if (c.resolution === 'manual') return `人工输入: ${c.manualValue}`;
    }
    if (c.conflictType === 'extra_file') {
      if (c.resolution === 'A') return '删除该文件（以通道表为准）';
      if (c.resolution === 'B') return '保留该文件（不关联通道表）';
      if (c.resolution === 'add_to_channel') return '补录到通道表';
      if (c.resolution === 'ignore') return '暂忽略';
      if (c.resolution === 'manual') return `人工修正: ${c.manualValue}`;
    }
    if (c.conflictType === 'missing_file') {
      if (c.resolution === 'A' || c.resolution === 'ignore') return '已确认无对应文件';
      if (c.resolution === 'B') return '标记待补传';
      if (c.resolution === 'delete_track') return '已从通道表移除';
    }
    return '—';
  };

  return (
    <div>
      <PageHeader
        title="冲突审核"
        subtitle="对比舞台通道表与导入数据的差异，展示双方证据、裁决动作和处理人，所有记录永久留存"
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
                {f === 'resolved' && `已裁决 (${conflicts.length - pendingCount})`}
                {f === 'all' && `全部 (${conflicts.length})`}
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
            const typeInfo = conflictTypeLabels[conflict.conflictType];
            const isEditing = editingConflictId === conflict.id;
            return (
              <div
                key={conflict.id}
                className={cn(
                  'bg-white rounded-xl shadow-soft overflow-hidden animate-slide-in',
                  conflict.status === 'resolved' && 'opacity-90'
                )}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="px-6 py-4 bg-olive-50 border-b border-olive-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Music size={16} className="text-olive-500" />
                        <span className="font-semibold text-olive-900">
                          {conflict.conflictType === 'missing_file'
                            ? getChannelName(conflict.channelEntryId)
                            : getTrackName(conflict.trackId)}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1', typeInfo.color)}>
                          {typeInfo.icon}
                          {typeInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-olive-500 mt-0.5">
                        {fieldLabels[conflict.field] || conflict.field} · {typeInfo.desc}
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
                    {conflict.status === 'pending' ? '待裁决' : '已裁决'}
                  </span>
                </div>

                <div className="p-6">
                  {conflict.conflictType !== 'missing_file' && (
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
                          <span className="font-semibold text-olive-800 text-sm">{conflict.sourceA}</span>
                        </div>
                        <p className="text-lg font-serif text-olive-900 break-all">{conflict.originalValueA}</p>
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
                          <span className="font-semibold text-olive-800 text-sm">{conflict.sourceB}</span>
                          <ArrowRight size={16} className="text-olive-500" />
                        </div>
                        <p className="text-lg font-serif text-olive-900 break-all text-right">
                          {conflict.originalValueB}
                        </p>
                      </div>
                    </div>
                  )}

                  {conflict.conflictType === 'missing_file' && (
                    <div className="mb-6 p-4 rounded-xl bg-olive-50 border border-olive-200">
                      <div className="flex items-center gap-2 mb-2">
                        <FileX size={18} className="text-olive-600" />
                        <span className="font-semibold text-olive-800">
                          通道表条目: {getChannelName(conflict.channelEntryId)}
                        </span>
                      </div>
                      <p className="text-olive-700">
                        <span className="text-olive-500">通道表原始值：</span>
                        <span className="font-serif text-olive-900">{conflict.originalValueA}</span>
                        <span className="mx-2 text-olive-400">/</span>
                        <span className="text-olive-500">检测结果：</span>
                        <span className="font-serif text-brick-700">{conflict.originalValueB}</span>
                      </p>
                    </div>
                  )}

                  {(conflict.resolution === 'manual' || conflict.resolution === 'add_to_channel') && conflict.manualValue && (
                    <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Edit3 size={16} className="text-amber-600" />
                        <span className="font-semibold text-amber-800">人工输入/补录值</span>
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

                  {conflict.status === 'resolved' && (
                    <div className="mb-4 p-4 bg-moss-50 rounded-xl border border-moss-200">
                      <p className="font-semibold text-moss-800 text-sm mb-2">裁决结果</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-moss-600">处理动作：</span>
                          <span className="font-medium text-moss-800">{renderResolutionLabel(conflict)}</span>
                        </div>
                        <div>
                          <span className="text-moss-600">处理人：</span>
                          <span className="font-medium text-moss-800 flex items-center gap-1">
                            <User size={14} />
                            {conflict.resolvedBy || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-moss-600">处理时间：</span>
                          <span className="font-medium text-moss-800 flex items-center gap-1">
                            <Clock size={14} />
                            {conflict.resolvedAt
                              ? new Date(conflict.resolvedAt).toLocaleString('zh-CN')
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-moss-600">处理原因：</span>
                          <span className="font-medium text-moss-800">
                            {conflict.resolutionReason || '—'}
                          </span>
                        </div>
                      </div>
                      {conflict.conflictType === 'missing_file' && conflict.channelEntryId && (() => {
                        const e = channelTable.find((x) => x.id === conflict.channelEntryId);
                        if (!e) return null;
                        const statusLabel: Record<string, { label: string; cls: string }> = {
                          matched: { label: '已匹配文件', cls: 'bg-moss-100 text-moss-700' },
                          confirmed_missing: { label: '已确认无文件', cls: 'bg-brick-100 text-brick-700' },
                          pending_upload: { label: '待补传文件', cls: 'bg-amber-100 text-amber-700' },
                          removed_from_setlist: { label: '已从曲目单移除', cls: 'bg-olive-100 text-olive-700' },
                          pending: { label: '待处理', cls: 'bg-cream-100 text-olive-700' },
                        };
                        const s = statusLabel[e.fileStatus] || statusLabel.pending;
                        return (
                          <div className="mt-3 p-3 rounded-lg bg-white border border-moss-100 text-xs">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-moss-700">通道表处理状态：</span>
                              <span className={`px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                            </div>
                            <div className="text-moss-600 space-y-1">
                              <div>关联通道条目：第{e.channelNo}通道 · {e.trackName}</div>
                              {e.resolvedBy && <div>通道表处理人：{e.resolvedBy}</div>}
                              {e.resolutionReason && <div>通道表处理原因：{e.resolutionReason}</div>}
                              {e.resolutionNote && (
                                <div className="pt-1 mt-1 border-t border-moss-100 break-all">
                                  <span className="font-semibold">证据链：</span>
                                  {e.resolutionNote}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      {(conflict.trackId || conflict.channelEntryId) && (
                        <div className="mt-3 pt-3 border-t border-moss-200 text-xs text-moss-600 break-all">
                          证据链：数据源A({conflict.sourceA})="{conflict.originalValueA}" vs 数据源B(
                          {conflict.sourceB})="{conflict.originalValueB}" → 裁决: {renderResolutionLabel(conflict)}
                          {conflict.resolutionReason ? ` | 处理原因: ${conflict.resolutionReason}` : ''}
                          {conflict.resolvedBy ? ` | 处理人: ${conflict.resolvedBy}` : ''}
                        </div>
                      )}
                    </div>
                  )}

                  {conflict.status === 'pending' && (
                    <div>
                      {isEditing ? (
                        <div className="space-y-3 p-4 bg-amber-50 rounded-xl border border-amber-200 animate-fade-in">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder={
                                conflict.conflictType === 'extra_file'
                                  ? '人工修正曲目名，或留空启用其他动作'
                                  : '输入自定义值'
                              }
                              value={getManual(conflict.id)}
                              onChange={(e) => setManual(conflict.id, e.target.value)}
                              className="px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                              autoFocus
                            />
                            <input
                              type="text"
                              placeholder="处理人"
                              value={getHandler(conflict.id)}
                              onChange={(e) => setHandler(conflict.id, e.target.value)}
                              className="px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="处理原因（可选）"
                            value={getReason(conflict.id)}
                            onChange={(e) => setReason(conflict.id, e.target.value)}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingConflictId(null);
                                setManual(conflict.id, '');
                                setReason(conflict.id, '');
                              }}
                              className="px-3 py-1.5 text-sm text-olive-600 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <X size={14} /> 取消
                            </button>
                            <button
                              onClick={() =>
                                handleResolve(conflict.id, 'manual', {
                                  manualValue: getManual(conflict.id).trim() || undefined,
                                })
                              }
                              disabled={!getManual(conflict.id).trim() && conflict.conflictType !== 'extra_file'}
                              className={cn(
                                'px-4 py-1.5 text-sm rounded-lg font-medium flex items-center gap-1 transition-colors',
                                getManual(conflict.id).trim() || conflict.conflictType === 'extra_file'
                                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                                  : 'bg-amber-200 text-amber-400 cursor-not-allowed'
                              )}
                            >
                              <Save size={14} /> 确认
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <input
                              type="text"
                              placeholder="处理人"
                              value={getHandler(conflict.id)}
                              onChange={(e) => setHandler(conflict.id, e.target.value)}
                              className="px-2 py-1 w-24 border border-olive-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="处理原因（可选）"
                              value={getReason(conflict.id)}
                              onChange={(e) => setReason(conflict.id, e.target.value)}
                              className="px-2 py-1 w-56 border border-olive-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {conflict.conflictType === 'value_mismatch' && (
                              <>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'A')}
                                  className="px-4 py-2 bg-olive-100 text-olive-700 rounded-lg hover:bg-olive-200 transition-colors font-medium text-sm"
                                >
                                  采用 A
                                </button>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'B')}
                                  className="px-4 py-2 bg-olive-100 text-olive-700 rounded-lg hover:bg-olive-200 transition-colors font-medium text-sm"
                                >
                                  采用 B
                                </button>
                              </>
                            )}
                            {conflict.conflictType === 'extra_file' && (
                              <>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'A')}
                                  className="px-4 py-2 bg-brick-100 text-brick-700 rounded-lg hover:bg-brick-200 transition-colors font-medium text-sm"
                                >
                                  删除该文件
                                </button>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'B')}
                                  className="px-4 py-2 bg-olive-100 text-olive-700 rounded-lg hover:bg-olive-200 transition-colors font-medium text-sm"
                                >
                                  保留（不关联）
                                </button>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'add_to_channel')}
                                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm"
                                >
                                  补录到通道表
                                </button>
                              </>
                            )}
                            {conflict.conflictType === 'missing_file' && (
                              <>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'ignore')}
                                  className="px-4 py-2 bg-olive-100 text-olive-700 rounded-lg hover:bg-olive-200 transition-colors font-medium text-sm"
                                >
                                  确认无文件
                                </button>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'B')}
                                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium text-sm"
                                >
                                  标记待补传
                                </button>
                                <button
                                  onClick={() => handleResolve(conflict.id, 'delete_track')}
                                  className="px-4 py-2 bg-brick-100 text-brick-700 rounded-lg hover:bg-brick-200 transition-colors font-medium text-sm"
                                >
                                  从通道表移除
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setEditingConflictId(conflict.id)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm"
                            >
                              <Edit3 size={16} />
                              人工输入
                            </button>
                          </div>
                        </div>
                      )}
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
