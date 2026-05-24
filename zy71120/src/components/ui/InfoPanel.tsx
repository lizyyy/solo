import { Server, Thermometer, Zap, AlertTriangle, X, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ALERT_COLORS, STATUS_COLORS } from '../../utils/colors';
import { cn } from '../../lib/utils';

export function InfoPanel() {
  const {
    selectedRackId,
    setSelectedRackId,
    dataCenter,
    getCurrentRackData,
    getFilteredAlerts,
    timeSeriesData,
    currentTimeIndex,
  } = useAppStore();

  const selectedRack = selectedRackId ? getCurrentRackData(selectedRackId) : null;
  const rack = dataCenter?.racks.find((r) => r.id === selectedRackId);
  const filteredAlerts = getFilteredAlerts();

  const statusLabels: Record<string, string> = {
    normal: '正常',
    warning: '预警',
    critical: '严重',
    offline: '离线',
  };

  return (
    <div className="absolute right-4 top-20 bottom-24 w-72 bg-slate-900/90 backdrop-blur-md rounded-lg border border-cyan-500/20 shadow-2xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-cyan-500/20">
        <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
          <Server size={20} />
          信息面板
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedRack && rack ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">{rack.name}</h3>
              <button
                onClick={() => setSelectedRackId(null)}
                className="p-1 rounded hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium text-center',
                selectedRack.status === 'critical' && 'bg-red-500/20 text-red-400',
                selectedRack.status === 'warning' && 'bg-yellow-500/20 text-yellow-400',
                selectedRack.status === 'normal' && 'bg-emerald-500/20 text-emerald-400',
                selectedRack.status === 'offline' && 'bg-gray-500/20 text-gray-400'
              )}
            >
              {statusLabels[selectedRack.status]}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-400">
                  <Zap size={16} className="text-yellow-400" />
                  <span>功耗</span>
                </div>
                <span className="text-white font-mono">{selectedRack.power.toFixed(1)} kW</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-400">
                  <Thermometer size={16} className="text-red-400" />
                  <span>温度</span>
                </div>
                <span className="text-white font-mono">{selectedRack.temperature.toFixed(1)} °C</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">传感器状态</h4>
              <div className="space-y-2">
                {rack.sensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    className="flex items-center justify-between p-2 bg-slate-800/30 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {sensor.online ? (
                        <Wifi size={14} className="text-emerald-400" />
                      ) : (
                        <WifiOff size={14} className="text-red-400" />
                      )}
                      <span className="text-gray-300">
                        {sensor.type === 'temperature' && '温度'}
                        {sensor.type === 'power' && '功耗'}
                        {sensor.type === 'humidity' && '湿度'}
                      </span>
                    </div>
                    <span className="text-white font-mono">
                      {sensor.online ? `${sensor.value.toFixed(1)}` : '离线'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">
            <Server size={48} className="mx-auto mb-3 opacity-30" />
            <p>点击机柜查看详情</p>
          </div>
        )}

        <div className="border-t border-cyan-500/20 pt-4">
          <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2 mb-3">
            <AlertTriangle size={16} />
            当前告警 ({filteredAlerts.length})
          </h3>
          
          {filteredAlerts.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-4">
              暂无符合条件的告警
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredAlerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'p-2 rounded-md text-sm border-l-2',
                    alert.level === 'critical' && 'bg-red-500/10 border-red-500',
                    alert.level === 'warning' && 'bg-yellow-500/10 border-yellow-500',
                    alert.level === 'info' && 'bg-blue-500/10 border-blue-500'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={14}
                      style={{ color: ALERT_COLORS[alert.level], marginTop: 2 }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 truncate">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {dataCenter && (
          <div className="border-t border-cyan-500/20 pt-4">
            <h3 className="text-sm font-bold text-cyan-400 mb-3">机房统计</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-800/50 rounded text-center">
                <div className="text-gray-400">机柜总数</div>
                <div className="text-white text-lg font-mono">{dataCenter.racks.length}</div>
              </div>
              <div className="p-2 bg-slate-800/50 rounded text-center">
                <div className="text-gray-400">机排数</div>
                <div className="text-white text-lg font-mono">{dataCenter.rows.length}</div>
              </div>
              <div className="p-2 bg-red-500/10 rounded text-center">
                <div className="text-gray-400">严重</div>
                <div className="text-red-400 text-lg font-mono">
                  {timeSeriesData[currentTimeIndex]?.racks.filter((r) => r.status === 'critical').length || 0}
                </div>
              </div>
              <div className="p-2 bg-yellow-500/10 rounded text-center">
                <div className="text-gray-400">预警</div>
                <div className="text-yellow-400 text-lg font-mono">
                  {timeSeriesData[currentTimeIndex]?.racks.filter((r) => r.status === 'warning').length || 0}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
