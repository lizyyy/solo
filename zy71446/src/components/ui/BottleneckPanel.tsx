import { useMemo } from 'react';
import { AlertTriangle, AlertCircle, TrendingDown, ArrowRight, X } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useUILayoutStore } from '../../store/useUILayoutStore';
import { AnomalyDetector } from '../../engine/AnomalyDetector';
import { zones } from '../../data/stationConfig';

export function BottleneckPanel() {
  const showBottleneckPanel = useUILayoutStore((state) => state.showBottleneckPanel);
  const toggleBottleneckPanel = useUILayoutStore((state) => state.toggleBottleneckPanel);
  const focusOnZone = useUILayoutStore((state) => state.focusOnZone);
  const activeAnomalies = useSimulationStore((state) => state.activeAnomalies);
  const currentTime = useSimulationStore((state) => state.currentTime);
  const crowdDistribution = useSimulationStore((state) => state.crowdDistribution);
  const acknowledgeAnomaly = useSimulationStore((state) => state.acknowledgeAnomaly);

  const visibleAnomalies = useMemo(() => {
    return activeAnomalies
      .filter((a) => {
        if (a.status === 'resolved' && a.endTime) {
          return currentTime >= a.startTime && currentTime <= a.endTime;
        }
        return currentTime >= a.startTime;
      })
      .sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }, [activeAnomalies, currentTime]);

  const getZoneName = (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.name || zoneId;
  };

  const getZoneCapacity = (zoneId: string) => {
    const data = crowdDistribution.get(zoneId);
    return data ? data.currentCount : 0;
  };

  const getZoneMaxCapacity = (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.maxCapacity || 100;
  };

  const handleZoneClick = (zoneId: string, anomalyId: string) => {
    focusOnZone(zoneId);
    acknowledgeAnomaly(anomalyId);
  };

  if (!showBottleneckPanel) return null;

  return (
    <div className="fixed top-20 right-4 w-80 bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl z-40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-cyan-500/10 to-transparent">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-orange-400" size={20} />
          <h2 className="text-cyan-400 font-bold text-sm">瓶颈检测</h2>
          {visibleAnomalies.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/30 text-red-400 border border-red-500/50">
              {visibleAnomalies.length}
            </span>
          )}
        </div>
        <button
          onClick={toggleBottleneckPanel}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {visibleAnomalies.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
              <AlertCircle className="text-green-400" size={24} />
            </div>
            <p className="text-slate-400 text-sm">当前无异常</p>
            <p className="text-slate-500 text-xs mt-1">系统运行正常</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {visibleAnomalies.map((anomaly) => {
              const color = AnomalyDetector.getAnomalyColor(anomaly.type);
              const typeName = AnomalyDetector.getAnomalyTypeName(anomaly.type);
              const currentCount = getZoneCapacity(anomaly.zoneId);
              const maxCapacity = getZoneMaxCapacity(anomaly.zoneId);
              const percentage = Math.round((currentCount / maxCapacity) * 100);

              return (
                <div
                  key={anomaly.id}
                  onClick={() => handleZoneClick(anomaly.zoneId, anomaly.id)}
                  className={`p-4 cursor-pointer transition-all hover:bg-slate-800/50 ${
                    anomaly.status === 'acknowledged' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                      />
                      <span className="text-white font-medium text-sm">{typeName}</span>
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded ${
                          anomaly.severity === 'high'
                            ? 'bg-red-500/30 text-red-400'
                            : 'bg-yellow-500/30 text-yellow-400'
                        }`}
                      >
                        {anomaly.severity === 'high' ? '高风险' : '中风险'}
                      </span>
                    </div>
                    <ArrowRight size={14} className="text-slate-500" />
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={12} className="text-slate-400" />
                    <span className="text-slate-300 text-sm">{getZoneName(anomaly.zoneId)}</span>
                    <span className="text-slate-500 text-xs">·</span>
                    <span className="text-slate-400 text-xs">{anomaly.startTime}</span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">容量</span>
                        <span
                          style={{ color }}
                          className="font-mono font-bold"
                        >
                          {currentCount}/{maxCapacity}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(percentage, 120)}%`,
                            backgroundColor: color,
                            boxShadow: `0 0 6px ${color}`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {anomaly.description && (
                    <p className="text-slate-400 text-xs mt-2 bg-slate-800/50 rounded px-2 py-1">
                      {anomaly.description}
                    </p>
                  )}

                  {anomaly.status === 'acknowledged' && (
                    <div className="mt-2 text-xs text-cyan-400">已确认</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
