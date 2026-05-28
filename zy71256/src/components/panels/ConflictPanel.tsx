import { useState, useMemo } from 'react';
import { AlertTriangle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChipStore } from '@/store/chipStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { Conflict } from '@/data/types';

const CONFLICT_GROUPS: { type: Conflict['type']; label: string; accent: string }[] = [
  { type: 'voltage_mixed', label: '电压域混接', accent: '#ef4444' },
  { type: 'pin_mux', label: '引脚复用冲突', accent: '#f97316' },
  { type: 'label_occlusion', label: '标签遮挡', accent: '#eab308' },
];

export default function ConflictPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const conflicts = useChipStore((s) => s.conflicts);
  const pins = useChipStore((s) => s.pins);
  const focusedConflictId = useSelectionStore((s) => s.focusedConflictId);
  const focusConflict = useSelectionStore((s) => s.focusConflict);
  const selectPin = useSelectionStore((s) => s.selectPin);

  const grouped = useMemo(() => {
    const map: Record<string, Conflict[]> = {};
    for (const g of CONFLICT_GROUPS) {
      map[g.type] = conflicts.filter((c) => c.type === g.type);
    }
    return map;
  }, [conflicts]);

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  const pinNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of pins) m[p.id] = p.name;
    return m;
  }, [pins]);

  const handleConflictClick = (conflict: Conflict) => {
    focusConflict(conflict.id);
    if (conflict.pinIds.length > 0) {
      selectPin(conflict.pinIds[0]);
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full bg-black/60 backdrop-blur-md border-l border-white/5 overflow-y-auto z-30 transition-all duration-300 ${
        collapsed ? 'w-10' : 'w-72'
      }`}
      style={{ background: '#0a0e17cc' }}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white tracking-wide">
              冲突检测
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5 text-xs">
            <span className="text-white/70">
              共 <span className="text-white font-mono">{conflicts.length}</span> 项
            </span>
            <span className="text-red-400 font-mono">{errorCount} error</span>
            <span className="text-amber-400 font-mono">{warningCount} warn</span>
          </div>

          <div className="p-2 space-y-3">
            {CONFLICT_GROUPS.map((group) => {
              const items = grouped[group.type] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={group.type}>
                  <div
                    className="flex items-center gap-2 px-2 py-1 text-xs font-medium"
                    style={{ color: group.accent }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: group.accent }}
                    />
                    {group.label}
                    <span className="text-white/30 ml-auto font-mono">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {items.map((conflict) => {
                      const isFocused = focusedConflictId === conflict.id;
                      const borderColor =
                        conflict.severity === 'error' ? '#ef4444' : '#f97316';
                      return (
                        <div
                          key={conflict.id}
                          onClick={() => handleConflictClick(conflict)}
                          className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                            isFocused
                              ? 'bg-white/10'
                              : 'bg-transparent hover:bg-white/5'
                          }`}
                          style={
                            isFocused
                              ? {
                                  borderLeft: `3px solid ${borderColor}`,
                                  boxShadow: `0 0 8px ${borderColor}30`,
                                }
                              : { borderLeft: '3px solid transparent' }
                          }
                        >
                          {conflict.severity === 'error' ? (
                            <AlertCircle
                              className="w-3.5 h-3.5 mt-0.5 shrink-0"
                              style={{ color: '#ef4444' }}
                            />
                          ) : (
                            <AlertTriangle
                              className="w-3.5 h-3.5 mt-0.5 shrink-0"
                              style={{ color: '#f97316' }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/80 leading-relaxed">
                              {conflict.message}
                            </p>
                            <p className="text-[10px] text-white/30 font-mono mt-0.5 truncate">
                              {conflict.pinIds
                                .map((id) => pinNameMap[id] ?? id)
                                .join(', ')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
