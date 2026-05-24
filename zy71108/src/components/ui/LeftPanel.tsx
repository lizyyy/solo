import { Mountain, Route, AlertTriangle, Building2, ShieldCheck, Truck } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { LayerVisibility } from '../../types';
import { getRiskLevelColor } from '../../utils/dataValidator';

const layerConfig: {
  key: keyof LayerVisibility;
  label: string;
  icon: typeof Mountain;
}[] = [
  { key: 'terrain', label: '地形', icon: Mountain },
  { key: 'trajectories', label: '滑行轨迹', icon: Route },
  { key: 'fallPoints', label: '摔倒点', icon: AlertTriangle },
  { key: 'rescueStations', label: '救援站', icon: Building2 },
  { key: 'riskZones', label: '风险区域', icon: ShieldCheck },
  { key: 'rescueRoutes', label: '救援路线', icon: Truck }
];

export function LeftPanel() {
  const {
    layerVisibility,
    toggleLayer,
    sceneData,
    isDataLoaded
  } = useSceneStore();

  if (!isDataLoaded) {
    return (
      <div className="absolute left-4 top-20 z-10 w-64">
        <div className="bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-700/50 p-4">
          <p className="text-gray-400 text-sm text-center">
            请先加载样例或导入数据
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute left-4 top-20 z-10 w-64">
      <div className="bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700/50">
          <h3 className="text-white font-semibold">图层控制</h3>
        </div>
        
        <div className="p-3 space-y-2">
          {layerConfig.map(layer => {
            const Icon = layer.icon;
            const isVisible = layerVisibility[layer.key];
            return (
              <button
                key={layer.key}
                onClick={() => toggleLayer(layer.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isVisible
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-transparent'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{layer.label}</span>
                <div className="ml-auto w-4 h-4 rounded border-2 flex items-center justify-center">
                  {isVisible && (
                    <div className="w-2 h-2 rounded bg-current" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {sceneData && (
          <>
            <div className="px-4 py-3 border-t border-gray-700/50">
              <h3 className="text-white font-semibold mb-2">数据统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">滑行轨迹</span>
                  <span className="text-white">{sceneData.trajectories.length} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">摔倒点</span>
                  <span className="text-white">{sceneData.fallPoints.length} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">救援站</span>
                  <span className="text-white">{sceneData.rescueStations.length} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">风险区域</span>
                  <span className="text-white">{sceneData.riskZones.length} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">救援路线</span>
                  <span className="text-white">{sceneData.rescueRoutes.length} 条</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-700/50">
              <h3 className="text-white font-semibold mb-2">图例</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00B42A' }} />
                  <span className="text-gray-300">低风险</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF7D00' }} />
                  <span className="text-gray-300">中风险</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F53F3F' }} />
                  <span className="text-gray-300">高风险</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LeftPanel;
