import { useState } from 'react';
import { Calendar, Play, Pause, SkipBack, SkipForward, GitCompare } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

export function TimelineSlider() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const snapshots = useAppStore((state) => state.snapshots);
  const selectedSnapshotId = useAppStore((state) => state.selectedSnapshotId);
  const compareSnapshotId = useAppStore((state) => state.compareSnapshotId);
  const selectSnapshot = useAppStore((state) => state.selectSnapshot);
  const selectCompareSnapshot = useAppStore((state) => state.selectCompareSnapshot);

  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      let idx = currentIndex < 0 ? 0 : currentIndex;
      const interval = setInterval(() => {
        if (idx >= sortedSnapshots.length) {
          clearInterval(interval);
          setIsPlaying(false);
          setCurrentIndex(-1);
          selectSnapshot(null);
          return;
        }
        setCurrentIndex(idx);
        selectSnapshot(sortedSnapshots[idx].id);
        idx++;
      }, 1000);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(-1);
    selectSnapshot(null);
    selectCompareSnapshot(null);
  };

  const handleSkipBack = () => {
    if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      selectSnapshot(sortedSnapshots[newIdx].id);
    }
  };

  const handleSkipForward = () => {
    if (currentIndex < sortedSnapshots.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      selectSnapshot(sortedSnapshots[newIdx].id);
    }
  };

  const handleSnapshotClick = (index: number, id: string) => {
    if (compareSnapshotId && selectedSnapshotId !== id) {
      selectCompareSnapshot(null);
    }
    setCurrentIndex(index);
    selectSnapshot(selectedSnapshotId === id ? null : id);
  };

  const handleCompareClick = (e: React.MouseEvent, index: number, id: string) => {
    e.stopPropagation();
    if (selectedSnapshotId === id) return;
    selectCompareSnapshot(compareSnapshotId === id ? null : id);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-xl border-t border-slate-700/50 p-4 z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-slate-300 font-medium">历史快照</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="重置到当前"
          >
            <SkipBack className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={handleSkipBack}
            disabled={currentIndex <= 0}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-30"
            title="上一帧"
          >
            <SkipBack className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={handlePlay}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-cyan-400" />
            ) : (
              <Play className="w-4 h-4 text-cyan-400" />
            )}
          </button>
          <button
            onClick={handleSkipForward}
            disabled={currentIndex >= sortedSnapshots.length - 1}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-30"
            title="下一帧"
          >
            <SkipForward className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 relative h-16 flex items-center">
          <div className="absolute left-0 right-0 h-0.5 bg-slate-700 top-1/2 -translate-y-1/2">
            <div
              className="absolute left-0 h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{
                width: currentIndex < 0
                  ? '0%'
                  : `${((currentIndex + 1) / sortedSnapshots.length) * 100}%`,
              }}
            />
          </div>

          <div className="absolute left-0 right-0 flex justify-between px-2">
            <div
              key="current"
              onClick={() => handleSnapshotClick(-1, '')}
              className={cn(
                'relative cursor-pointer group',
                currentIndex < 0 && !selectedSnapshotId && 'z-10'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full border-2 transition-all -translate-x-1/2',
                  currentIndex < 0 && !selectedSnapshotId
                    ? 'bg-cyan-400 border-cyan-300 scale-125'
                    : 'bg-slate-600 border-slate-500 group-hover:border-cyan-400'
                )}
              />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <div className="text-[10px] text-cyan-400 font-medium">当前</div>
                <div className="text-[10px] text-slate-500">最新数据</div>
              </div>
            </div>

            {sortedSnapshots.map((snapshot, idx) => (
              <div
                key={snapshot.id}
                onClick={() => handleSnapshotClick(idx, snapshot.id)}
                className={cn(
                  'relative cursor-pointer group',
                  selectedSnapshotId === snapshot.id && 'z-10'
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 transition-all -translate-x-1/2',
                    selectedSnapshotId === snapshot.id
                      ? 'bg-cyan-400 border-cyan-300 scale-125'
                      : compareSnapshotId === snapshot.id
                      ? 'bg-purple-500 border-purple-400 scale-110'
                      : 'bg-slate-600 border-slate-500 group-hover:border-cyan-400'
                  )}
                />
                <button
                  onClick={(e) => handleCompareClick(e, idx, snapshot.id)}
                  className={cn(
                    'absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center',
                    compareSnapshotId === snapshot.id
                      ? 'bg-purple-500 opacity-100'
                      : 'bg-slate-600 hover:bg-purple-500'
                  )}
                  title="对比"
                >
                  <GitCompare className="w-2 h-2 text-white" />
                </button>
                <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <div
                    className={cn(
                      'text-[10px] font-medium',
                      selectedSnapshotId === snapshot.id
                        ? 'text-cyan-400'
                        : compareSnapshotId === snapshot.id
                        ? 'text-purple-400'
                        : 'text-slate-400'
                    )}
                  >
                    {formatDate(snapshot.createdAt)}
                  </div>
                  <div className="text-[10px] text-slate-500">{snapshot.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {(selectedSnapshotId || compareSnapshotId) && (
          <div className="flex flex-col items-end gap-1 text-right">
            {selectedSnapshotId && selectedSnapshotId !== '' && (
              <div className="text-xs">
                <span className="text-cyan-400">主视图:</span>{' '}
                <span className="text-slate-300">
                  {formatFullDate(snapshots.find((s) => s.id === selectedSnapshotId)?.createdAt || '')}
                </span>
              </div>
            )}
            {compareSnapshotId && (
              <div className="text-xs">
                <span className="text-purple-400">对比:</span>{' '}
                <span className="text-slate-300">
                  {formatFullDate(snapshots.find((s) => s.id === compareSnapshotId)?.createdAt || '')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
