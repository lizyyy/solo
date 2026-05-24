import { Wrench, ScrollText, Clock, Zap } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { TEAM_STATUS_CONFIG } from '../../game/config';

export function RightPanel() {
  const { teams, selectedTeam, selectTeam, events, nodes } = useGameStore();

  return (
    <div className="absolute right-4 top-20 bottom-20 w-64 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden flex flex-col z-10">
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-orange-400" />
          <span className="text-white font-semibold">抢修队伍</span>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {teams.map(team => {
          const statusConfig = TEAM_STATUS_CONFIG[team.status];
          const isSelected = selectedTeam === team.id;
          const canAssign = team.status === 'idle';

          return (
            <div
              key={team.id}
              className={`p-3 rounded cursor-pointer transition-all ${
                isSelected
                  ? 'bg-slate-600 ring-2 ring-yellow-400'
                  : canAssign
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-slate-800/50 opacity-70'
              }`}
              onClick={() => canAssign && selectTeam(isSelected ? null : team.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">{team.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: statusConfig.color + '30', color: statusConfig.color }}
                >
                  {statusConfig.name}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>效率: {(team.efficiency * 100).toFixed(0)}%</span>
                </div>
                {team.status === 'cooling' && team.cooldown > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>休整: {team.cooldown}回合</span>
                  </div>
                )}
              </div>

              {team.currentTarget && (
                <div className="mt-2 text-xs text-slate-400">
                  目标: {nodes.find(n => n.id === team.currentTarget)?.name || team.currentTarget}
                </div>
              )}

              {team.status === 'repairing' && (
                <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 animate-pulse" style={{ width: '60%' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-700 flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold text-sm">事件日志</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {events.slice(-15).reverse().map((event, index) => (
            <div
              key={event.id}
              className={`text-xs p-2 rounded ${
                event.type === 'defeat'
                  ? 'bg-red-900/30 text-red-300'
                  : event.type === 'victory'
                  ? 'bg-green-900/30 text-green-300'
                  : event.type === 'repair_complete'
                  ? 'bg-green-900/20 text-green-400'
                  : event.type === 'damage'
                  ? 'bg-red-900/20 text-red-400'
                  : event.type === 'weather_change'
                  ? 'bg-blue-900/20 text-blue-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
              style={{ opacity: 1 - index * 0.05 }}
            >
              <div className="flex items-center gap-1">
                <span className="text-slate-500">[回合{event.turn}]</span>
              </div>
              <div>{event.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
