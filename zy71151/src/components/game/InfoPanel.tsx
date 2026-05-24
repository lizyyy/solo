import { GameState } from '../../types';
import { formatTime } from '../../utils/math';

interface InfoPanelProps {
  state: GameState;
}

const gradeColors: Record<string, string> = {
  S: 'text-yellow-400',
  A: 'text-green-400',
  B: 'text-blue-400',
  C: 'text-harbor-300',
  D: 'text-yellow-600',
  F: 'text-red-500',
};

export default function InfoPanel({ state }: InfoPanelProps) {
  const tidePercentage = ((state.tide.currentLevel - state.tide.minLevel) / (state.tide.maxLevel - state.tide.minLevel)) * 100;

  const failReasons: Record<string, string> = {
    collision: '发生碰撞事故',
    fuel_depleted: '燃油耗尽',
    tide_missed: '错过潮汐窗口',
    time_out: '超时',
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-lg p-4">
        <h3 className="font-oswald font-bold text-lg text-white mb-3">评分</h3>
        
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className={`text-4xl font-oswald font-bold ${gradeColors[state.score.grade]}`}>
              {state.score.grade}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono text-white">{state.score.total}</div>
            <div className="text-xs text-harbor-400">总分</div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-harbor-300">
            <span>按时完成:</span>
            <span className="text-green-400">+{state.score.onTimeCompletions}</span>
          </div>
          <div className="flex justify-between text-harbor-300">
            <span>燃油效率:</span>
            <span className="text-blue-400">+{state.score.fuelEfficiency}</span>
          </div>
          <div className="flex justify-between text-harbor-300">
            <span>安全评分:</span>
            <span className={state.score.safetyScore > 50 ? 'text-green-400' : 'text-yellow-400'}>
              +{state.score.safetyScore}
            </span>
          </div>
          <div className="flex justify-between text-harbor-300">
            <span>扣分:</span>
            <span className="text-red-400">-{state.score.penalties}</span>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-lg p-4">
        <h3 className="font-oswald font-bold text-lg text-white mb-3">🌊 潮汐</h3>
        
        <div className="mb-3">
          <div className="flex justify-between text-sm text-harbor-300 mb-1">
            <span>当前水位</span>
            <span className="font-mono text-white">{state.tide.currentLevel.toFixed(1)}m</span>
          </div>
          <div className="h-3 bg-navy-900 rounded-full overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-500"
              style={{ width: `${tidePercentage}%` }}
            />
            <div className="absolute inset-y-0 bg-blue-900/50" style={{ left: '20%', right: '60%' }} />
          </div>
          <div className="flex justify-between text-xs text-harbor-500 mt-1">
            <span>最低 {state.tide.minLevel}m</span>
            <span>最高 {state.tide.maxLevel}m</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-navy-800 rounded p-2">
            <div className="text-harbor-400">下次满潮</div>
            <div className="font-mono text-cyan-400">{formatTime(state.tide.nextHighTime)}</div>
          </div>
          <div className="bg-navy-800 rounded p-2">
            <div className="text-harbor-400">下次干潮</div>
            <div className="font-mono text-blue-400">{formatTime(state.tide.nextLowTime)}</div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-lg p-4">
        <h3 className="font-oswald font-bold text-lg text-white mb-3">🚢 拖轮状态</h3>
        <div className="space-y-2">
          {state.tugs.map((tug) => (
            <div key={tug.id} className="flex items-center gap-2 text-sm">
              <div
                className={`w-3 h-3 rounded-full ${
                  tug.status === 'idle' ? 'bg-harbor-400' :
                  tug.status === 'moving' ? 'bg-blue-400' :
                  tug.status === 'towing' ? 'bg-warning-500' : 'bg-harbor-500'
                }`}
              />
              <span className="font-mono text-harbor-200 flex-1">{tug.name}</span>
              <div className="w-16 h-1.5 bg-navy-900 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    tug.fuel > 30 ? 'bg-green-500' :
                    tug.fuel > 10 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${tug.fuel}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-lg p-4 max-h-48 overflow-y-auto">
        <h3 className="font-oswald font-bold text-lg text-white mb-3">📋 事件日志</h3>
        <div className="space-y-2">
          {state.events.slice().reverse().slice(0, 10).map((event) => (
            <div
              key={event.id}
              className={`text-xs p-2 rounded ${
                event.type === 'success' ? 'bg-green-900/50 text-green-400' :
                event.type === 'warning' ? 'bg-yellow-900/50 text-yellow-400' :
                event.type === 'danger' ? 'bg-red-900/50 text-red-400' :
                'bg-navy-800 text-harbor-300'
              }`}
            >
              <span className="text-harbor-500">[{formatTime(event.time)}]</span> {event.message}
            </div>
          ))}
          {state.events.length === 0 && (
            <div className="text-harbor-500 text-xs">暂无事件</div>
          )}
        </div>
      </div>

      {state.failReason !== 'none' && state.failReason !== 'time_out' && (
        <div className="bg-red-900/80 border border-red-500 rounded-lg p-4">
          <h3 className="font-oswald font-bold text-red-400 mb-2">⚠️ 任务失败</h3>
          <p className="text-red-300 text-sm">{failReasons[state.failReason]}</p>
        </div>
      )}
    </div>
  );
}
