import { useState } from 'react';
import { Check, Clock, Trash2, AlertTriangle, Edit2, Play, Pause } from 'lucide-react';
import { Segment } from '../types';
import { useAppStore } from '../store';
import { formatTime } from '../utils/messages';

interface SegmentListProps {
  filter?: 'all' | 'confirmed' | 'pending' | 'discarded';
  onPlaySegment?: (segment: Segment) => void;
  playingId?: string | null;
}

const statusConfig = {
  confirmed: { label: '已确认', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Check },
  pending: { label: '待确认', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  discarded: { label: '已废弃', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: Trash2 }
};

const anomalyConfig = {
  drift: { label: '时间间隔异常', color: 'text-orange-600' },
  silence: { label: '长静音', color: 'text-orange-600' },
  overlap: { label: '时间重叠', color: 'text-red-600' },
  missing: { label: '可能漏标', color: 'text-orange-600' },
  normal: { label: '', color: '' }
};

export function SegmentList({ filter = 'all', onPlaySegment, playingId }: SegmentListProps) {
  const { segments, confirmSegment, markSegmentPending, discardSegment, updateSegment, addMessage } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const filteredSegments = segments.filter(s => {
    if (filter === 'all') return s.status !== 'discarded';
    return s.status === filter;
  });

  const handleStartEdit = (segment: Segment) => {
    setEditingId(segment.id);
    setEditText(segment.text);
  };

  const handleSaveEdit = async (id: string) => {
    await updateSegment(id, { text: editText });
    setEditingId(null);
    addMessage({
      type: 'success',
      title: '已保存',
      message: '字幕内容已更新'
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            分段列表 <span className="text-slate-400">({filteredSegments.length})</span>
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              已确认 {segments.filter(s => s.status === 'confirmed').length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              待确认 {segments.filter(s => s.status === 'pending').length}
            </span>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {filteredSegments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            还没有分段，先导入音频文件吧
          </div>
        ) : (
          filteredSegments.map((segment, idx) => {
            const StatusIcon = statusConfig[segment.status].icon;
            const anomaly = anomalyConfig[segment.anomalyType];
            const isPlaying = playingId === segment.id;

            return (
              <div
                key={segment.id}
                className={`group px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  segment.status === 'discarded' ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <span className="text-xs font-mono text-slate-400 w-6 text-center">
                      {idx + 1}
                    </span>
                    {segment.anomalyType !== 'normal' && (
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-1" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {onPlaySegment && (
                        <button
                          onClick={() => onPlaySegment(segment)}
                          className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-700"
                        >
                          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                      )}
                      <span className="text-xs font-mono text-slate-500">
                        {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${statusConfig[segment.status].color}`}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig[segment.status].label}
                      </span>
                      {segment.anomalyType !== 'normal' && (
                        <span className={`text-xs ${anomaly.color}`}>
                          ⚠️ {anomaly.label}
                        </span>
                      )}
                    </div>

                    {editingId === segment.id ? (
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => handleSaveEdit(segment.id)}
                        onKeyDown={(e) => handleKeyDown(e, segment.id)}
                        autoFocus
                        className="w-full px-2 py-1 text-sm border border-sky-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    ) : (
                      <p className="text-sm text-slate-700 flex items-center gap-2">
                        <span className="flex-1">{segment.text || '(无字幕)'}</span>
                        <button
                          onClick={() => handleStartEdit(segment)}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition-all"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                        </button>
                      </p>
                    )}

                    {segment.anomalyNote && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {segment.anomalyNote}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {segment.status !== 'confirmed' && (
                      <button
                        onClick={() => confirmSegment(segment.id)}
                        className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600 transition-colors"
                        title="确认"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {segment.status !== 'pending' && (
                      <button
                        onClick={() => markSegmentPending(segment.id)}
                        className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors"
                        title="标记待确认"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    )}
                    {segment.status !== 'discarded' && (
                      <button
                        onClick={() => discardSegment(segment.id)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                        title="废弃"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
