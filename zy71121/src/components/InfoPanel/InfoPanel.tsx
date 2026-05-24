import { AlertTriangle, CheckCircle, Info, Thermometer, Ruler } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { getHeatmapStats, getHeatmapColor } from '../../utils/heatmap';

export function InfoPanel() {
  const { validation, heatmapData, plants, light, robotPath, showHeatmap } = useSimulationStore();
  const heatmapStats = getHeatmapStats(heatmapData);
  
  return (
    <div className="absolute right-4 top-20 bottom-4 w-72 z-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">实时数据</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              总株数
            </span>
            <span className="font-semibold text-gray-800">
              {plants.rowsCount * plants.plantsPerRow} 株
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600 flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              太阳角度
            </span>
            <span className="font-semibold text-gray-800">
              {light.sunAngle.toFixed(0)}°
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">当前时间</span>
            <span className="font-semibold text-gray-800">
              {Math.floor(light.timeOfDay)}:{(light.timeOfDay % 1 * 60).toFixed(0).padStart(2, '0')}
            </span>
          </div>
          
          {robotPath.enabled && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">通道位置</span>
              <span className="font-semibold text-gray-800">
                第{robotPath.position}-{robotPath.position + 1}行
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-2 rounded-lg ${validation.warnings.length === 0 ? 'bg-green-100' : 'bg-amber-100'}`}>
            {validation.warnings.length === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-800">校验结果</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">光照覆盖率</span>
            <span className={`font-bold ${
              validation.lightCoverage >= 70 ? 'text-green-600' : 
              validation.lightCoverage >= 50 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {validation.lightCoverage.toFixed(1)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                validation.lightCoverage >= 70 ? 'bg-green-500' : 
                validation.lightCoverage >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${validation.lightCoverage}%` }}
            />
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-gray-600">冠层遮挡</span>
            <span className={`font-semibold ${validation.canopyOverlap ? 'text-red-600' : 'text-green-600'}`}>
              {validation.canopyOverlap ? '存在' : '正常'}
            </span>
          </div>
          
          {robotPath.enabled && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">通道宽度</span>
              <span className={`font-semibold ${validation.pathWidthOk ? 'text-green-600' : 'text-red-600'}`}>
                {validation.pathWidthOk ? '合格' : '不足'}
              </span>
            </div>
          )}
        </div>
        
        {validation.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="text-sm font-medium text-amber-800 mb-2">警告信息：</div>
            <ul className="space-y-1">
              {validation.warnings.map((warning, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                  <span className="text-amber-500">•</span>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {showHeatmap && (
        <div className="bg-white rounded-xl shadow-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-gradient-to-r from-red-100 via-amber-100 to-green-100 rounded-lg">
              <Thermometer className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">热力图数据</h3>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">平均光照</span>
              <span className="font-semibold text-gray-800">
                {(heatmapStats.avg * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">最高光照</span>
              <span className="font-semibold text-green-600">
                {(heatmapStats.max * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">最低光照</span>
              <span className="font-semibold text-red-600">
                {(heatmapStats.min * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600 mb-2">光照图例</div>
            <div className="h-4 rounded-lg bg-gradient-to-r from-red-500 via-amber-400 via-yellow-300 to-green-500" />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>弱光</span>
              <span>强光</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
