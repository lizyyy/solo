import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, FileText } from 'lucide-react';
import type { PathNode } from '../../types';

interface TimelineProps {
  nodes: PathNode[];
  playbackIndex: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (index: number) => void;
  onReset: () => void;
  onShowReport: () => void;
  canShowReport: boolean;
}

export function Timeline({
  nodes,
  playbackIndex,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onReset,
  onShowReport,
  canShowReport,
}: TimelineProps) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && nodes.length > 1) {
      intervalRef.current = window.setInterval(() => {
        if (playbackIndex < nodes.length - 1) {
          onSeek(playbackIndex + 1);
        } else {
          onPause();
        }
      }, 800);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackIndex, nodes.length, onSeek, onPause]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    onSeek(index);
  };

  const nodeTypeColors: Record<string, string> = {
    start: 'bg-green-500',
    corner: 'bg-blue-500',
    stairs: 'bg-purple-500',
    end: 'bg-red-500',
  };

  return (
    <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all"
            title="重置"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={nodes.length < 2}
            className="p-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white transition-all"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => onSeek(nodes.length - 1)}
            disabled={nodes.length < 2}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
            title="跳到末尾"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <span className="text-slate-300 text-sm ml-2">
            步骤 {playbackIndex + 1} / {Math.max(nodes.length, 1)}
          </span>
        </div>

        <button
          onClick={onShowReport}
          disabled={!canShowReport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white transition-all"
        >
          <FileText className="w-4 h-4" />
          查看报告
        </button>
      </div>

      <div className="relative">
        <input
          type="range"
          min="0"
          max={Math.max(nodes.length - 1, 0)}
          value={playbackIndex}
          onChange={handleSliderChange}
          disabled={nodes.length < 2}
          className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(playbackIndex / Math.max(nodes.length - 1, 1)) * 100}%, #334155 ${(playbackIndex / Math.max(nodes.length - 1, 1)) * 100}%, #334155 100%)`,
          }}
        />

        {nodes.length > 0 && (
          <div className="flex justify-between mt-2 px-1">
            {nodes.map((node, i) => (
              <div
                key={node.id}
                className={`w-3 h-3 rounded-full ${nodeTypeColors[node.type]} ${
                  i <= playbackIndex ? 'opacity-100' : 'opacity-40'
                }`}
                title={`${node.type} - 节点 ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>起点</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>转角</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span>楼梯</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>终点</span>
        </div>
      </div>
    </div>
  );
}
