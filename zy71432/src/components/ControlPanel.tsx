import { useGameStore } from '../store/gameStore';
import { Lock, Unlock, Wind, Car, Gauge } from 'lucide-react';

export const ControlPanel = () => {
  const {
    carParams,
    wingConfig,
    windConfig,
    lockedParams,
    status,
    setWingAngle,
    setWindSpeed,
    setWindDirection,
    toggleParamLock
  } = useGameStore();

  const isDisabled = status === 'running';

  return (
    <div className="bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider">
          参数调节
        </h2>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className={status === 'running' ? 'text-green-400' : 'text-gray-500'}>
            ● {status === 'running' ? '运行中' : status === 'paused' ? '已暂停' : '就绪'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-[#0a1628] rounded-lg p-4 border border-[#1e3a5f]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-[#ff6b35]" />
              <span className="text-sm font-medium text-white">赛车参数</span>
            </div>
            <button
              onClick={() => toggleParamLock('car')}
              className="p-1 hover:bg-[#1e3a5f] rounded transition-colors"
              disabled={isDisabled}
            >
              {lockedParams.car ? (
                <Lock className="w-4 h-4 text-yellow-500" />
              ) : (
                <Unlock className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">质量:</span>
              <span className="text-white font-mono">{carParams.mass} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">功率:</span>
              <span className="text-white font-mono">{(carParams.power / 1000).toFixed(0)} kW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cd0:</span>
              <span className="text-white font-mono">{carParams.baseDragCoeff.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">轮胎μ:</span>
              <span className="text-white font-mono">{carParams.tireGrip.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            来源: {carParams.source} | ID: {carParams.id.slice(0, 6)}
          </div>
        </div>

        <div className="bg-[#0a1628] rounded-lg p-4 border border-[#1e3a5f]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#00d4ff]" />
              <span className="text-sm font-medium text-white">翼片角度</span>
            </div>
            <button
              onClick={() => toggleParamLock('wing')}
              className="p-1 hover:bg-[#1e3a5f] rounded transition-colors"
              disabled={isDisabled}
            >
              {lockedParams.wing ? (
                <Lock className="w-4 h-4 text-yellow-500" />
              ) : (
                <Unlock className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">-15°</span>
              <span className="text-lg font-bold text-[#00d4ff] font-mono">
                {wingConfig.angle.toFixed(1)}°
              </span>
              <span className="text-xs text-gray-400">+15°</span>
            </div>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.5"
              value={wingConfig.angle}
              onChange={(e) => setWingAngle(parseFloat(e.target.value))}
              disabled={isDisabled || lockedParams.wing}
              className="w-full h-2 bg-[#1e3a5f] rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                [&::-webkit-slider-thumb]:bg-[#00d4ff] [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,212,255,0.5)]
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              <div className="flex justify-between">
                <span className="text-gray-400">阻力倍率:</span>
                <span className="text-[#ff6b35] font-mono">{wingConfig.dragFactor.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">升力倍率:</span>
                <span className="text-[#00d4ff] font-mono">{wingConfig.liftFactor.toFixed(3)}</span>
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            来源: {wingConfig.source} | ID: {wingConfig.id.slice(0, 6)}
          </div>
        </div>

        <div className="bg-[#0a1628] rounded-lg p-4 border border-[#1e3a5f]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-[#4ade80]" />
              <span className="text-sm font-medium text-white">风速设置</span>
            </div>
            <button
              onClick={() => toggleParamLock('wind')}
              className="p-1 hover:bg-[#1e3a5f] rounded transition-colors"
              disabled={isDisabled}
            >
              {lockedParams.wind ? (
                <Lock className="w-4 h-4 text-yellow-500" />
              ) : (
                <Unlock className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">风速</span>
                <span className="text-sm font-bold text-[#4ade80] font-mono">
                  {windConfig.speed.toFixed(0)} km/h
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={windConfig.speed}
                onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
                disabled={isDisabled || lockedParams.wind}
                className="w-full h-2 bg-[#1e3a5f] rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                  [&::-webkit-slider-thumb]:bg-[#4ade80] [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(74,222,128,0.5)]
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">风向</span>
                <span className="text-sm font-bold text-[#4ade80] font-mono">
                  {windConfig.direction.toFixed(0)}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="15"
                value={windConfig.direction}
                onChange={(e) => setWindDirection(parseFloat(e.target.value))}
                disabled={isDisabled || lockedParams.wind}
                className="w-full h-2 bg-[#1e3a5f] rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                  [&::-webkit-slider-thumb]:bg-[#4ade80] [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(74,222,128,0.5)]
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            来源: {windConfig.source} | ID: {windConfig.id.slice(0, 6)}
          </div>
        </div>
      </div>

      <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
        <div className="text-xs text-gray-400 mb-2">物理公式参考</div>
        <div className="space-y-1 text-[10px] font-mono text-gray-500">
          <div>F<sub>d</sub> = ½ρv²C<sub>d</sub>A</div>
          <div>F<sub>df</sub> = -½ρv²C<sub>l</sub>A</div>
          <div>μ = μ<sub>0</sub> + 0.3·(F<sub>df</sub>/mg)</div>
        </div>
      </div>
    </div>
  );
};
