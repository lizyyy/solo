import { X, Cloud, Thermometer, Wind, Eye, AlertTriangle, Info, MapPin, Clock, Users } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { getRiskLevelColor, getSeverityColor } from '../../utils/dataValidator';

export function RightPanel() {
  const {
    sceneData,
    isDataLoaded,
    selectedItemId,
    selectedItemType,
    selectItem
  } = useSceneStore();

  if (!isDataLoaded || !sceneData) {
    return null;
  }

  const getSelectedItem = () => {
    if (!selectedItemId || !selectedItemType) return null;

    switch (selectedItemType) {
      case 'fallPoint':
        return sceneData.fallPoints.find(p => p.id === selectedItemId);
      case 'rescueStation':
        return sceneData.rescueStations.find(s => s.id === selectedItemId);
      case 'riskZone':
        return sceneData.riskZones.find(z => z.id === selectedItemId);
      case 'rescueRoute':
        return sceneData.rescueRoutes.find(r => r.id === selectedItemId);
      default:
        return null;
    }
  };

  const selectedItem = getSelectedItem();

  const formatSeverity = (severity: string) => {
    const map: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高'
    };
    return map[severity] || severity;
  };

  const formatWeather = (condition: string) => {
    const map: Record<string, string> = {
      sunny: '晴朗',
      cloudy: '多云',
      snowy: '下雪',
      windy: '大风'
    };
    return map[condition] || condition;
  };

  return (
    <div className="absolute right-4 top-20 z-10 w-72">
      <div className="bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700/50 bg-gradient-to-r from-blue-600/20 to-transparent">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Cloud size={18} className="text-blue-400" />
            天气信息
          </h3>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Cloud size={16} className="text-gray-400" />
            <span className="text-gray-300 text-sm">{formatWeather(sceneData.weather.condition)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Thermometer size={16} className="text-gray-400" />
            <span className="text-gray-300 text-sm">{sceneData.weather.temperature}°C</span>
          </div>
          <div className="flex items-center gap-2">
            <Wind size={16} className="text-gray-400" />
            <span className="text-gray-300 text-sm">{sceneData.weather.windSpeed} km/h</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-gray-400" />
            <span className="text-gray-300 text-sm">{sceneData.weather.visibility} m</span>
          </div>
        </div>

        {sceneData.validation.errors.length > 0 && (
          <>
            <div className="px-4 py-3 border-t border-gray-700/50 bg-gradient-to-r from-red-600/20 to-transparent">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400" />
                数据验证
                <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                  sceneData.validation.isValid 
                    ? 'bg-yellow-500/20 text-yellow-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {sceneData.validation.errors.length} 个问题
                </span>
              </h3>
            </div>
            <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
              {sceneData.validation.errors.map((error, index) => (
                <div
                  key={index}
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${getSeverityColor(error.severity)}20` }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={14}
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: getSeverityColor(error.severity) }}
                    />
                    <div>
                      <p className="text-white text-sm font-medium">{error.message}</p>
                      <p className="text-gray-400 text-xs mt-1">{error.details}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedItem && (
          <>
            <div className="px-4 py-3 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Info size={18} className="text-blue-400" />
                  选中信息
                </h3>
                <button
                  onClick={() => selectItem(null, null)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-4">
              {selectedItemType === 'fallPoint' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getRiskLevelColor((selectedItem as any).severity) }}
                    />
                    <span className="text-white font-medium">{(selectedItem as any).skierName}</span>
                    <span
                      className="ml-auto px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: `${getRiskLevelColor((selectedItem as any).severity)}30`,
                        color: getRiskLevelColor((selectedItem as any).severity)
                      }}
                    >
                      {formatSeverity((selectedItem as any).severity)}级
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{(selectedItem as any).description}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock size={14} />
                    <span>{(selectedItem as any).timestamp}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin size={14} />
                    <span>
                      ({(selectedItem as any).position.x.toFixed(1)}, {(selectedItem as any).position.z.toFixed(1)})
                    </span>
                  </div>
                </div>
              )}

              {selectedItemType === 'rescueStation' && (
                <div className="space-y-3">
                  <h4 className="text-white font-medium">{(selectedItem as any).name}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users size={14} />
                    <span>{(selectedItem as any).personnel} 名救援人员</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock size={14} />
                    <span>响应时间: {(selectedItem as any).responseTime} 分钟</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin size={14} />
                    <span>
                      ({(selectedItem as any).position.x.toFixed(1)}, {(selectedItem as any).position.z.toFixed(1)})
                    </span>
                  </div>
                </div>
              )}

              {selectedItemType === 'riskZone' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: getRiskLevelColor((selectedItem as any).level) }}
                    />
                    <span className="text-white font-medium">{(selectedItem as any).name}</span>
                    <span
                      className="ml-auto px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: `${getRiskLevelColor((selectedItem as any).level)}30`,
                        color: getRiskLevelColor((selectedItem as any).level)
                      }}
                    >
                      {formatSeverity((selectedItem as any).level)}风险
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{(selectedItem as any).reason}</p>
                  {(selectedItem as any).isClosed && (
                    <div className="px-3 py-2 bg-red-500/20 rounded-lg">
                      <span className="text-red-400 text-sm">此区域已关闭</span>
                    </div>
                  )}
                </div>
              )}

              {selectedItemType === 'rescueRoute' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-1 rounded"
                      style={{ backgroundColor: (selectedItem as any).color }}
                    />
                    <span className="text-white font-medium">{(selectedItem as any).name}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    <p>起点: {(selectedItem as any).fromStation}</p>
                    <p className="mt-1">终点: {(selectedItem as any).toPoint}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock size={14} />
                    <span>预计时间: {(selectedItem as any).estimatedTime} 分钟</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RightPanel;
