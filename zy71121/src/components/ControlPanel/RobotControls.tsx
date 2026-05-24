import { Bot, MoveRight, AlertTriangle } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { SliderControl } from './SliderControl';

export function RobotControls() {
  const { robotPath, setRobotPath, plants, validation } = useSimulationStore();
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">机器人通道</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={robotPath.enabled}
            onChange={(e) => setRobotPath({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      {robotPath.enabled && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <MoveRight className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">通道设置</span>
          </div>
          
          <SliderControl
            label="通道宽度"
            value={robotPath.width}
            min={40}
            max={150}
            step={5}
            unit="cm"
            onChange={(v) => setRobotPath({ width: v })}
          />
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">通道位置</label>
              <span className="text-sm font-semibold text-blue-600">
                第 {robotPath.position} - {robotPath.position + 1} 行间
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={plants.rowsCount - 1}
              step={1}
              value={robotPath.position}
              onChange={(e) => setRobotPath({ position: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>第1行后</span>
              <span>第{plants.rowsCount - 1}行后</span>
            </div>
          </div>
          
          <div className={`mt-4 p-4 rounded-lg ${
            validation.pathWidthOk 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start gap-2">
              {validation.pathWidthOk ? (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className={`text-sm font-semibold ${
                  validation.pathWidthOk ? 'text-green-700' : 'text-red-700'
                }`}>
                  {validation.pathWidthOk ? '通道宽度合格' : '通道宽度不足！'}
                </div>
                <div className={`text-xs mt-1 ${
                  validation.pathWidthOk ? 'text-green-600' : 'text-red-600'
                }`}>
                  实际宽度: {validation.actualPathWidth.toFixed(0)}cm / 最小要求: {validation.minPathWidth}cm
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!robotPath.enabled && (
        <div className="text-center py-6 text-gray-500 text-sm">
          请开启开关以配置机器人通道
        </div>
      )}
    </div>
  );
}
