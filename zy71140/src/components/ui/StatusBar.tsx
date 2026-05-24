import { Box, AlertTriangle, Clock, Layers } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { countExpiringSKUs } from '../../utils/expiryChecker';

export function StatusBar() {
  const { slots, skus, selectedLayerIds, expiryFilterDays, layers } = useStore();

  const filteredSlots = slots.filter((s) => selectedLayerIds.includes(s.layerId));
  const filteredSKUs = skus.filter((s) => selectedLayerIds.includes(s.layerId));

  const totalSlots = filteredSlots.length;
  const occupiedSlots = filteredSlots.filter((s) => s.isOccupied).length;
  const misplacedSlots = filteredSlots.filter(
    (s) => s.status === 'misplaced' || s.status === 'conflict',
  ).length;
  const expiringCount = countExpiringSKUs(filteredSKUs, expiryFilterDays);
  const occupancyRate = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900/90 backdrop-blur-md border-t border-slate-700/50">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400 text-xs">当前温层:</span>
            <div className="flex items-center gap-1">
              {selectedLayerIds.length > 0 ? (
                layers
                  .filter((l) => selectedLayerIds.includes(l.id))
                  .map((layer) => (
                    <div
                      key={layer.id}
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: layer.color, boxShadow: `0 0 6px ${layer.color}` }}
                      title={layer.name}
                    />
                  ))
              ) : (
                <span className="text-slate-600 text-xs">无</span>
              )}
            </div>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 text-xs">货位:</span>
            <span className="text-white font-mono text-sm">
              {occupiedSlots}/{totalSlots}
            </span>
            <span className="text-slate-500 text-xs">({occupancyRate}%)</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 ${misplacedSlots > 0 ? 'text-amber-400' : 'text-slate-600'}`}
            />
            <span className="text-slate-400 text-xs">温层错放:</span>
            <span
              className={`font-mono text-sm ${misplacedSlots > 0 ? 'text-amber-400' : 'text-slate-500'}`}
            >
              {misplacedSlots}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${expiringCount > 0 ? 'text-red-400' : 'text-slate-600'}`} />
            <span className="text-slate-400 text-xs">
              {expiryFilterDays}天内临期:
            </span>
            <span
              className={`font-mono text-sm ${expiringCount > 0 ? 'text-red-400' : 'text-slate-500'}`}
            >
              {expiringCount}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${occupiedSlots > 0 ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}
            />
            <span className="text-slate-500 text-xs">系统在线</span>
          </div>
        </div>
      </div>
    </div>
  );
}
