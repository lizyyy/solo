import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Link,
  Music,
  Copyright,
  Tag,
  ThumbsUp,
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { StatusBadge, ConflictTypeBadge, EmotionTagBadge } from '@/components/StatusBadge';
import { useAppStore, fetchTrackDetail } from '@/store';
import type { TimelineEvent, Conflict } from '@/../shared/types';
import { EVENT_TYPE_LABELS, EMOTION_TAG_LABELS } from '@/../shared/types';
import { cn } from '@/lib/utils';

const eventIcons: Record<string, any> = {
  algorithm_tag: Tag,
  manual_tag: ThumbsUp,
  copyright_remove: Copyright,
  recommend: Music,
  manual_correction: CheckCircle,
  review_note: FileText,
};

const eventColors: Record<string, string> = {
  algorithm_tag: 'bg-neon-purple-500',
  manual_tag: 'bg-emerald-green-500',
  copyright_remove: 'bg-coral-red-500',
  recommend: 'bg-amber-yellow-500',
  manual_correction: 'bg-neon-purple-500',
  review_note: 'bg-deep-blue-400',
};

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTrack, loading } = useAppStore();
  const [timelineOrder, setTimelineOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    if (id) {
      fetchTrackDetail(id);
    }
  }, [id]);

  if (!selectedTrack && loading.trackDetail) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!selectedTrack) {
    return (
      <div className="p-8 text-center">
        <p className="text-deep-blue-400">未找到曲目信息</p>
        <button onClick={() => navigate('/compare')} className="btn-primary mt-4">
          返回列表
        </button>
      </div>
    );
  }

  const sortedTimeline = [...selectedTrack.timeline].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return timelineOrder === 'asc' ? aTime - bTime : bTime - aTime;
  });

  const hasConflict = selectedTrack.conflicts.some(c => !c.resolved);

  const checkEventConsistency = (event: TimelineEvent, index: number) => {
    const prev = sortedTimeline[index - 1];
    const anomalies: string[] = [];

    if (prev) {
      if (prev.eventType === 'manual_correction' && event.eventType === 'algorithm_tag') {
        anomalies.push('人工修正后出现算法标签，可能覆盖修正结果');
      }
      if (prev.eventType === 'copyright_remove' && event.eventType === 'recommend') {
        anomalies.push('版权下架后仍有推荐记录，存在合规风险');
      }
    }

    return anomalies;
  };

  const versionConclusion = selectedTrack.manualTags.length > 0
    ? selectedTrack.manualTags
    : selectedTrack.algorithmTags;

  const hasVersionMismatch = selectedTrack.conflicts.some(c => c.conflictType === 'version_mismatch');
  const hasCopyrightConflict = selectedTrack.conflicts.some(c => c.conflictType === 'copyright_vs_recommend');

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <button
        onClick={() => navigate('/compare')}
        className="flex items-center gap-2 text-deep-blue-300 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回对比列表
      </button>

      <div className="animate-fade-in">
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-white mb-2">
                {selectedTrack.title}
              </h1>
              <p className="text-deep-blue-300 mb-4">
                {selectedTrack.artist} · {selectedTrack.album} · {selectedTrack.trackId}
              </p>
              <div className="flex items-center gap-4">
                <StatusBadge
                  type={selectedTrack.copyrightStatus === 'removed' ? 'removed' : 'active'}
                  label={selectedTrack.copyrightStatus === 'removed' ? '版权已下架' : '版权正常'}
                />
                {selectedTrack.isRecommended && (
                  <span className="status-badge bg-neon-purple-500/20 text-neon-purple-300 border border-neon-purple-500/30">
                    <Music className="w-3 h-3 mr-1" />
                    推荐中
                  </span>
                )}
                <StatusBadge
                  type={hasConflict ? 'conflict' : 'resolved'}
                  label={hasConflict ? '有冲突待处理' : '状态正常'}
                />
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-neon-purple-400" />
                算法情绪标签
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedTrack.algorithmTags.map(tag => (
                  <EmotionTagBadge key={tag} emotion={tag} className="text-sm py-1 px-3" />
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <ThumbsUp className="w-4 h-4 text-emerald-green-400" />
                人工情绪标签
                {selectedTrack.manualTags.length > 0 && (
                  <span className="text-xs text-emerald-green-400 font-normal">
                    (作为补充证据)
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedTrack.manualTags.length > 0 ? (
                  selectedTrack.manualTags.map(tag => (
                    <EmotionTagBadge key={tag} emotion={tag} className="text-sm py-1 px-3" />
                  ))
                ) : (
                  <span className="text-deep-blue-500">暂无人工标注</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6 mb-6 animate-stagger" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-green-400" />
              版本结论印证
            </h2>
          </div>

          <div className="p-4 bg-emerald-green-500/10 border border-emerald-green-500/20 rounded-lg mb-4">
            <h3 className="font-medium text-emerald-green-400 mb-2">最终标签结论</h3>
            <div className="flex flex-wrap gap-2">
              {versionConclusion.map(tag => (
                <EmotionTagBadge key={tag} emotion={tag} className="text-sm py-1 px-3" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-deep-blue-600/30 rounded-lg border border-deep-blue-400/10">
              <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-yellow-400" />
                冲突队列印证
              </h4>
              {hasVersionMismatch ? (
                <p className="text-sm text-coral-red-400">
                  ⚠️ 存在版本不匹配冲突，结论与算法标签差异较大
                </p>
              ) : (
                <p className="text-sm text-emerald-green-400">
                  ✅ 版本结论与冲突队列记录一致
                </p>
              )}
              {selectedTrack.conflicts.filter(c => c.conflictType === 'algorithm_vs_manual' || c.conflictType === 'version_mismatch').length > 0 && (
                <div className="mt-2 pt-2 border-t border-deep-blue-400/10">
                  <p className="text-xs text-deep-blue-400">相关冲突:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedTrack.conflicts
                      .filter(c => c.conflictType === 'algorithm_vs_manual' || c.conflictType === 'version_mismatch')
                      .map(c => (
                        <ConflictTypeBadge
                          key={c.id}
                          conflictType={c.conflictType}
                          severity={c.severity}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-deep-blue-600/30 rounded-lg border border-deep-blue-400/10">
              <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                <Link className="w-4 h-4 text-neon-purple-400" />
                版权联动印证
              </h4>
              {hasCopyrightConflict ? (
                <p className="text-sm text-coral-red-400">
                  ⚠️ 版权已下架但仍在推荐，需要处理
                </p>
              ) : selectedTrack.copyrightStatus === 'removed' ? (
                <p className="text-sm text-amber-yellow-400">
                  📋 曲目已下架，未在推荐列表
                </p>
              ) : (
                <p className="text-sm text-emerald-green-400">
                  ✅ 版权状态与推荐状态一致
                </p>
              )}
              {selectedTrack.conflicts.filter(c => c.conflictType === 'copyright_vs_recommend').length > 0 && (
                <div className="mt-2 pt-2 border-t border-deep-blue-400/10">
                  <p className="text-xs text-deep-blue-400">相关冲突:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedTrack.conflicts
                      .filter(c => c.conflictType === 'copyright_vs_recommend')
                      .map(c => (
                        <ConflictTypeBadge
                          key={c.id}
                          conflictType={c.conflictType}
                          severity={c.severity}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-6 mb-6 animate-stagger" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-neon-purple-400" />
              事件时间线
            </h2>
            <button
              onClick={() => setTimelineOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="btn-secondary text-sm py-1.5"
            >
              {timelineOrder === 'asc' ? '正序排列' : '倒序排列'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-deep-blue-400/30" />

            <div className="space-y-6">
              {sortedTimeline.map((event, index) => {
                const Icon = eventIcons[event.eventType] || FileText;
                const anomalies = checkEventConsistency(event, index);
                const isSelected = selectedEvent?.id === event.id;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      'relative pl-16 cursor-pointer transition-all duration-200',
                      isSelected && 'scale-[1.01]'
                    )}
                    onClick={() => setSelectedEvent(isSelected ? null : event)}
                  >
                    <div className={cn(
                      'absolute left-4 w-5 h-5 rounded-full flex items-center justify-center border-4 border-deep-blue-700',
                      eventColors[event.eventType]
                    )}>
                      <Icon className="w-2 h-2 text-white" />
                    </div>

                    <div className={cn(
                      'p-4 bg-deep-blue-600/30 rounded-lg border transition-all duration-200',
                      anomalies.length > 0
                        ? 'border-coral-red-500/30 bg-coral-red-500/5'
                        : 'border-deep-blue-400/10 hover:border-deep-blue-400/30',
                      isSelected && 'border-neon-purple-500/40 bg-neon-purple-500/5'
                    )}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-deep-blue-400">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                          <span className="status-badge bg-deep-blue-500/30 text-deep-blue-200 text-xs">
                            {EVENT_TYPE_LABELS[event.eventType]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-deep-blue-400">
                          <User className="w-3 h-3" />
                          {event.operator}
                        </div>
                      </div>

                      <p className="text-deep-blue-100 text-sm">{event.description}</p>

                      {event.evidence && (
                        <div className="mt-3 p-3 bg-deep-blue-700/50 rounded-lg">
                          <p className="text-xs text-deep-blue-300 mb-1">📝 补充证据:</p>
                          <p className="text-sm text-deep-blue-200">{event.evidence}</p>
                        </div>
                      )}

                      {anomalies.length > 0 && (
                        <div className="mt-3 flex items-start gap-2 p-3 bg-coral-red-500/10 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-coral-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            {anomalies.map((a, i) => (
                              <p key={i} className="text-xs text-coral-red-300">{a}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-deep-blue-400/10">
                          <p className="text-xs text-deep-blue-400 mb-1">元数据:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(event.metadata).map(([key, value]) => (
                              <span key={key} className="text-xs bg-deep-blue-700/50 px-2 py-1 rounded text-deep-blue-300">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card p-6 animate-stagger" style={{ animationDelay: '300ms' }}>
          <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-yellow-400" />
            冲突记录
          </h2>

          {selectedTrack.conflicts.length === 0 ? (
            <p className="text-deep-blue-400 text-center py-8">暂无冲突记录</p>
          ) : (
            <div className="space-y-3">
              {selectedTrack.conflicts.map((conflict: Conflict) => (
                <div
                  key={conflict.id}
                  className="p-4 bg-deep-blue-600/30 rounded-lg border border-deep-blue-400/10"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <ConflictTypeBadge
                        conflictType={conflict.conflictType}
                        severity={conflict.severity}
                      />
                      <StatusBadge
                        type={conflict.resolved ? 'resolved' : 'conflict'}
                      />
                    </div>
                    <span className="text-xs text-deep-blue-400">
                      {new Date(conflict.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-deep-blue-200 text-sm mb-2">{conflict.description}</p>
                  {conflict.resolved && (
                    <div className="mt-3 p-3 bg-emerald-green-500/10 rounded-lg">
                      <p className="text-xs text-emerald-green-400 mb-1">
                        ✅ 已解决 · {conflict.resolver} · {conflict.resolvedAt && new Date(conflict.resolvedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-deep-blue-200">{conflict.resolutionNote}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
