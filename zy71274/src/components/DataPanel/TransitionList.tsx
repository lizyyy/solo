import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Edit2, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';

export function TransitionList() {
  const {
    transitions,
    energyLevels,
    activeTransition,
    setActiveTransition,
    updateTransition,
    resetToOriginal,
    validationResults
  } = useAppStore();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editProbability, setEditProbability] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const hasError = (id: number) => {
    return validationResults.some(r => r.type === 'probability' && r.affected_ids.includes(id));
  };

  const getLevelN = (id: number) => {
    return energyLevels.find(l => l.id === id)?.n || '?';
  };

  const handleEdit = (t: typeof transitions[0]) => {
    setEditingId(t.id);
    setEditProbability(t.probability.toString());
  };

  const handleSave = (id: number) => {
    updateTransition(id, { probability: parseFloat(editProbability) || 0 });
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      {transitions.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border transition-all duration-200 overflow-hidden",
            activeTransition === t.id
              ? "border-green-400 bg-green-950/30"
              : hasError(t.id)
              ? "border-red-500/50 bg-red-950/20"
              : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
          )}
        >
          <div
            className="p-3 cursor-pointer flex items-center justify-between"
            onClick={() => setActiveTransition(activeTransition === t.id ? null : t.id)}
          >
            <div className="flex items-center gap-3">
              <div className="text-lg">
                n={getLevelN(t.from_level)} → n={getLevelN(t.to_level)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-mono",
                hasError(t.id) ? "text-red-400" : "text-slate-300"
              )}>
                P={t.probability.toFixed(2)}
              </span>
              {hasError(t.id) && (
                <span className="text-red-400 text-xs">⚠️</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedId(expandedId === t.id ? null : t.id);
                }}
                className="p-1 hover:bg-slate-700 rounded"
              >
                {expandedId === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {expandedId === t.id && (
            <div className="px-3 pb-3 border-t border-slate-700/50 pt-3">
              {editingId === t.id ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400">跃迁概率 (0-1)</label>
                    <input
                      type="number"
                      value={editProbability}
                      onChange={(e) => setEditProbability(e.target.value)}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                      step="0.01"
                      min="0"
                      max="1"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSave(t.id); }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm"
                    >
                      <Check size={14} /> 保存
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">
                    <div>选择定则: {t.selection_rule}</div>
                    <div>原始值: {t.original_value}</div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(t); }}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                    >
                      <Edit2 size={14} /> 编辑
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); resetToOriginal('transition', t.id); }}
                      className="flex items-center gap-1 px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-sm"
                    >
                      <RotateCcw size={14} /> 恢复
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
