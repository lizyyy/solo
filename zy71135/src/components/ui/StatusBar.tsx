import { AlertTriangle, CheckCircle, Navigation, Package, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function StatusBar() {
  const centerOfGravity = useStore((state) => state.centerOfGravity);
  const alerts = useStore((state) => state.alerts);
  const bays = useStore((state) => state.bays);
  const cargoList = useStore((state) => state.cargoList);

  const loadedBays = bays.filter((b) => b.occupiedBy);
  const totalWeight = loadedBays.reduce((sum, bay) => {
    const cargo = cargoList.find((c) => c.id === bay.occupiedBy);
    return sum + (cargo?.weight || 0);
  }, 0);

  const errors = alerts.filter((a) => a.severity === 'error');
  const warnings = alerts.filter((a) => a.severity === 'warning');

  return (
    <div className="bg-gray-900 p-4 border-t border-gray-700">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Navigation className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-400">重心偏移</span>
          </div>
          <div className="flex items-center gap-2">
            {centerOfGravity.isWarning ? (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            <span className="text-lg font-bold text-white">
              {(centerOfGravity.offset * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            X: {centerOfGravity.x.toFixed(2)} Z: {centerOfGravity.z.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-teal-400" />
            <span className="text-sm text-gray-400">装载统计</span>
          </div>
          <div className="text-lg font-bold text-white">
            {loadedBays.length} / {bays.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            总重: {totalWeight.toFixed(1)} 吨
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-400">告警信息</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-red-500">
              {errors.length} 错误
            </span>
            <span className="text-lg font-bold text-yellow-500">
              {warnings.length} 警告
            </span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-400">舱位利用率</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-teal-500 h-3 rounded-full transition-all"
              style={{ width: `${(loadedBays.length / bays.length) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {((loadedBays.length / bays.length) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mt-4 max-h-32 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2 p-2 rounded mb-1 text-sm ${
                alert.severity === 'error'
                  ? 'bg-red-900/50 text-red-300'
                  : 'bg-yellow-900/50 text-yellow-300'
              }`}
            >
              {alert.severity === 'error' ? (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
