import { useState, useMemo } from 'react';
import { Layers, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChipStore } from '@/store/chipStore';
import { useFilterStore } from '@/store/filterStore';

export default function VoltageDomainPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const voltageDomains = useChipStore((s) => s.voltageDomains);
  const pins = useChipStore((s) => s.pins);
  const toggleDomain = useFilterStore((s) => s.toggleDomain);
  const selectOnly = useFilterStore((s) => s.selectOnly);
  const clearFilter = useFilterStore((s) => s.clearFilter);
  const activeDomainIds = useFilterStore((s) => s.activeDomainIds);

  const domainPinCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const vd of voltageDomains) {
      counts[vd.id] = pins.filter((p) => p.voltageDomainId === vd.id).length;
    }
    return counts;
  }, [voltageDomains, pins]);

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-black/60 backdrop-blur-md border-r border-white/5 overflow-y-auto z-30 transition-all duration-300 ${
        collapsed ? 'w-10' : 'w-64'
      }`}
      style={{ background: '#0a0e17cc' }}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white tracking-wide">
              电压域筛选
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="p-2 space-y-1">
            {voltageDomains.map((domain) => {
              const isActive = activeDomainIds.has(domain.id);
              return (
                <div
                  key={domain.id}
                  onClick={() => toggleDomain(domain.id)}
                  onDoubleClick={() => selectOnly(domain.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-white/10'
                      : 'bg-transparent hover:bg-white/5'
                  }`}
                  style={
                    isActive
                      ? {
                          boxShadow: `0 0 12px ${domain.color}40, 0 0 4px ${domain.color}60`,
                          outline: `2px solid ${domain.color}`,
                          outlineOffset: '-2px',
                        }
                      : undefined
                  }
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: domain.color }}
                  />
                  <span className="text-sm text-white/90 flex-1 truncate">
                    {domain.name}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: domain.color }}
                  >
                    {domain.nominalVoltage}V
                  </span>
                  <span className="text-xs text-white/40 font-mono">
                    {domainPinCounts[domain.id] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-2 mt-2 border-t border-white/5">
            <button
              onClick={clearFilter}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              清除筛选
            </button>
          </div>
        </>
      )}
    </div>
  );
}
