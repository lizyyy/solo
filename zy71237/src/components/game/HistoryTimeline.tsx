import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { HistoryEntry } from '../../types';
import { RiskBadge } from '../common/RiskBadge';

const categoryColors: Record<string, string> = {
  cleaning: '#CD7F32',
  retouching: '#4A7C59',
  reinforcing: '#D4AF37',
};

const categoryNames: Record<string, string> = {
  cleaning: '清洁',
  retouching: '补色',
  reinforcing: '加固',
  detect: '检测',
};

export function HistoryTimeline() {
  const { history } = useGameStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-serif font-bold text-museum-paper mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-museum-bronze rounded-full" />
          操作历史
        </h3>
        <div className="text-center py-8 text-museum-paper/50">
          <Clock size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无操作记录</p>
          <p className="text-xs mt-1">选择修复操作开始工作</p>
        </div>
      </div>
    );
  }

  const formatDelta = (before: number, after: number) => {
    const delta = after - before;
    if (delta === 0) return null;
    if (delta > 0) {
      return <span className="text-museum-patina">+{delta}</span>;
    }
    return <span className="text-museum-cinnabar">{delta}</span>;
  };

  return (
    <div className="card">
      <h3 className="text-lg font-serif font-bold text-museum-paper mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-museum-bronze rounded-full" />
        操作历史
        <span className="ml-auto px-2 py-0.5 bg-museum-bronze/20 text-museum-bronzeLight text-xs rounded-full">
          {history.length} 条记录
        </span>
      </h3>

      <div className="relative max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
        <div className="timeline-line" />

        <div className="space-y-4 pb-4">
          {history.map((entry, index) => (
            <HistoryItem
              key={entry.id}
              entry={entry}
              index={index}
              isExpanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              formatDelta={formatDelta}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface HistoryItemProps {
  entry: HistoryEntry;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  formatDelta: (before: number, after: number) => React.ReactNode;
}

function HistoryItem({ entry, index, isExpanded, onToggle, formatDelta }: HistoryItemProps) {
  const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const color = categoryColors[entry.actionType] || '#CD7F32';
  const hasIssues = entry.consequences.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pl-10"
    >
      <div
        className="timeline-dot"
        style={{
          top: '12px',
          backgroundColor: hasIssues ? '#8B0000' : color,
          borderColor: '#2C1810',
        }}
      />

      <div
        className={`p-3 rounded-lg border transition-all cursor-pointer ${
          hasIssues
            ? 'border-red-500/30 bg-red-900/10 hover:bg-red-900/20'
            : 'border-museum-bronze/30 hover:bg-museum-bronze/10'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${color}30`, color }}
              >
                {categoryNames[entry.actionType] || entry.actionType}
              </span>
              <RiskBadge level={entry.riskLevel as any} showLabel={false} />
              {hasIssues && (
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
              )}
            </div>
            <div className="font-medium text-museum-paper text-sm">
              #{index + 1} {entry.actionName}
            </div>
            <div className="text-xs text-museum-paper/50 mt-1">{time}</div>
          </div>
          {isExpanded ? (
            <ChevronUp size={16} className="text-museum-paper/50 flex-shrink-0" />
          ) : (
            <ChevronDown size={16} className="text-museum-paper/50 flex-shrink-0" />
          )}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-museum-bronze/20 space-y-3">
                <p className="text-sm text-museum-paper/80">{entry.feedback}</p>

                {entry.consequences.length > 0 && (
                  <div className="space-y-1">
                    {entry.consequences.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 p-2 rounded"
                      >
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-museum-bg/50 p-2 rounded text-center">
                    <div className="text-museum-paper/50 mb-1">污渍</div>
                    <div className="flex items-center justify-center gap-1">
                      <span>{entry.stateBefore.stain}%</span>
                      <span>→</span>
                      <span>{entry.stateAfter.stain}%</span>
                      {formatDelta(entry.stateBefore.stain, entry.stateAfter.stain)}
                    </div>
                  </div>
                  <div className="bg-museum-bg/50 p-2 rounded text-center">
                    <div className="text-museum-paper/50 mb-1">颜料</div>
                    <div className="flex items-center justify-center gap-1">
                      <span>{entry.stateBefore.paintLayer}%</span>
                      <span>→</span>
                      <span>{entry.stateAfter.paintLayer}%</span>
                      {formatDelta(entry.stateBefore.paintLayer, entry.stateAfter.paintLayer)}
                    </div>
                  </div>
                  <div className="bg-museum-bg/50 p-2 rounded text-center">
                    <div className="text-museum-paper/50 mb-1">结构</div>
                    <div className="flex items-center justify-center gap-1">
                      <span>{entry.stateBefore.structure}%</span>
                      <span>→</span>
                      <span>{entry.stateAfter.structure}%</span>
                      {formatDelta(entry.stateBefore.structure, entry.stateAfter.structure)}
                    </div>
                  </div>
                </div>

                {entry.materialsUsed.length > 0 && (
                  <div>
                    <div className="text-xs text-museum-paper/50 mb-1">使用材料</div>
                    <div className="flex flex-wrap gap-1">
                      {entry.materialsUsed.map((m, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-museum-bronze/20 text-museum-bronzeLight text-xs rounded"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
