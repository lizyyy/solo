import { useState, useMemo } from 'react';
import { GripVertical, Trash2, Edit3, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import type { BeatPoint } from '../../shared/types';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

type SortField = 'time' | 'confidence';
type SortOrder = 'asc' | 'desc';

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor((ms % 1000));
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function getConfidenceColor(confidence: number): string {
  if (confidence > 0.8) return 'bg-cyan-400';
  if (confidence >= 0.6) return 'bg-amber-400';
  return 'bg-orange-500';
}

function getConfidenceTextColor(confidence: number): string {
  if (confidence > 0.8) return 'text-cyan-400';
  if (confidence >= 0.6) return 'text-amber-400';
  return 'text-orange-500';
}

export default function BeatPointPanel() {
  const { beatPoints, updateBeatPoint, removeBeatPoint, isSidebarOpen, setIsSidebarOpen } = useAppStore();
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const sortedBeatPoints = useMemo(() => {
    return [...beatPoints].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'time') {
        comparison = a.timeMs - b.timeMs;
      } else {
        comparison = a.confidence - b.confidence;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [beatPoints, sortField, sortOrder]);

  const stats = useMemo(() => {
    const total = beatPoints.length;
    const avgConfidence = total > 0
      ? beatPoints.reduce((sum, b) => sum + b.confidence, 0) / total
      : 0;
    const manualCount = beatPoints.filter(b => b.isManual).length;
    return { total, avgConfidence, manualCount };
  }, [beatPoints]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleAdjustTime = (id: string, delta: number) => {
    const point = beatPoints.find(b => b.id === id);
    if (point) {
      updateBeatPoint(id, {
        timeMs: Math.max(0, point.timeMs + delta),
        correctedFrom: point.correctedFrom ?? point.timeMs,
      });
    }
  };

  const handleToggleManual = (id: string) => {
    const point = beatPoints.find(b => b.id === id);
    if (point) {
      updateBeatPoint(id, { isManual: !point.isManual });
    }
  };

  const handleDelete = (id: string) => {
    removeBeatPoint(id);
  };

  if (!isSidebarOpen) {
    return (
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-charcoal-700 hover:bg-charcoal-600 text-white p-2 rounded-l-lg shadow-lg transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-charcoal-800 border-l border-charcoal-600 shadow-xl z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-charcoal-600">
        <h2 className="text-lg font-semibold text-white">节拍点列表</h2>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="p-1 hover:bg-charcoal-700 rounded transition-colors text-charcoal-300 hover:text-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-charcoal-600 bg-charcoal-900">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold text-cyan-400">{stats.total}</div>
            <div className="text-xs text-charcoal-400">总节拍数</div>
          </div>
          <div>
            <div className={cn('text-2xl font-bold', getConfidenceTextColor(stats.avgConfidence))}>
              {(stats.avgConfidence * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-charcoal-400">平均置信度</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{stats.manualCount}</div>
            <div className="text-xs text-charcoal-400">手工标记</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-3 border-b border-charcoal-600">
        <button
          onClick={() => handleSort('time')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
            sortField === 'time' ? 'bg-cyan-500 text-white' : 'bg-charcoal-700 text-charcoal-300 hover:bg-charcoal-600'
          )}
        >
          时间
          <ArrowUpDown className="w-3 h-3" />
        </button>
        <button
          onClick={() => handleSort('confidence')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
            sortField === 'confidence' ? 'bg-cyan-500 text-white' : 'bg-charcoal-700 text-charcoal-300 hover:bg-charcoal-600'
          )}
        >
          置信度
          <ArrowUpDown className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedBeatPoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-charcoal-400 p-8">
            <GripVertical className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">暂无节拍点</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-700">
            {sortedBeatPoints.map((point) => (
              <BeatPointRow
                key={point.id}
                point={point}
                onAdjustTime={handleAdjustTime}
                onToggleManual={handleToggleManual}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface BeatPointRowProps {
  point: BeatPoint;
  onAdjustTime: (id: string, delta: number) => void;
  onToggleManual: (id: string) => void;
  onDelete: (id: string) => void;
}

function BeatPointRow({ point, onAdjustTime, onToggleManual, onDelete }: BeatPointRowProps) {
  return (
    <div className="p-3 hover:bg-charcoal-700/50 transition-colors group">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-sm text-white w-24">{formatTime(point.timeMs)}</span>
        <div className="flex-1 h-2 bg-charcoal-600 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', getConfidenceColor(point.confidence))}
            style={{ width: `${point.confidence * 100}%` }}
          />
        </div>
        <span className={cn('text-xs font-medium w-10 text-right', getConfidenceTextColor(point.confidence))}>
          {(point.confidence * 100).toFixed(0)}%
        </span>
        {point.isManual && (
          <Edit3 className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onAdjustTime(point.id, -1)}
          className="px-2 py-1 text-xs bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-300 rounded transition-colors"
          title="减1ms"
        >
          -1ms
        </button>
        <button
          onClick={() => onAdjustTime(point.id, -10)}
          className="px-2 py-1 text-xs bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-300 rounded transition-colors"
          title="减10ms"
        >
          -10ms
        </button>
        <button
          onClick={() => onAdjustTime(point.id, 10)}
          className="px-2 py-1 text-xs bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-300 rounded transition-colors"
          title="加10ms"
        >
          +10ms
        </button>
        <button
          onClick={() => onAdjustTime(point.id, 1)}
          className="px-2 py-1 text-xs bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-300 rounded transition-colors"
          title="加1ms"
        >
          +1ms
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onToggleManual(point.id)}
          className={cn(
            'p-1.5 rounded transition-colors',
            point.isManual
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              : 'text-charcoal-400 hover:text-white hover:bg-charcoal-600'
          )}
          title={point.isManual ? '取消手工标记' : '设为手工标记'}
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(point.id)}
          className="p-1.5 text-charcoal-400 hover:text-red-400 hover:bg-charcoal-600 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
