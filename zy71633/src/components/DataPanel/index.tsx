import { useSimulationStore } from '../../store/useSimulationStore';
import { VelocityChart } from './VelocityChart';

export function DataPanel() {
  const { projectileVelocity, temperatures, result, state } = useSimulationStore();

  const getHeatRiskLevel = (temp: number) => {
    if (temp > 100) return { level: '危险', color: 'text-danger-500', bg: 'bg-danger-500/20' };
    if (temp > 70) return { level: '警告', color: 'text-warning-500', bg: 'bg-warning-500/20' };
    return { level: '正常', color: 'text-green-400', bg: 'bg-green-500/20' };
  };

  const coilRisk = getHeatRiskLevel(temperatures.coil);

  return (
    <div className="absolute bottom-4 right-4 w-80 bg-space-800/90 backdrop-blur-md rounded-lg border border-cyber-500/20 p-4">
      <h3 className="text-lg font-orbitron text-cyber-500 mb-4 tracking-wider">
        实时数据
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-space-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 font-jetbrains mb-1">当前速度</div>
          <div className="text-2xl font-bold text-cyber-500 font-jetbrains">
            {projectileVelocity.toFixed(1)}
            <span className="text-sm text-gray-400 ml-1">m/s</span>
          </div>
        </div>

        <div className="bg-space-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 font-jetbrains mb-1">终端速度</div>
          <div className="text-2xl font-bold text-green-400 font-jetbrains">
            {result ? result.finalVelocity.toFixed(1) : '--'}
            <span className="text-sm text-gray-400 ml-1">m/s</span>
          </div>
        </div>

        <div className="bg-space-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 font-jetbrains mb-1">动能</div>
          <div className="text-xl font-bold text-warning-500 font-jetbrains">
            {result ? (result.kineticEnergy / 1000).toFixed(2) : '--'}
            <span className="text-sm text-gray-400 ml-1">kJ</span>
          </div>
        </div>

        <div className="bg-space-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 font-jetbrains mb-1">效率</div>
          <div className="text-xl font-bold text-purple-400 font-jetbrains">
            {result ? result.efficiency.toFixed(2) : '--'}
            <span className="text-sm text-gray-400 ml-1">%</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400 font-jetbrains">线圈温度</span>
          <span className={`px-2 py-0.5 rounded text-xs ${coilRisk.bg} ${coilRisk.color}`}>
            {coilRisk.level}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-space-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                temperatures.coil > 100
                  ? 'bg-gradient-to-r from-orange-500 to-red-500'
                  : temperatures.coil > 70
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-cyber-600 to-cyber-400'
              }`}
              style={{ width: `${Math.min((temperatures.coil / 150) * 100, 100)}%` }}
            />
          </div>
          <span className="text-sm font-jetbrains text-white min-w-[60px] text-right">
            {temperatures.coil.toFixed(1)}°C
          </span>
        </div>
      </div>

      <div className="h-32">
        <VelocityChart />
      </div>

      {state === 'completed' && result && (
        <div className="mt-4 pt-4 border-t border-cyber-500/20">
          <div className="text-xs text-gray-400 font-jetbrains space-y-1">
            <div className="flex justify-between">
              <span>加速时间:</span>
              <span className="text-white">{result.duration.toFixed(2)} ms</span>
            </div>
            <div className="flex justify-between">
              <span>最大加速度:</span>
              <span className="text-white">{(result.maxAcceleration / 9.8).toFixed(1)} G</span>
            </div>
            <div className="flex justify-between">
              <span>最高温度:</span>
              <span className="text-white">{result.maxTemperature.toFixed(1)}°C</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
