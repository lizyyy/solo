import { Trophy, AlertTriangle, TrendingUp, MapPin, Clock, Star } from 'lucide-react';
import type { GameRecord, GameEvent } from '@/game/types';
import { LEVELS } from '@/game/levels';

interface ReportViewerProps {
  record: GameRecord;
}

const eventColors: Record<string, string> = {
  move: 'text-green-400 bg-green-400/10',
  door_open: 'text-emerald-400 bg-emerald-400/10',
  humidity: 'text-blue-400 bg-blue-400/10',
  humidity_damage: 'text-blue-500 bg-blue-500/10',
  congestion: 'text-orange-400 bg-orange-400/10',
  alert: 'text-yellow-400 bg-yellow-400/10',
  guard_spotted: 'text-red-500 bg-red-500/10',
  item_used: 'text-purple-400 bg-purple-400/10',
  timeout: 'text-gray-400 bg-gray-400/10',
  door_permission_denied: 'text-red-400 bg-red-400/10',
  wrong_operation: 'text-red-400 bg-red-400/10',
  resource_waste: 'text-yellow-500 bg-yellow-500/10',
  door_blocked: 'text-red-400 bg-red-400/10',
  success: 'text-emerald-500 bg-emerald-500/10',
};

const eventLabels: Record<string, string> = {
  move: '移动',
  door_open: '开门',
  humidity: '湿度警告',
  humidity_damage: '湿度损坏',
  congestion: '拥堵',
  alert: '警报',
  guard_spotted: '被发现',
  item_used: '使用道具',
  timeout: '超时',
  door_permission_denied: '权限不足',
  wrong_operation: '操作错误',
  resource_waste: '资源浪费',
  door_blocked: '门被阻挡',
  success: '成功',
};

const ratingColors: Record<string, string> = {
  S: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  A: 'text-green-400 bg-green-400/10 border-green-400/30',
  B: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  C: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  D: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export default function ReportViewer({ record }: ReportViewerProps) {
  const level = LEVELS.find((l) => l.id.toString() === record.levelId);

  const eventSummary = record.events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const penaltyEvents = record.events.filter(
    (e) => e.scoreChange < 0
  );

  const bonusEvents = record.events.filter(
    (e) => e.scoreChange > 0
  );

  const totalPenalty = penaltyEvents.reduce((sum, e) => sum + e.scoreChange, 0);
  const totalBonus = bonusEvents.reduce((sum, e) => sum + e.scoreChange, 0);

  const getScoreColor = (score: number) => {
    if (score > 0) return 'text-museum-success';
    if (score < 0) return 'text-museum-danger';
    return 'text-museum-bgLighter';
  };

  return (
    <div className="hud-panel h-[350px] flex flex-col">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-museum-bgLighter/30">
        <Trophy className="w-6 h-6 text-museum-accent" />
        <h3 className="text-lg font-semibold text-white">游戏报告</h3>
        <div className="flex-1" />
        <div className={`px-3 py-1 rounded-lg border ${ratingColors[record.rating]}`}>
          <span className="font-bold text-lg">{record.rating}</span>
          <span className="text-xs ml-1 opacity-70">评级</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-museum-bg/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-museum-bgLighter text-xs mb-1">
            <Star className="w-3 h-3" />
            总得分
          </div>
          <div className="text-2xl font-bold text-museum-accent">
            {record.totalScore}
          </div>
        </div>
        <div className="bg-museum-bg/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-museum-bgLighter text-xs mb-1">
            <TrendingUp className="w-3 h-3 text-museum-success" />
            奖励分
          </div>
          <div className="text-2xl font-bold text-museum-success">
            +{totalBonus}
          </div>
        </div>
        <div className="bg-museum-bg/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-museum-bgLighter text-xs mb-1">
            <AlertTriangle className="w-3 h-3 text-museum-danger" />
            扣分数
          </div>
          <div className="text-2xl font-bold text-museum-danger">
            {totalPenalty}
          </div>
        </div>
        <div className="bg-museum-bg/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-museum-bgLighter text-xs mb-1">
            <Clock className="w-3 h-3" />
            总回合
          </div>
          <div className="text-2xl font-bold text-white">
            {record.totalRounds}
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium text-museum-accent mb-2">事件统计</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(eventSummary).map(([type, count]) => (
              <div
                key={type}
                className={`px-2 py-1 rounded text-xs ${eventColors[type] || 'bg-gray-400/10 text-gray-400'}`}
              >
                {eventLabels[type] || type}: {count}
              </div>
            ))}
          </div>
        </div>

        <div className="w-px bg-museum-bgLighter/30" />

        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium text-museum-accent mb-2">详细事件</h4>
          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {record.events.length === 0 ? (
              <div className="text-museum-bgLighter text-sm text-center py-4">
                暂无事件记录
              </div>
            ) : (
              record.events.map((event: GameEvent, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-museum-bg/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-museum-bgLighter w-8">
                      R{event.round}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${eventColors[event.type]?.split(' ')[0] || 'bg-gray-400'}`} />
                    <span className="text-gray-300">
                      {event.description || event.message || eventLabels[event.type] || event.type}
                    </span>
                  </div>
                  <span className={`font-medium ${getScoreColor(event.scoreChange)}`}>
                    {event.scoreChange > 0 ? '+' : ''}{event.scoreChange}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-museum-bgLighter/30 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-museum-bgLighter">
          <MapPin className="w-4 h-4" />
          <span>{level?.name || `关卡 ${record.levelId}`}</span>
        </div>
        <div className="text-museum-bgLighter">
          {new Date(record.timestamp).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
}
