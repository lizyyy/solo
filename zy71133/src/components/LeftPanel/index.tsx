import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Trash2, Eye, Calendar, Package, GitCompare, X, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatVolume } from '@/utils/volume';

export function LeftPanel() {
  const {
    batches,
    activeBatchId,
    loadBatch,
    deleteBatch,
    compareBatchIds,
    toggleCompareBatch,
    clearCompareBatches,
  } = useStore();

  const [timelineIndex, setTimelineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const sortedBatches = [...batches].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const handleTimelineChange = (index: number) => {
    setTimelineIndex(index);
    if (sortedBatches[index]) {
      loadBatch(sortedBatches[index].id);
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      let currentIndex = timelineIndex;
      const interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % sortedBatches.length;
        setTimelineIndex(currentIndex);
        if (sortedBatches[currentIndex]) {
          loadBatch(sortedBatches[currentIndex].id);
        }
        if (currentIndex === sortedBatches.length - 1) {
          clearInterval(interval);
          setIsPlaying(false);
        }
      }, 1500);
    }
  };

  return (
    <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          盘点批次
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          共 {batches.length} 个批次
        </p>
      </div>

      {sortedBatches.length > 1 && (
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-300 font-medium">时间轴回放</span>
            <button
              onClick={togglePlayback}
              disabled={sortedBatches.length < 2}
              className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, sortedBatches.length - 1)}
            value={timelineIndex}
            onChange={(e) => handleTimelineChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>{sortedBatches[0]?.name || '开始'}</span>
            <span>{sortedBatches[sortedBatches.length - 1]?.name || '结束'}</span>
          </div>
        </div>
      )}

      {compareBatchIds.length > 0 && (
        <div className="p-3 border-b border-slate-700 bg-amber-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-amber-300 font-medium flex items-center gap-1">
              <GitCompare className="w-4 h-4" />
              对比模式 ({compareBatchIds.length})
            </span>
            <button
              onClick={clearCompareBatches}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {compareBatchIds.map(id => {
              const batch = sortedBatches.find(b => b.id === id);
              const totalVolume = batch?.boundaries.reduce((sum, b) => sum + (b.volume || 0), 0) || 0;
              return (
                <div
                  key={id}
                  className="px-2 py-1 bg-amber-800/50 text-amber-200 text-xs rounded flex items-center gap-1"
                >
                  {batch?.name}: {formatVolume(totalVolume)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedBatches.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无盘点批次</p>
            <p className="text-xs mt-1">点击"保存批次"创建</p>
          </div>
        ) : (
          sortedBatches.map((batch, index) => {
            const totalVolume = batch.boundaries.reduce((sum, b) => sum + (b.volume || 0), 0);
            const isComparing = compareBatchIds.includes(batch.id);
            return (
              <div
                key={batch.id}
                className={cn(
                  'p-3 rounded-lg cursor-pointer transition-all border',
                  activeBatchId === batch.id
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : isComparing
                    ? 'bg-amber-600/20 border-amber-500 text-slate-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex-1"
                    onClick={() => loadBatch(batch.id)}
                  >
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-slate-600 rounded text-xs">
                        {index + 1}
                      </span>
                      <Eye className="w-4 h-4" />
                      {batch.name}
                    </div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(batch.timestamp).toLocaleString('zh-CN')}
                    </div>
                    <div className="text-xs mt-1 opacity-70 flex gap-3">
                      <span>{batch.boundaries.length} 个料堆</span>
                      <span>{formatVolume(totalVolume)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCompareBatch(batch.id);
                      }}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        isComparing
                          ? 'bg-amber-600 text-white'
                          : 'hover:bg-slate-600 text-slate-400 hover:text-white'
                      )}
                      title="加入对比"
                    >
                      <GitCompare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('确定删除此批次吗？')) {
                          deleteBatch(batch.id);
                        }
                      }}
                      className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="text-xs text-slate-500 text-center">
          批次数据保存在本地浏览器中
        </div>
      </div>
    </div>
  );
}
