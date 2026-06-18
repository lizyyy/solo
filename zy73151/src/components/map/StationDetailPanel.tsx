import { useAppStore } from '@/store/useAppStore';
import { SeverityBadge } from '@/components/common/Badges';
import { X, Thermometer, Droplets, Waves, Activity, Clock } from 'lucide-react';
import { anomalyTypeLabels } from '@/utils/anomalyDetector';

export default function StationDetailPanel() {
  const { selectedStationId, stations, getStationAnomalies, selectStation, materials } = useAppStore();

  const station = stations.find(s => s.id === selectedStationId);
  const stationAnomalies = selectedStationId ? getStationAnomalies(selectedStationId) : [];

  const latestMaterial = materials.find(m => m.isLatest);
  const latestRecord = latestMaterial?.parsedData.find(r => r.stationId === selectedStationId);

  if (!selectedStationId || !station) {
    return (
      <div className="w-80 bg-white rounded-lg shadow-card border border-ocean-100 p-6 flex flex-col items-center justify-center text-ocean-400">
        <Waves className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">点击地图点位查看详情</p>
      </div>
    );
  }

  const hasHighAnomaly = stationAnomalies.some(a => a.severity === 'high');

  return (
    <div className="w-80 bg-white rounded-lg shadow-card border border-ocean-100 flex flex-col animate-slide-in-right">
      <div className={`p-4 border-b ${hasHighAnomaly ? 'bg-alert-orange/5 border-alert-orange/20' : 'bg-ocean-50 border-ocean-100'}`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-ocean-800">{station.name}</h3>
            <p className="text-xs text-ocean-500 mt-1">{station.area} · {station.id}</p>
          </div>
          <button
            onClick={() => selectStation(null)}
            className="p-1 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <SeverityBadge severity={hasHighAnomaly ? 'high' : stationAnomalies.length > 0 ? 'medium' : 'low'} />
          <span className="text-xs text-ocean-500">
            {stationAnomalies.length} 条异常记录
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {latestRecord && (
          <div className="p-4 border-b border-ocean-100">
            <h4 className="text-sm font-medium text-ocean-700 mb-3">最新监测数据</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ocean-50/50 rounded-md">
                <div className="flex items-center gap-1.5 text-ocean-500 mb-1">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span className="text-xs">水温</span>
                </div>
                <p className="text-lg font-semibold text-ocean-800">{latestRecord.temperature}°C</p>
              </div>
              <div className="p-3 bg-ocean-50/50 rounded-md">
                <div className="flex items-center gap-1.5 text-ocean-500 mb-1">
                  <Droplets className="w-3.5 h-3.5" />
                  <span className="text-xs">盐度</span>
                </div>
                <p className="text-lg font-semibold text-ocean-800">{latestRecord.salinity}‰</p>
              </div>
              <div className="p-3 bg-ocean-50/50 rounded-md">
                <div className="flex items-center gap-1.5 text-ocean-500 mb-1">
                  <Waves className="w-3.5 h-3.5" />
                  <span className="text-xs">潮位</span>
                </div>
                <p className="text-lg font-semibold text-ocean-800">
                  {latestRecord.tideLevel} {latestRecord.tideUnit}
                </p>
              </div>
              <div className="p-3 bg-ocean-50/50 rounded-md">
                <div className="flex items-center gap-1.5 text-ocean-500 mb-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="text-xs">溶解氧</span>
                </div>
                <p className="text-lg font-semibold text-ocean-800">{latestRecord.dissolvedOxygen} mg/L</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-ocean-100">
              <div className="flex items-center gap-1.5 text-xs text-ocean-500">
                <Clock className="w-3.5 h-3.5" />
                <span>采样时间：{latestRecord.sampleTime}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ocean-500 mt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>结果时间：{latestRecord.resultTime}</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          <h4 className="text-sm font-medium text-ocean-700 mb-3">异常记录</h4>
          <div className="space-y-2">
            {stationAnomalies.length === 0 ? (
              <p className="text-sm text-ocean-400 text-center py-4">暂无异常</p>
            ) : (
              stationAnomalies.map(anomaly => (
                <div
                  key={anomaly.id}
                  className="p-3 border border-ocean-100 rounded-md hover:border-ocean-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-ocean-700">
                      {anomalyTypeLabels[anomaly.type]}
                    </span>
                    <SeverityBadge severity={anomaly.severity} size="sm" />
                  </div>
                  <p className="text-xs text-ocean-600 mt-2 line-clamp-2">{anomaly.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
