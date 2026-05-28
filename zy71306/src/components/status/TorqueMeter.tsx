import { useCalibrationStore } from '../../store/calibrationStore';
import { Gauge } from 'lucide-react';

export default function TorqueMeter() {
  const { torque, stylusPressure } = useCalibrationStore();

  const minTorque = 1.2 * 9.8 * 0.85 * 220 / 1000;
  const maxTorque = 2.5 * 9.8 * 0.85 * 280 / 1000;
  const normalizedTorque = Math.max(0, Math.min(1, (torque - minTorque) / (maxTorque - minTorque) * 0.5 + 0.25));

  const getTorqueStatus = () => {
    if (torque > maxTorque) return { color: 'text-danger-500', bg: 'bg-danger-500', label: '过高' };
    if (torque < minTorque) return { color: 'text-amber-500', bg: 'bg-amber-500', label: '偏低' };
    return { color: 'text-success-500', bg: 'bg-success-500', label: '正常' };
  };

  const status = getTorqueStatus();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge size={18} className="text-brass-400" />
          <span className="text-sm font-medium text-brass-300">力矩</span>
        </div>
        <span className={`text-sm font-bold ${status.color}`}>{status.label}</span>
      </div>

      <div className="font-mono text-2xl font-bold text-brass-300 text-center py-2">
        {torque.toFixed(3)}
        <span className="text-sm text-walnut-400 ml-1">mN·m</span>
      </div>

      <div className="relative h-3 bg-walnut-700 rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-success-500 to-danger-500 opacity-30" />
        <div
          className={`absolute top-0 left-0 h-full ${status.bg} transition-all duration-300`}
          style={{ width: `${normalizedTorque * 100}%` }}
        />
        <div
          className="absolute top-0 w-1 h-full bg-white shadow-lg"
          style={{ left: `calc(${normalizedTorque * 100}% - 2px)` }}
        />
      </div>

      <div className="flex justify-between text-xs text-walnut-500">
        <span>{minTorque.toFixed(2)}</span>
        <span className="text-brass-500">理想范围</span>
        <span>{maxTorque.toFixed(2)}</span>
      </div>
    </div>
  );
}
