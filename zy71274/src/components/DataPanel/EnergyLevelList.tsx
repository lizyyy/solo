import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Edit2, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';

export function EnergyLevelList() {
  const {
    energyLevels,
    selectedLevel,
    selectLevel,
    updateEnergyLevel,
    resetToOriginal,
    validationResults
  } = useAppStore();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const hasError = (id: number) => {
    return validationResults.some(r => r.affected_ids.includes(id));
  };

  const handleEdit = (level: typeof energyLevels[0]) => {
    setEditingId(level.id);
    setEditValues({
      energy_eV: level.energy_eV.toString(),
      color: level.color,
      notes: level.notes
    });
  };

  const handleSave = (id: number) => {
    updateEnergyLevel(id, {
      energy_eV: parseFloat(editValues.energy_eV) || 0,
      color: editValues.color,
      notes: editValues.notes
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      {energyLevels.map((level) => (
        <div
          key={level.id}
          className={cn(
            "rounded-lg border transition-all duration-200 overflow-hidden",
            selectedLevel === level.id
              ? "border-cyan-400 bg-cyan-950/30"
              : hasError(level.id)
              ? "border-red-500/50 bg-red-950/20"
              : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
          )}
        >
          <div
            className="p-3 cursor-pointer flex items-center justify-between"
            onClick={() => selectLevel(selectedLevel === level.id ? null : level.id)}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full shadow-lg"
                style={{ backgroundColor: level.color, boxShadow: `0 0 10px ${level.color}` }}
              />
              <div>
                <div className="font-medium text-sm">n = {level.n}</div>
                <div className="text-xs text-slate-400">{level.energy_eV} eV</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasError(level.id) && (
                <span className="text-red-400 text-xs">⚠️ 错误</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedId(expandedId === level.id ? null : level.id);
                }}
                className="p-1 hover:bg-slate-700 rounded"
              >
                {expandedId === level.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {expandedId === level.id && (
            <div className="px-3 pb-3 border-t border-slate-700/50 pt-3">
              {editingId === level.id ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400">能量 (eV)</label>
                    <input
                      type="number"
                      value={editValues.energy_eV}
                      onChange={(e) => setEditValues({ ...editValues, energy_eV: e.target.value })}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">颜色</label>
                    <input
                      type="color"
                      value={editValues.color}
                      onChange={(e) => setEditValues({ ...editValues, color: e.target.value })}
                      className="w-full mt-1 h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">备注</label>
                    <textarea
                      value={editValues.notes}
                      onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSave(level.id); }}
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
                    <span className="text-slate-500">原始值:</span> {level.original_value}
                  </div>
                  <div className="text-sm text-slate-300">{level.notes}</div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(level); }}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                    >
                      <Edit2 size={14} /> 编辑
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); resetToOriginal('energy', level.id); }}
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
