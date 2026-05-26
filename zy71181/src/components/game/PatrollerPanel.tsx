import { useGameStore } from '../../store/useGameStore';
import { SLOPE_NAMES } from '../../game/data/constants';

export function PatrollerPanel() {
  const { gameState, selectPatroller } = useGameStore();

  const statusColors: Record<string, string> = {
    idle: 'bg-green-500',
    dispatched: 'bg-blue-500',
    returning: 'bg-yellow-500',
  };

  const statusNames: Record<string, string> = {
    idle: '待命',
    dispatched: '执行任务',
    returning: '返回中',
  };

  return (
    <div className="bg-slate-800/90 rounded-lg p-4 backdrop-blur-sm">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <span>👮</span>
        巡逻员
      </h3>

      <div className="space-y-2">
        {gameState.patrollers.map((patroller) => {
          const isSelected = gameState.selectedPatrollerId === patroller.id;
          const canSelect = patroller.status === 'idle';

          return (
            <div
              key={patroller.id}
              onClick={() => canSelect && selectPatroller(patroller.id)}
              className={`p-3 rounded-lg transition-all ${
                isSelected
                  ? 'bg-blue-600 ring-2 ring-blue-400'
                  : canSelect
                  ? 'bg-slate-700 hover:bg-slate-600 cursor-pointer'
                  : 'bg-slate-700/50 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">{patroller.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusColors[patroller.status]}`} />
                  <span className="text-xs text-slate-300">{statusNames[patroller.status]}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">技能等级: </span>
                  <span className="text-slate-200">{'⭐'.repeat(patroller.skillLevel)}</span>
                </div>
                <div>
                  <span className="text-slate-400">速度: </span>
                  <span className="text-slate-200">{patroller.speed}x</span>
                </div>
              </div>

              <div className="mt-2">
                <span className="text-xs text-slate-400">专长: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {patroller.specialties.map((s) => (
                    <span
                      key={s}
                      className="px-1.5 py-0.5 bg-slate-600 rounded text-xs text-slate-200"
                    >
                      {SLOPE_NAMES[s]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
