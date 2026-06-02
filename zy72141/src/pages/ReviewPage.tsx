import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Link2, Unlink, ArrowRight, Music, FileCheck, MessageSquare, 
  AlertTriangle, Plus, StickyNote, RefreshCw 
} from 'lucide-react';
import { WeekSelector } from '@/components/common/WeekSelector';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConflictCard } from '@/components/common/ConflictCard';
import { AnnotationItem } from '@/components/common/AnnotationItem';
import { NoteItem } from '@/components/common/NoteItem';
import { AddNoteModal } from '@/components/common/AddNoteModal';
import { useAppStore } from '@/store/useAppStore';
import { useTrackMatcher } from '@/hooks/useTrackMatcher';
import { formatDuration } from '@/utils/stringUtils';
import { Track, FileItem } from '@/types';

export default function ReviewPage() {
  const navigate = useNavigate();
  const { getCurrentWeekData, currentRecordId } = useAppStore();
  const { autoMatch, manualMatch } = useTrackMatcher();
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [isSupplement, setIsSupplement] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'conflicts' | 'annotations' | 'notes'>('tracks');

  const data = getCurrentWeekData();
  const { record, files, tracks, annotations, conflicts, notes } = data;

  const audioFiles = files.filter(f => f.type === 'audio' && f.status !== 'error');
  const unmatchedTracks = tracks.filter(t => !t.fileId);
  const unresolvedConflicts = conflicts.filter(c => c.resolution === 'unresolved');
  const supplements = notes.filter(n => n.isSupplement);

  const openAddNote = (track?: Track, supplement = false) => {
    setSelectedTrack(track || null);
    setIsSupplement(supplement);
    setAddNoteOpen(true);
  };

  const getTrackFile = (track: Track): FileItem | undefined => {
    return files.find(f => f.id === track.fileId);
  };

  const handleManualMatch = (trackId: string, fileId: string | null) => {
    manualMatch(trackId, fileId);
  };

  const tabs = [
    { id: 'tracks', label: '曲目关联', icon: Link2, count: tracks.length },
    { id: 'conflicts', label: '冲突处理', icon: AlertTriangle, count: unresolvedConflicts.length, danger: unresolvedConflicts.length > 0 },
    { id: 'annotations', label: '批注', icon: MessageSquare, count: annotations.length },
    { id: 'notes', label: '备注', icon: StickyNote, count: notes.length },
  ];

  if (!currentRecordId || !record) {
    return (
      <div>
        <WeekSelector />
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
            <FileCheck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-serif text-lg font-bold text-studio-text mb-2">
            先选一个周次吧
          </h3>
          <p className="text-sm text-studio-textMuted">
            或者先去导入页上传材料
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary mt-4"
          >
            去导入材料
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <WeekSelector />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="曲目总数"
          value={tracks.length}
          icon={Music}
          color="default"
          className="stagger-1"
        />
        <StatCard
          title="已关联"
          value={tracks.filter(t => t.fileId).length}
          icon={Link2}
          color="success"
          className="stagger-2"
        />
        <StatCard
          title="待关联"
          value={unmatchedTracks.length}
          icon={Unlink}
          color="warning"
          className="stagger-3"
        />
        <StatCard
          title="待处理冲突"
          value={unresolvedConflicts.length}
          icon={AlertTriangle}
          color={unresolvedConflicts.length > 0 ? 'danger' : 'success'}
          className="stagger-4"
        />
      </div>

      {tracks.length === 0 && files.filter(f => f.type === 'tracklist').length > 0 && (
        <div className="card mb-6 bg-studio-amber/5 border border-studio-amber/30 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-studio-amber/20 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-studio-amber" />
              </div>
              <div>
                <p className="font-medium text-studio-text">
                  检测到曲目表和音频文件
                </p>
                <p className="text-sm text-studio-textMuted">
                  点击下方按钮自动关联曲目和音频
                </p>
              </div>
            </div>
            <button
              onClick={() => autoMatch()}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              自动匹配
            </button>
          </div>
        </div>
      )}

      <div className="card mb-6 p-0 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'text-studio-amber border-b-2 border-studio-amber font-medium'
                    : 'text-studio-textMuted hover:text-studio-text hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span className={`
                  px-1.5 py-0.5 rounded-full text-xs font-mono
                  ${tab.danger ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}
                `}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4 max-h-[600px] overflow-y-auto scrollbar-thin">
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              {tracks.length === 0 ? (
                <div className="text-center py-8 text-studio-textMuted">
                  还没有曲目数据，请先导入曲目表
                </div>
              ) : (
                tracks.map((track, index) => {
                  const trackFile = getTrackFile(track);
                  return (
                    <div 
                      key={track.id} 
                      className={`
                        card hover:shadow-md transition-all duration-200
                        stagger-${Math.min(index % 6 + 1, 6)}
                        ${!track.fileId ? 'border border-studio-warning/30' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-6 rounded bg-studio-amber/10 text-studio-amber text-xs font-mono font-bold flex items-center justify-center">
                              {track.trackNo}
                            </span>
                            <h4 className="font-medium text-studio-text">
                              {track.name}
                            </h4>
                            {track.composer && (
                              <span className="text-xs text-studio-textMuted">
                                · {track.composer}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-studio-textMuted mt-1">
                            {track.expectedDuration && (
                              <span className="font-mono">
                                标注时长：{formatDuration(track.expectedDuration)}
                              </span>
                            )}
                            {track.duration && (
                              <span className={`font-mono ${
                                track.expectedDuration && Math.abs(track.duration - track.expectedDuration) > 10
                                  ? 'text-studio-warning'
                                  : ''
                              }`}>
                                实际时长：{formatDuration(track.duration)}
                              </span>
                            )}
                            <StatusBadge status={track.status} size="sm" />
                          </div>

                          {trackFile && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <span className="text-studio-textMuted">关联文件：</span>
                              <span className="text-studio-text font-medium ml-1">
                                {trackFile.name}
                              </span>
                              {trackFile.duration && (
                                <span className="text-studio-textMuted ml-2 font-mono">
                                  {formatDuration(trackFile.duration)}
                                </span>
                              )}
                            </div>
                          )}

                          {track.rawData?.matchType && (
                            <div className="mt-2 text-xs text-studio-textMuted">
                              匹配方式：{track.rawData.matchType}
                              {track.rawData.matchScore && (
                                <span className="ml-2">
                                  （置信度 {Math.round(track.rawData.matchScore * 100)}%）
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          <select
                            value={track.fileId || ''}
                            onChange={(e) => handleManualMatch(track.id, e.target.value || null)}
                            className="input-field text-xs min-w-[180px]"
                          >
                            <option value="">-- 选择音频文件 --</option>
                            {audioFiles.map(file => (
                              <option 
                                key={file.id} 
                                value={file.id}
                                disabled={tracks.some(t => t.fileId === file.id && t.id !== track.id)}
                              >
                                {file.name}
                                {file.duration && ` (${formatDuration(file.duration)})`}
                                {tracks.some(t => t.fileId === file.id && t.id !== track.id) && ' (已关联)'}
                              </option>
                            ))}
                          </select>

                          <div className="flex gap-1">
                            <button
                              onClick={() => openAddNote(track, false)}
                              className="btn-ghost text-xs flex items-center gap-1 flex-1"
                              title="添加备注"
                            >
                              <Plus className="w-3 h-3" />
                              备注
                            </button>
                            <button
                              onClick={() => openAddNote(track, true)}
                              className="btn-ghost text-xs flex items-center gap-1 flex-1 text-studio-amber"
                              title="补录备注"
                            >
                              <StickyNote className="w-3 h-3" />
                              补录
                            </button>
                          </div>
                        </div>
                      </div>

                      {notes.filter(n => n.trackId === track.id).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="space-y-2">
                            {notes
                              .filter(n => n.trackId === track.id)
                              .map(note => (
                                <NoteItem key={note.id} note={note} />
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'conflicts' && (
            <div className="space-y-4">
              {conflicts.length === 0 ? (
                <div className="text-center py-8 text-studio-textMuted">
                  暂无冲突，一切正常 🎉
                </div>
              ) : (
                conflicts.map((conflict, index) => {
                  const track = tracks.find(t => t.id === conflict.trackId);
                  return (
                    <div key={conflict.id} className={`stagger-${Math.min(index % 6 + 1, 6)}`}>
                      <ConflictCard 
                        conflict={conflict} 
                        trackName={track?.name}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'annotations' && (
            <div className="space-y-3">
              {annotations.length === 0 ? (
                <div className="text-center py-8 text-studio-textMuted">
                  暂无批注
                </div>
              ) : (
                annotations.map((annotation, index) => {
                  const track = tracks.find(t => t.id === annotation.trackId);
                  return (
                    <div key={annotation.id} className={`stagger-${Math.min(index % 6 + 1, 6)}`}>
                      <AnnotationItem 
                        annotation={annotation}
                        trackName={track?.name}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-studio-textMuted">
                  共 {notes.length} 条备注
                  {supplements.length > 0 && (
                    <span className="ml-2 text-studio-amber">
                      · 含 {supplements.length} 条补录
                    </span>
                  )}
                </span>
                <button
                  onClick={() => openAddNote(undefined, false)}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  添加备注
                </button>
              </div>
              
              {notes.length === 0 ? (
                <div className="text-center py-8 text-studio-textMuted">
                  暂无备注
                </div>
              ) : (
                notes.map((note, index) => {
                  const track = tracks.find(t => t.id === note.trackId);
                  return (
                    <div key={note.id} className={`stagger-${Math.min(index % 6 + 1, 6)}`}>
                      <NoteItem 
                        note={note}
                        trackName={track?.name}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/')}
          className="btn-ghost"
        >
          ← 返回导入
        </button>
        
        <button
          onClick={() => navigate('/report')}
          className="btn-primary flex items-center gap-2"
          disabled={tracks.length === 0}
        >
          生成周报
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <AddNoteModal
        isOpen={addNoteOpen}
        onClose={() => setAddNoteOpen(false)}
        track={selectedTrack}
        isSupplement={isSupplement}
      />
    </div>
  );
}
