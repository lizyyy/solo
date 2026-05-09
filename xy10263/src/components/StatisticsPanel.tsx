import { BarChart3, Users, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../store/context';

const STATUS_COLORS: Record<string, string> = {
  found: 'bg-slate-500',
  analyzed: 'bg-blue-500',
  unresolved: 'bg-yellow-500',
  resolved: 'bg-emerald-500',
};

const STATUS_LABELS: Record<string, string> = {
  found: '发现',
  analyzed: '已分析',
  unresolved: '未解决',
  resolved: '已解决',
};

const TYPE_COLORS: Record<string, string> = {
  physical: 'bg-slate-500',
  testimony: 'bg-blue-500',
  document: 'bg-purple-500',
  special: 'bg-amber-500',
};

const TYPE_LABELS: Record<string, string> = {
  physical: '物证',
  testimony: '证词',
  document: '文档',
  special: '特殊',
};

export function StatisticsPanel() {
  const { workspace, statistics } = useWorkspace();

  const getPlayerName = (playerId: string) => {
    const player = workspace.players.find(p => p.id === playerId);
    return player ? player.name : '未知';
  };

  const getPlayerColor = (playerId: string) => {
    const player = workspace.players.find(p => p.id === playerId);
    return player?.color || '#64748b';
  };

  const maxCluesByPlayer = Math.max(
    ...Object.values(statistics.cluesByPlayer),
    1
  );

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">统计概览</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <FileText className="w-4 h-4" />
            <span>总线索</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {statistics.totalClues}
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Users className="w-4 h-4" />
            <span>玩家数</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {workspace.players.length}
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Clock className="w-4 h-4" />
            <span>时间覆盖</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {statistics.timelineCoverage}%
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <AlertCircle className="w-4 h-4" />
            <span>待处理</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {statistics.conflictsTotal - statistics.conflictsResolved + statistics.gapsTotal}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">玩家线索分布</h3>
          <div className="space-y-2">
            {workspace.players.length === 0 ? (
              <p className="text-sm text-slate-500">暂无玩家数据</p>
            ) : (
              workspace.players.map((player) => {
                const count = statistics.cluesByPlayer[player.id] || 0;
                const percentage = maxCluesByPlayer > 0 ? (count / maxCluesByPlayer) * 100 : 0;
                
                return (
                  <div key={player.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{player.name} ({player.role})</span>
                      <span className="text-slate-400">{count} 条</span>
                    </div>
                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: player.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">线索状态</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(statistics.cluesByStatus).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg"
              >
                <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`} />
                <span className="text-sm text-slate-300">{STATUS_LABELS[status]}</span>
                <span className="text-sm font-medium text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">线索类型</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(statistics.cluesByType).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg"
              >
                <div className={`w-3 h-3 rounded-full ${TYPE_COLORS[type]}`} />
                <span className="text-sm text-slate-300">{TYPE_LABELS[type]}</span>
                <span className="text-sm font-medium text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">冲突处理</span>
            <div className="flex items-center gap-2">
              {statistics.conflictsResolved === statistics.conflictsTotal && statistics.conflictsTotal > 0 ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : null}
              <span className="text-white">
                {statistics.conflictsResolved}/{statistics.conflictsTotal}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
