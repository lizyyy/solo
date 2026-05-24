import { AlertTriangle, X, Droplets, ShieldAlert } from 'lucide-react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { AlertType } from '@/types';

const alertIcons: Record<AlertType, React.ReactNode> = {
  buffer: <ShieldAlert size={16} />,
  canal: <Droplets size={16} />,
  concentration: <AlertTriangle size={16} />,
};

const alertTypeLabels: Record<AlertType, string> = {
  buffer: '缓冲区',
  canal: '水渠',
  concentration: '浓度超标',
};

export function AlertPanel() {
  const { alerts, clearAlerts } = useSimulationStore();

  if (alerts.length === 0) return null;

  const dangerCount = alerts.filter((a) => a.severity === 'danger').length;

  return (
    <div className="absolute right-4 top-20 w-80 bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-700/50 overflow-hidden z-10">
      <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
        <h2 className={`font-semibold flex items-center gap-2 ${
          dangerCount > 0 ? 'text-red-400' : 'text-orange-400'
        }`}>
          <AlertTriangle size={18} />
          漂移报警 ({alerts.length})
        </h2>
        <button
          onClick={clearAlerts}
          className="text-gray-400 hover:text-white transition-colors p-1"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {alerts.slice().reverse().map((alert) => (
          <div
            key={alert.id}
            className={`p-3 border-b border-gray-700/30 last:border-b-0 ${
              alert.severity === 'danger'
                ? 'bg-red-900/20 hover:bg-red-900/30'
                : 'bg-orange-900/20 hover:bg-orange-900/30'
            } transition-colors`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 ${
                alert.severity === 'danger' ? 'text-red-400' : 'text-orange-400'
              }`}>
                {alertIcons[alert.type]}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    alert.severity === 'danger'
                      ? 'bg-red-900 text-red-300'
                      : 'bg-orange-900 text-orange-300'
                  }`}>
                    {alert.severity === 'danger' ? '危险' : '警告'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {alertTypeLabels[alert.type]}
                  </span>
                </div>
                <p className="text-sm text-gray-200 mt-1">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(alert.timestamp).toLocaleTimeString('zh-CN')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}