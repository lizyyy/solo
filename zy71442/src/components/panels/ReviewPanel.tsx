import { useState } from 'react';
import {
  X,
  History,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Camera,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  GitCompare,
  Edit3,
  Save,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { HistoryEntry, ReviewSession } from '../../types/history';
import type { DataMaterial } from '../../types/surface';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useSurfaceStore } from '../../stores/useSurfaceStore';
import { useViewStore } from '../../stores/useViewStore';

interface ReviewPanelProps {
  onClose: () => void;
  className?: string;
}

export function ReviewPanel({
  onClose,
  className,
}: ReviewPanelProps) {
  const { getCurrentSession, goToEntry, goToPrevious, goToNext } = useHistoryStore();
  const materials = useSurfaceStore((state) => state.materials);
  const { setCameraPosition, setCameraTarget } = useViewStore();
  const session = getCurrentSession();
  const [isPlaying, setIsPlaying] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  if (!session) return null;

  const handleSelectEntry = (entry: HistoryEntry, index: number) => {
    goToEntry(index);
  };

  const handleJumpToEntry = (entry: HistoryEntry) => {
    if (entry.viewState?.cameraPosition && entry.viewState?.cameraTarget) {
      setCameraPosition(entry.viewState.cameraPosition);
      setCameraTarget(entry.viewState.cameraTarget);
    }
  };

  const entries = session.entries;
  const currentIndex = session.currentEntryIndex;
  const currentEntry = entries[currentIndex];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const handleEntryClick = (entry: HistoryEntry, index: number) => {
    if (compareMode) {
      const isSelected = selectedForCompare.includes(entry.id);
      if (isSelected) {
        setSelectedForCompare(selectedForCompare.filter((id) => id !== entry.id));
      } else if (selectedForCompare.length < 2) {
        const newSelected = [...selectedForCompare, entry.id];
        setSelectedForCompare(newSelected);
      }
    } else {
      handleSelectEntry(entry, index);
    }
  };

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrev = () => {
    goToPrevious();
  };

  const handleNext = () => {
    goToNext();
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedForCompare([]);
  };

  const startEditNote = (entry: HistoryEntry) => {
    setEditingNoteId(entry.id);
    setNoteText(entry.note || '');
  };

  const saveNote = (entryId: string) => {
    const { sessions, currentSessionId } = useHistoryStore.getState();
    if (!currentSessionId) return;
    
    const updatedSessions = sessions.map((s) =>
      s.id === currentSessionId
        ? {
            ...s,
            entries: s.entries.map((e) =>
              e.id === entryId ? { ...e, note: noteText } : e
            ),
          }
        : s
    );
    useHistoryStore.setState({ sessions: updatedSessions });
    setEditingNoteId(null);
    setNoteText('');
  };

  const getActionIcon = (action: string) => {
    if (action.includes('fix') || action.includes('修正')) return CheckCircle2;
    if (action.includes('delete') || action.includes('删除')) return Trash2;
    if (action.includes('edit') || action.includes('编辑')) return Edit3;
    if (action.includes('import') || action.includes('导入')) return Save;
    return History;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden',
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-100">复盘模式</h3>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">{session.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCompareMode}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors',
                compareMode
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
              )}
            >
              <GitCompare className="w-3.5 h-3.5" />
              {compareMode ? '对比模式' : '开启对比'}
              {compareMode && selectedForCompare.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/30">
                  {selectedForCompare.length}/2
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r border-slate-700 flex flex-col">
            <div className="p-3 border-b border-slate-700 bg-slate-800/30">
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                历史记录 · {entries.length} 条
              </div>
              <div className="text-[11px] text-slate-500">
                会话创建于 {formatDate(session.createdAt)}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />
                <div className="space-y-1">
                  {entries.map((entry, index) => {
                    const ActionIcon = getActionIcon(entry.action);
                    const isActive = index === currentIndex;
                    const isSelected = selectedForCompare.includes(entry.id);
                    const isEditing = editingNoteId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          'relative pl-8 pb-3 cursor-pointer group',
                          compareMode && 'hover:bg-purple-500/5'
                        )}
                        onClick={() => handleEntryClick(entry, index)}
                      >
                        <div
                          className={cn(
                            'absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 transition-all',
                            isActive
                              ? 'bg-purple-500 border-purple-400 scale-125'
                              : isSelected
                              ? 'bg-purple-500/50 border-purple-400'
                              : 'bg-slate-800 border-slate-600 group-hover:border-slate-500'
                          )}
                        />
                        <div
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            isActive
                              ? 'bg-purple-500/15 border border-purple-500/30'
                              : isSelected
                              ? 'bg-purple-500/10 border border-purple-500/20'
                              : 'hover:bg-slate-800/50'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ActionIcon
                                className={cn(
                                  'w-3.5 h-3.5 flex-shrink-0',
                                  isActive ? 'text-purple-400' : 'text-slate-500'
                                )}
                              />
                              <span
                                className={cn(
                                  'text-xs font-medium truncate',
                                  isActive ? 'text-slate-100' : 'text-slate-300'
                                )}
                              >
                                {entry.action}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                              {formatDate(entry.timestamp)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                            {entry.description}
                          </p>

                          {entry.note && !isEditing && (
                            <div
                              className="mt-2 p-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditNote(entry);
                              }}
                            >
                              {entry.note}
                            </div>
                          )}

                          {isEditing && (
                            <div
                              className="mt-2 space-y-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="添加备注..."
                                className="w-full p-2 text-[11px] bg-slate-800 border border-slate-600 rounded text-slate-300 resize-none focus:outline-none focus:border-purple-500"
                                rows={2}
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => saveNote(entry.id)}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded bg-purple-600 text-white hover:bg-purple-500"
                                >
                                  <Save className="w-3 h-3" />
                                  保存
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setNoteText('');
                                  }}
                                  className="px-2 py-1 text-[10px] rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              {entry.issuesSnapshot.length > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <AlertCircle className="w-3 h-3 text-amber-500" />
                                  {entry.issuesSnapshot.length} 问题
                                </span>
                              )}
                              <span className="flex items-center gap-0.5">
                                <User className="w-3 h-3" />
                                {entry.materialsSnapshot.length} 材料
                              </span>
                            </div>
                            {!isEditing && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditNote(entry);
                                  }}
                                  className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                                  title="添加备注"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJumpToEntry(entry);
                                  }}
                                  className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                                  title="跳转到此状态"
                                >
                                  <Camera className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const { sessions, currentSessionId } = useHistoryStore.getState();
                                    if (!currentSessionId) return;
                                    const updatedSessions = sessions.map((s) =>
                                      s.id === currentSessionId
                                        ? {
                                            ...s,
                                            entries: s.entries.filter((en) => en.id !== entry.id),
                                          }
                                        : s
                                    );
                                    useHistoryStore.setState({ sessions: updatedSessions });
                                  }}
                                  className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                                  title="删除记录"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            {currentEntry && (
              <>
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">
                        {currentEntry.action}
                      </h4>
                      <p className="mt-1 text-xs text-slate-400">
                        {currentEntry.description}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(currentEntry.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowLeftRight className="w-3 h-3" />
                          步骤 {currentIndex + 1}/{entries.length}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJumpToEntry(currentEntry)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      跳转到此视图
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <h5 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-blue-400" />
                        操作参数
                      </h5>
                      <div className="space-y-2">
                        {Object.entries(currentEntry.parameters).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between py-1 border-b border-slate-700/50 last:border-0"
                          >
                            <span className="text-[11px] text-slate-500">{key}</span>
                            <span className="text-[11px] text-slate-300 font-mono max-w-[60%] text-right">
                              {typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <h5 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-cyan-400" />
                        相机状态
                      </h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-[11px] text-slate-500">位置</span>
                          <span className="text-[11px] text-slate-300 font-mono">
                            ({currentEntry.viewState.cameraPosition.x.toFixed(2)},{' '}
                            {currentEntry.viewState.cameraPosition.y.toFixed(2)},{' '}
                            {currentEntry.viewState.cameraPosition.z.toFixed(2)})
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-[11px] text-slate-500">目标</span>
                          <span className="text-[11px] text-slate-300 font-mono">
                            ({currentEntry.viewState.cameraTarget.x.toFixed(2)},{' '}
                            {currentEntry.viewState.cameraTarget.y.toFixed(2)},{' '}
                            {currentEntry.viewState.cameraTarget.z.toFixed(2)})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <h5 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        材料快照
                      </h5>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {currentEntry.materialsSnapshot.map((material) => (
                          <div
                            key={material.id}
                            className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-900/50"
                          >
                            <span className="text-[11px] text-slate-300 truncate">
                              {material.name}
                            </span>
                            <span
                              className={cn(
                                'px-1.5 py-0.5 text-[10px] rounded',
                                material.status === 'raw'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              )}
                            >
                              {material.status === 'raw' ? '原始' : '处理'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <h5 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        问题快照
                      </h5>
                      {currentEntry.issuesSnapshot.length === 0 ? (
                        <div className="text-[11px] text-slate-500 text-center py-4">
                          无检测问题
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {currentEntry.issuesSnapshot.map((issue) => (
                            <div
                              key={issue.id}
                              className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-900/50"
                            >
                              <span className="text-[11px] text-slate-300 truncate">
                                {issue.message}
                              </span>
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 text-[10px] rounded',
                                  issue.severity === 'error'
                                    ? 'bg-red-500/20 text-red-400'
                                    : issue.severity === 'warning'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                )}
                              >
                                {issue.resolved ? '已解决' : '未解决'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {currentEntry.note && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <h5 className="text-xs font-semibold text-amber-300 mb-2">备注</h5>
                      <p className="text-xs text-amber-200/80">{currentEntry.note}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="p-3 border-t border-slate-700 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={4}>4x</option>
                  </select>
                  <span className="text-xs text-slate-500">
                    总时长: {formatDuration(
                      entries.length > 1
                        ? entries[entries.length - 1].timestamp - entries[0].timestamp
                        : 0
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePlay}
                    className="p-2.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === entries.length - 1}
                    className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === entries.length - 1}
                    className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 min-w-[200px]">
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-200"
                      style={{
                        width: `${((currentIndex + 1) / entries.length) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono min-w-[50px] text-right">
                    {currentIndex + 1} / {entries.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
