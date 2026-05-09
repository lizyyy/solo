import { useMemo } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../store/context';
import { sortCluesByTimeline } from '../utils/analyzer';

export function TimelinePanel() {
  const { workspace, statistics } = useWorkspace();

  const timelineData = useMemo(() => {
    const sorted = sortCluesByTimeline(workspace.clues);
    if (sorted.length === 0) return { groups: [], allTimes: [] };

    const timeGroups = new Map<number, typeof sorted>();
    for (const clue of sorted) {
      const group = timeGroups.get(clue.timelineTime) || [];
      timeGroups.set(clue.timelineTime, [...group, clue]);
    }

    const minTime = sorted[0].timelineTime;
    const maxTime = sorted[sorted.length - 1].timelineTime;
    const allTimes: number[] = [];
    for (let t = minTime; t <= maxTime; t++) {
      allTimes.push(t);
    }

    return { groups: timeGroups, allTimes };
  }, [workspace.clues]);

  const getPlayerName = (playerId: string) => {
    const player = workspace.players.find(p => p.id === playerId);
    return player ? player.name : '未知';
  };

  const getPlayerColor = (playerId: string) => {
    const player = workspace.players.find(p => p.id === playerId);
    return player?.color || '#64748b';
  };

  if (workspace.clues.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">时间轴</h2>
        </div>
        <div className="text-center py-12 text-slate-400">
          <p>暂无时间轴数据</p>
          <p className="text-sm mt-1">添加线索并设置时间点后将显示时间线</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">时间轴</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            覆盖: <span className="text-emerald-400">{statistics.timelineCoverage}%</span>
          </span>
          <span className="text-slate-400">
            时间点: <span className="text-white">{timelineData.allTimes.length}</span>
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {timelineData.allTimes.map((time) => {
            const cluesAtTime = timelineData.groups.get(time) || [];
            const hasClues = cluesAtTime.length > 0;

            return (
              <div key={time} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      hasClues
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-slate-400 border-2 border-dashed border-slate-600'
                    }`}
                  >
                    {time}
                  </div>
                  {time < timelineData.allTimes[timelineData.allTimes.length - 1] && (
                    <div
                      className={`w-0.5 flex-1 min-h-8 ${
                        hasClues ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  {hasClues ? (
                    <div className="space-y-2">
                      {cluesAtTime.map((clue) => (
                        <div
                          key={clue.id}
                          className="p-3 bg-slate-900 rounded-lg border-l-4"
                          style={{ borderLeftColor: getPlayerColor(clue.playerId) }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium text-sm">{clue.title}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                              {getPlayerName(clue.playerId)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2">{clue.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                      <div className="flex items-center gap-2 text-slate-500">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">此时间点无线索，建议补充</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
