
import React from 'react';
import { HistoryEntry } from '../types';
import { formatTime } from '../utils/colorMath';
import { History, RotateCcw, Undo2, Redo2, Edit3, StickyNote } from 'lucide-react';

interface HistoryTimelineProps {
  history: HistoryEntry[];
  currentIndex: number;
  onRevert: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const actionTypeLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  exposure: { label: '曝光', color: '#00d4ff', icon: <span className="text-sm">☀️</span> },
  temperature: { label: '色温', color: '#ff6b35', icon: <span className="text-sm">🌡️</span> },
  lut: { label: 'LUT', color: '#a855f7', icon: <span className="text-sm">🎨</span> },
  reset: { label: '重置', color: '#6b7280', icon: <span className="text-sm">🔄</span> },
  revert: { label: '回退', color: '#f59e0b', icon: <span className="text-sm">↩️</span> },
  manual_correction: { label: '人工更正', color: '#ec4899', icon: <Edit3 className="w-3.5 h-3.5" /> },
  note: { label: '备注', color: '#22c55e', icon: <StickyNote className="w-3.5 h-3.5" /> },
};

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  history,
  currentIndex,
  onRevert,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span
            className="text-sm font-medium text-gray-200"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            操作历史
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-all ${
              canUndo
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
            title="撤销"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-all ${
              canRedo
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
            title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
        {history.map((entry, index) => {
          const actionInfo = actionTypeLabels[entry.actionType] || {
            label: entry.actionType,
            color: '#6b7280',
            icon: <span className="text-sm">•</span>,
          };
          const isActive = index === currentIndex;

          return (
            <div
              key={entry.id}
              onClick={() => !isActive && onRevert(index)}
              className={`relative flex items-start gap-3 p-2 rounded cursor-pointer transition-all ${
                isActive
                  ? 'bg-cyan-900/30 border border-cyan-500/50'
                  : entry.isManualCorrection
                  ? 'bg-pink-900/20 border border-pink-500/30 hover:bg-pink-900/30'
                  : 'hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${actionInfo.color}22`, color: actionInfo.color }}
              >
                {actionInfo.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium"
                      style={{ color: isActive ? actionInfo.color : '#e5e7eb' }}
                    >
                      {actionInfo.label}
                    </span>
                    {entry.isManualCorrection && (
                      <span className="text-xs px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded">
                        人工
                      </span>
                    )}
                    {entry.note && (
                      <span className="text-xs text-gray-500 truncate max-w-[100px]">
                        ({entry.note})
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                      当前
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 font-mono">
                  {formatTime(entry.timestamp)} · {entry.operator}
                  {entry.modificationSource && (
                    <span className="text-gray-600 ml-2">· {entry.modificationSource}</span>
                  )}
                </div>
                {entry.actionType !== 'note' && (
                  <div className="text-xs text-gray-400 mt-1 truncate font-mono">
                    曝光: {entry.params.exposure.toFixed(2)} | 色温:{' '}
                    {entry.params.temperature}K
                    {entry.params.lutId && entry.params.lutId !== 'none' &&
                      ` | LUT: ${entry.params.lutId}`}
                  </div>
                )}
              </div>

              {!isActive && (
                <button
                  className="flex-shrink-0 p-1 text-gray-500 hover:text-cyan-400 transition-colors"
                  title="回退到此状态"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRevert(index);
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
