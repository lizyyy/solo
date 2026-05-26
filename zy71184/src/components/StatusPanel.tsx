import { CloudRain, AlertTriangle, Droplets, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { CONFIG } from '../engine/config';
import { Drain, Lowland, Pump } from '../engine/types';

export function StatusPanel() {
  const { state, history } = useGameStore();

  const drains = state.facilities.filter(f => f.type === 'drain') as Drain[];
  const pumps = state.facilities.filter(f => f.type === 'pump') as Pump[];
  const lowlands = state.facilities.filter(f => f.type === 'lowland') as Lowland[];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      normal: 'bg-green-500',
      warning: 'bg-yellow-500',
      danger: 'bg-red-500',
      broken: 'bg-gray-500',
    };
    const labels: Record<string, string> = {
      normal: '正常',
      warning: '警告',
      danger: '危险',
      broken: '损坏',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs text-white ${colors[status] || 'bg-gray-500'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const latestEvents = history.length > 0 ? history[history.length - 1].events : [];

  return (
    <div className="absolute top-4 right-4 z-10 w-72">
      <AnimatePresence>
        {state.currentRain && (
          <motion.div
            key="current-rain"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-blue-600/90 backdrop-blur-sm rounded-lg p-4 mb-4 shadow-lg"
          >
            <div className="flex items-center gap-2 mb-2">
              <CloudRain className="text-white" size={20} />
              <span className="text-white font-bold">
                {CONFIG.RAIN_INTENSITY_MAP[state.currentRain.intensity].name}进行中
              </span>
            </div>
            <div className="text-blue-100 text-sm">
              持续时间: 还剩 {state.currentRain.startTurn + state.currentRain.duration - state.turn} 回合
            </div>
          </motion.div>
        )}

        {state.forecast.length > 0 && !state.isReplayMode && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 mb-4 shadow-lg border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-blue-400" size={18} />
              <span className="text-gray-300 font-medium text-sm">降雨预报</span>
            </div>
            {state.forecast.map((rain, idx) => (
              <div key={idx} className="text-xs text-gray-400 mb-1">
                第 {rain.startTurn} 回合: {CONFIG.RAIN_INTENSITY_MAP[rain.intensity].name}
              </div>
            ))}
          </motion.div>
        )}

        {latestEvents.length > 0 && (
          <motion.div
            key="events"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-900/80 backdrop-blur-sm rounded-lg p-4 mb-4 shadow-lg border border-orange-700"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-orange-400" size={18} />
              <span className="text-orange-300 font-medium text-sm">事件</span>
            </div>
            {latestEvents.slice(0, 3).map((event, idx) => (
              <div key={idx} className="text-xs text-orange-200 mb-1">
                • {event}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Droplets size={18} className="text-blue-400" />
          设施状态
        </h3>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-400 mb-2">雨水口 ({drains.length})</div>
            <div className="space-y-2">
              {drains.map(drain => (
                <div key={drain.id} className="flex items-center justify-between bg-gray-800 rounded p-2">
                  <span className="text-white text-xs">{drain.id}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${(1 - drain.blockage) * 100}%` }}
                      />
                    </div>
                    {getStatusBadge(drain.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-400 mb-2">泵站 ({pumps.length})</div>
            <div className="space-y-2">
              {pumps.map(pump => (
                <div key={pump.id} className="bg-gray-800 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs">{pump.id}</span>
                    {getStatusBadge(pump.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">负载</span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          pump.currentLoad > 0.9 ? 'bg-red-500' : pump.currentLoad > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${pump.currentLoad * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs">{(pump.currentLoad * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-400 mb-2">低洼点 ({lowlands.length})</div>
            <div className="space-y-2">
              {lowlands.map(lowland => (
                <div key={lowland.id} className="bg-gray-800 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs">{lowland.id}</span>
                    {getStatusBadge(lowland.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">水位</span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          lowland.waterLevel > lowland.maxSafeLevel ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${(lowland.waterLevel / (lowland.maxSafeLevel * 1.5)) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs">{lowland.waterLevel.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
