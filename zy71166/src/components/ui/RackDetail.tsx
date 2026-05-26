import { X, Thermometer, Zap, Gauge, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useUISTore } from '../../store/useUISTore';
import { getStatusColor, getStatusBgColor, tempToColor } from '../../utils/temperature';
import { PHYSICS_CONFIG } from '../../engine/config';

export function RackDetail() {
  const { racks, acUnits } = useGameStore();
  const { selectedRackId, setSelectedRackId } = useUISTore();

  const rack = racks.find((r) => r.id === selectedRackId);

  if (!rack) return null;

  const nearbyACs = acUnits.filter((a) => {
    const dist = Math.sqrt(
      Math.pow(a.position.x - rack.position.x, 2) +
      Math.pow(a.position.z - rack.position.z, 2)
    );
    return dist < 6;
  });

  const tempPercent = Math.min(100, ((rack.temperature - 18) / (PHYSICS_CONFIG.FAULT_TEMP - 18)) * 100);
  const loadPercent = (rack.load / rack.maxLoad) * 100;

  return (
    <div className="absolute bottom-4 left-4 z-20 w-72 bg-slate-800/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
      <div className={`p-4 border-b border-slate-700/50 ${getStatusBgColor(rack.status)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-100">{rack.name}</div>
            <div className={`text-sm ${getStatusColor(rack.status)}`}>
              {rack.status === 'normal' && '正常运行'}
              {rack.status === 'warning' && '温度警告'}
              {rack.status === 'danger' && '温度危险'}
              {rack.status === 'fault' && '设备故障'}
            </div>
          </div>
          <button
            onClick={() => setSelectedRackId(null)}
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <Thermometer size={16} />
              <span>温度</span>
            </div>
            <div className="font-mono font-bold" style={{ color: tempToColor(rack.temperature) }}>
              {rack.temperature.toFixed(1)}°C
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${tempPercent}%`,
                backgroundColor: tempToColor(rack.temperature),
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>18°C</span>
            <span className={rack.temperature >= PHYSICS_CONFIG.WARNING_TEMP ? 'text-yellow-400' : ''}>
              警告 {PHYSICS_CONFIG.WARNING_TEMP}°C
            </span>
            <span className={rack.temperature >= PHYSICS_CONFIG.DANGER_TEMP ? 'text-orange-400' : ''}>
              危险 {PHYSICS_CONFIG.DANGER_TEMP}°C
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <Zap size={16} />
              <span>负载</span>
            </div>
            <div className="font-mono font-bold text-cyan-400">
              {rack.load.toFixed(1)} / {rack.maxLoad.toFixed(1)} kW
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${loadPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Gauge size={16} />
            <span>风量</span>
          </div>
          <div className="font-mono text-slate-300">
            {rack.airflow.toFixed(0)} m³/h
          </div>
        </div>

        {nearbyACs.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-slate-400">附近空调</div>
            <div className="flex gap-2 flex-wrap">
              {nearbyACs.map((ac) => (
                <div
                  key={ac.id}
                  className={`px-2 py-1 rounded text-xs ${ac.isOn ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-600/50 text-slate-400'}`}
                >
                  {ac.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {rack.status !== 'normal' && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              {rack.status === 'warning' && '温度偏高，建议增加冷却或减少负载'}
              {rack.status === 'danger' && '温度危险，请立即采取行动！'}
              {rack.status === 'fault' && '设备故障，无法继续运行'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
