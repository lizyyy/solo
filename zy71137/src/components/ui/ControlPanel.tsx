import { Wind, Droplets, AlertTriangle, Gauge } from 'lucide-react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { PESTICIDE_INFO, WIND_SPEED_UNITS } from '@/data/constants';
import { PesticideType } from '@/types';

export function ControlPanel() {
  const { params, setParams, windSpeedUnit, setWindSpeedUnit, maxDriftDistance } = useSimulationStore();

  const convertWindSpeed = (speed: number) => {
    return speed * WIND_SPEED_UNITS[windSpeedUnit].factor;
  };

  const convertWindSpeedBack = (speed: number) => {
    return speed / WIND_SPEED_UNITS[windSpeedUnit].factor;
  };

  const getWindSpeedLabel = () => {
    const speed = params.windSpeed;
    if (speed < 2) return '无风';
    if (speed < 4) return '微风';
    if (speed < 7) return '轻风';
    if (speed < 10) return '和风';
    return '强风';
  };

  return (
    <div className="absolute left-4 top-20 w-72 bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-700/50 overflow-hidden z-10">
      <div className="p-4 border-b border-gray-700/50">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Gauge size={18} className="text-green-400" />
          模拟参数
        </h2>
      </div>

      <div className="p-4 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300 flex items-center gap-2">
              <Wind size={16} className="text-blue-400" />
              风速
            </label>
            <div className="flex items-center gap-2">
              <select
                value={windSpeedUnit}
                onChange={(e) => setWindSpeedUnit(e.target.value as any)}
                className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-600"
              >
                {Object.entries(WIND_SPEED_UNITS).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
              <span className="text-sm text-green-400 font-medium">
                {convertWindSpeed(params.windSpeed).toFixed(1)}
              </span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="0.1"
            value={params.windSpeed}
            onChange={(e) => setParams({ windSpeed: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span className="text-blue-400">{getWindSpeedLabel()}</span>
            <span>{convertWindSpeed(15).toFixed(0)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300 flex items-center gap-2">
              <Wind size={16} className="text-cyan-400" />
              风向
            </label>
            <span className="text-sm text-green-400 font-medium">
              {params.windDirection}°
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={params.windDirection}
              onChange={(e) => setParams({ windDirection: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>北 0°</span>
              <span>东 90°</span>
              <span>南 180°</span>
              <span>西 270°</span>
            </div>
          </div>
          <div className="flex justify-center mt-2">
            <div
              className="w-12 h-12 rounded-full border-2 border-gray-600 relative"
              style={{ transform: `rotate(${params.windDirection}deg)` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-cyan-400" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-600" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm text-gray-300 flex items-center gap-2">
            <Droplets size={16} className="text-green-400" />
            药剂类型
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(PESTICIDE_INFO).map((pesticide) => (
              <button
                key={pesticide.id}
                onClick={() => setParams({ pesticideType: pesticide.id as PesticideType })}
                className={`p-2 rounded-lg text-xs font-medium transition-all ${
                  params.pesticideType === pesticide.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div>{pesticide.name}</div>
                <div className={`text-[10px] mt-0.5 ${
                  pesticide.toxicity === 'high' ? 'text-red-400' :
                  pesticide.toxicity === 'medium' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  毒性: {pesticide.toxicity === 'high' ? '高' : pesticide.toxicity === 'medium' ? '中' : '低'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" />
              缓冲区阈值
            </label>
            <span className="text-sm text-green-400 font-medium">
              {params.bufferThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={params.bufferThreshold}
            onChange={(e) => setParams({ bufferThreshold: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>严格</span>
            <span>宽松</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300">模拟速度</label>
            <span className="text-sm text-green-400 font-medium">
              {params.simulationSpeed.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={params.simulationSpeed}
            onChange={(e) => setParams({ simulationSpeed: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.5x</span>
            <span>1x</span>
            <span>3x</span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-700/50">
          <div className="text-sm text-gray-300 mb-3">实时统计</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">最大漂移距离</div>
              <div className="text-lg font-bold text-blue-400">
                {maxDriftDistance.toFixed(1)} m
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">药剂漂移风险</div>
              <div className={`text-lg font-bold ${
                PESTICIDE_INFO[params.pesticideType].driftRisk > 0.6 ? 'text-red-400' :
                PESTICIDE_INFO[params.pesticideType].driftRisk > 0.4 ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {(PESTICIDE_INFO[params.pesticideType].driftRisk * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}