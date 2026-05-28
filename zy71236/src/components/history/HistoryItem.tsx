import { HistoryItem } from '../../types/synth';
import { formatParamChangeDescription } from '../../store/middleware/history';
import { formatTime } from '../../utils/validator';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HistoryItemProps {
  item: HistoryItem;
}

export function HistoryItemComponent({ item }: HistoryItemProps) {
  const description = formatParamChangeDescription(item);
  const timeAgo = Date.now() - item.timestamp;

  const typeColors: Record<string, string> = {
    parameter: 'border-cyan-500/30 bg-cyan-500/5',
    preset_load: 'border-purple-500/30 bg-purple-500/5',
    preset_save: 'border-green-500/30 bg-green-500/5',
    import: 'border-yellow-500/30 bg-yellow-500/5',
    warning: 'border-orange-500/30 bg-orange-500/5',
  };

  const sourceIcons: Record<string, string> = {
    user: '👤',
    import: '📥',
    preset: '💾',
  };

  return (
    <div
      className={`
        p-3 rounded-lg border text-sm mb-2
        ${typeColors[item.type] || typeColors.parameter}
        animate-slide-in
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span>{sourceIcons[item.source]}</span>
            <span className="text-gray-300 font-medium truncate">{description}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{formatTime(timeAgo)} 前</span>
            <span className="text-gray-600">|</span>
            <span className="uppercase text-[10px] tracking-wider">{item.type}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {item.scoreImpact && (
            <div
              className={`
                flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded
                ${item.scoreImpact.delta > 0 ? 'text-green-400 bg-green-500/10' : ''}
                ${item.scoreImpact.delta < 0 ? 'text-red-400 bg-red-500/10' : ''}
                ${item.scoreImpact.delta === 0 ? 'text-gray-500 bg-gray-500/10' : ''}
              `}
            >
              {item.scoreImpact.delta > 0 ? (
                <TrendingUp size={12} />
              ) : item.scoreImpact.delta < 0 ? (
                <TrendingDown size={12} />
              ) : (
                <Minus size={12} />
              )}
              {item.scoreImpact.delta > 0 ? '+' : ''}
              {item.scoreImpact.delta.toFixed(1)}
            </div>
          )}

          {item.warning && (
            <div
              className={`
                flex items-center gap-1 text-xs px-2 py-0.5 rounded
                ${item.warning.severity === 'high' ? 'text-red-400 bg-red-500/10' : ''}
                ${item.warning.severity === 'medium' ? 'text-orange-400 bg-orange-500/10' : ''}
                ${item.warning.severity === 'low' ? 'text-yellow-400 bg-yellow-500/10' : ''}
              `}
            >
              <AlertTriangle size={12} />
              {item.warning.severity.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {item.warning && (
        <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-400">
          ⚠️ {item.warning.message}
          {item.warning.correctedValue !== undefined && (
            <span className="text-cyan-400"> → 已修正为 {item.warning.correctedValue}</span>
          )}
        </div>
      )}
    </div>
  );
}
