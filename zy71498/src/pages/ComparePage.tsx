import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Filter,
  Eye,
  Tag,
  ChevronRight,
  X,
  Save,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import Pagination from '@/components/Pagination';
import Drawer from '@/components/Drawer';
import {
  StatusBadge,
  ConflictTypeBadge,
  EmotionTagBadge,
} from '@/components/StatusBadge';
import { useAppStore, fetchTracks, fetchConflicts, fetchTrackDetail, resolveConflict, addManualTag } from '@/store';
import type { Track, Conflict, EmotionTag } from '@/../shared/types';
import { EMOTION_TAG_LABELS, EMOTION_TAG_COLORS, CONFLICT_TYPE_LABELS } from '@/../shared/types';
import { cn } from '@/lib/utils';

export default function ComparePage() {
  const navigate = useNavigate();
  const { tracks, tracksTotal, conflicts, currentPage, pageSize, loading, filters, selectedTrack } = useAppStore();
  const { setCurrentPage, setFilters, setSelectedTrack } = useAppStore();

  const [selectedConflictTrack, setSelectedConflictTrack] = useState<Track | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [selectedTags, setSelectedTags] = useState<EmotionTag[]>([]);
  const [manualNote, setManualNote] = useState('');
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null);

  useEffect(() => {
    fetchTracks();
    fetchConflicts();
  }, [currentPage, filters]);

  useEffect(() => {
    if (detailTrackId) {
      fetchTrackDetail(detailTrackId);
    }
  }, [detailTrackId]);

  const totalPages = Math.ceil(tracksTotal / pageSize);

  const hasConflictTracks = tracks.filter(track => {
    const tagConflict = track.algorithmTags.join(',') !== track.manualTags.join(',');
    const copyrightConflict = track.copyrightStatus === 'removed' && track.isRecommended;
    return tagConflict || copyrightConflict;
  });

  const getTrackConflicts = (trackId: string) => {
    return conflicts.filter(c => c.trackId === trackId);
  };

  const openResolveDrawer = (track: Track) => {
    setSelectedConflictTrack(track);
    setSelectedTags(track.manualTags.length > 0 ? [...track.manualTags] : []);
    setManualNote('');
    setResolveNotes({});
    setDrawerOpen(true);
  };

  const handleResolveConflict = async (conflict: Conflict) => {
    const note = resolveNotes[conflict.id] || '';
    if (!note.trim()) return;
    await resolveConflict(conflict.id, note, '运营专员');
    setResolveNotes(prev => {
      const next = { ...prev };
      delete next[conflict.id];
      return next;
    });
  };

  const handleSaveManualTags = async () => {
    if (!selectedConflictTrack || selectedTags.length === 0) return;
    await addManualTag(selectedConflictTrack.id, selectedTags, manualNote, '运营专员');
    await fetchTracks();
    await fetchConflicts();
    setDrawerOpen(false);
  };

  const toggleTag = (tag: EmotionTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const getRadarData = (track: Track) => {
    const maxVal = 5;
    return Object.keys(EMOTION_TAG_LABELS).map(key => ({
      emotion: EMOTION_TAG_LABELS[key as EmotionTag],
      algorithm: track.algorithmTags.includes(key as EmotionTag) ? maxVal : maxVal * 0.2,
      manual: track.manualTags.includes(key as EmotionTag) ? maxVal : maxVal * 0.2,
      fullMark: maxVal,
    }));
  };

  const emotionTags = Object.keys(EMOTION_TAG_LABELS) as EmotionTag[];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-white mb-2">标签对比</h1>
        <p className="text-deep-blue-300">查看算法与人工标签差异，处理冲突</p>
      </div>

      <div className="flex items-center gap-4 mb-6 animate-stagger">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-deep-blue-400" />
          <select
            value={filters.hasConflict === undefined ? '' : String(filters.hasConflict)}
            onChange={(e) => setFilters({ hasConflict: e.target.value === '' ? undefined : e.target.value === 'true' })}
            className="input-field w-48"
          >
            <option value="">全部曲目</option>
            <option value="true">有冲突</option>
            <option value="false">无冲突</option>
          </select>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-deep-blue-300">
            <AlertTriangle className="w-4 h-4 text-coral-red-400" />
            有冲突: {hasConflictTracks.length}
          </span>
          <span className="flex items-center gap-1 text-deep-blue-300">
            <CheckCircle className="w-4 h-4 text-emerald-green-400" />
            正常: {tracksTotal - hasConflictTracks.length}
          </span>
        </div>
      </div>

      <div className="card overflow-hidden animate-stagger" style={{ animationDelay: '100ms' }}>
        {loading.tracks ? (
          <div className="h-96 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-deep-blue-700/50">
                  <tr>
                    <th className="table-header w-12"></th>
                    <th className="table-header">曲目信息</th>
                    <th className="table-header">算法标签</th>
                    <th className="table-header">人工标签</th>
                    <th className="table-header">版权状态</th>
                    <th className="table-header">冲突类型</th>
                    <th className="table-header">状态</th>
                    <th className="table-header text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track: Track, index) => {
                    const trackConflicts = getTrackConflicts(track.id);
                    const hasUnresolvedConflict = trackConflicts.some(c => !c.resolved);
                    const isAlt = index % 2 === 1;

                    return (
                      <tr
                        key={track.id}
                        className={cn(isAlt ? 'table-row-alt' : 'table-row')}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="table-cell">
                          {hasUnresolvedConflict && (
                            <AlertTriangle className="w-4 h-4 text-coral-red-400 animate-pulse" />
                          )}
                        </td>
                        <td className="table-cell">
                          <div>
                            <p className="font-medium text-white">{track.title}</p>
                            <p className="text-xs text-deep-blue-400">{track.artist} · {track.trackId}</p>
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-1">
                            {track.algorithmTags.map(tag => (
                              <EmotionTagBadge key={tag} emotion={tag} />
                            ))}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-1">
                            {track.manualTags.length > 0 ? (
                              track.manualTags.map(tag => (
                                <EmotionTagBadge key={tag} emotion={tag} />
                              ))
                            ) : (
                              <span className="text-deep-blue-500 text-xs">未标注</span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          <StatusBadge
                            type={track.copyrightStatus === 'removed' ? 'removed' : 'active'}
                            label={track.copyrightStatus === 'removed' ? '已下架' : '正常'}
                          />
                          {track.isRecommended && (
                            <span className="ml-2 text-xs text-neon-purple-400">(推荐中)</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-1">
                            {trackConflicts.length > 0 ? (
                              trackConflicts.map(conflict => (
                                <ConflictTypeBadge
                                  key={conflict.id}
                                  conflictType={conflict.conflictType}
                                  severity={conflict.severity}
                                />
                              ))
                            ) : (
                              <span className="text-emerald-green-400 text-xs">无冲突</span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          <StatusBadge
                            type={hasUnresolvedConflict ? 'conflict' : 'resolved'}
                            label={hasUnresolvedConflict ? '待处理' : '已处理'}
                          />
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setDetailTrackId(track.id);
                                navigate(`/detail/${track.id}`);
                              }}
                              className="p-2 rounded-lg hover:bg-deep-blue-500/50 text-deep-blue-300 hover:text-white transition-colors"
                              title="查看明细"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openResolveDrawer(track)}
                              className="p-2 rounded-lg hover:bg-neon-purple-500/20 text-deep-blue-300 hover:text-neon-purple-400 transition-colors"
                              title="人工标注"
                            >
                              <Tag className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDetailTrackId(track.id);
                                navigate(`/detail/${track.id}`);
                              }}
                              className="p-2 rounded-lg hover:bg-deep-blue-500/50 text-deep-blue-300 hover:text-white transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-deep-blue-400/20">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="人工标注与冲突处理"
      >
        {selectedConflictTrack && (
          <div className="space-y-6">
            <div className="p-4 bg-deep-blue-600/30 rounded-lg">
              <h3 className="font-semibold text-white mb-2">{selectedConflictTrack.title}</h3>
              <p className="text-sm text-deep-blue-400">{selectedConflictTrack.artist} · {selectedConflictTrack.trackId}</p>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={getRadarData(selectedConflictTrack)}>
                  <PolarGrid stroke="#475569" />
                  <PolarAngleAxis dataKey="emotion" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar name="算法标签" dataKey="algorithm" stroke="#9333EA" fill="#9333EA" fillOpacity={0.4} />
                  <Radar name="人工标签" dataKey="manual" stroke="#10B981" fill="#10B981" fillOpacity={0.4} />
                  <Legend wrapperStyle={{ color: '#CBD5E1', fontSize: '12px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-neon-purple-400" />
                人工标注情绪标签
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {emotionTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'p-3 rounded-lg text-sm text-left transition-all duration-150 flex items-center gap-2',
                      selectedTags.includes(tag)
                        ? 'bg-neon-purple-500/20 border border-neon-purple-500/40 text-white'
                        : 'bg-deep-blue-600/30 border border-deep-blue-400/10 text-deep-blue-300 hover:bg-deep-blue-500/30'
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: EMOTION_TAG_COLORS[tag] }}
                    />
                    {EMOTION_TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-deep-blue-300 mb-2">标注说明（补充证据）</label>
              <textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                className="input-field h-24 resize-none"
                placeholder="请输入标注理由，作为复核证据留存..."
              />
            </div>

            <button
              onClick={handleSaveManualTags}
              disabled={selectedTags.length === 0 || loading.addManualTag}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading.addManualTag ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存人工标签
            </button>

            <div className="divider" />

            <div>
              <h4 className="font-medium text-white mb-3">冲突列表</h4>
              <div className="space-y-3">
                {getTrackConflicts(selectedConflictTrack.id).map(conflict => (
                  <div
                    key={conflict.id}
                    className="p-4 bg-deep-blue-600/30 rounded-lg border border-deep-blue-400/10"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <ConflictTypeBadge
                        conflictType={conflict.conflictType}
                        severity={conflict.severity}
                      />
                      <StatusBadge type={conflict.resolved ? 'resolved' : 'conflict'} />
                    </div>
                    <p className="text-sm text-deep-blue-200 mb-2">{conflict.description}</p>

                    {conflict.resolved ? (
                      <div className="text-xs text-deep-blue-400">
                        <p>解决人: {conflict.resolver}</p>
                        <p>时间: {conflict.resolvedAt && new Date(conflict.resolvedAt).toLocaleString()}</p>
                        <p className="mt-1 text-emerald-green-400">备注: {conflict.resolutionNote}</p>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <textarea
                          value={resolveNotes[conflict.id] || ''}
                          onChange={(e) => setResolveNotes(prev => ({ ...prev, [conflict.id]: e.target.value }))}
                          className="input-field h-16 resize-none text-sm mb-2"
                          placeholder="请输入解决说明..."
                        />
                        <button
                          onClick={() => handleResolveConflict(conflict)}
                          disabled={!(resolveNotes[conflict.id] || '').trim() || loading.resolveConflict}
                          className="btn-success text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          标记为已解决
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
