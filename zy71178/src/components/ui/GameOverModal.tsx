import { useNavigate } from 'react-router-dom';
import { Score, GameEvent } from '../../types/game';
import { formatTime } from '../../game/engine';
import { ScoreBoard } from './ScoreBoard';
import { Trophy, Home, RotateCcw, Download, FileText } from 'lucide-react';

interface GameOverModalProps {
  score: Score;
  events: GameEvent[];
  gameTime: number;
  levelId: string;
  recordId: string | null;
  onRestart: () => void;
}

export function GameOverModal({
  score,
  events,
  gameTime,
  levelId,
  recordId,
  onRestart,
}: GameOverModalProps) {
  const navigate = useNavigate();

  const collisionEvents = events.filter((e) => e.type === 'collision');
  const timeoutEvents = events.filter((e) => e.type === 'order_timeout');
  const batteryEvents = events.filter((e) => e.type === 'battery_dead');

  const exportReport = () => {
    const report = {
      levelId,
      recordId,
      gameTime: formatTime(gameTime),
      score,
      summary: {
        collisions: collisionEvents.length,
        timeouts: timeoutEvents.length,
        batteryFailures: batteryEvents.length,
        totalEvents: events.length,
      },
      events: events.map((e) => ({
        time: formatTime(e.timestamp),
        type: e.type,
        data: e.data,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-game-report-${recordId || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl p-8 max-w-2xl w-full mx-4 border border-gray-700 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
              <Trophy className="w-16 h-16 text-yellow-400" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">游戏结束</h2>
          <p className="text-gray-400">
            总用时: <span className="text-white font-mono">{formatTime(gameTime)}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ScoreBoard score={score} />

          <div className="p-4 rounded-lg bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              事件统计
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">机器人碰撞</span>
                <span className={`font-semibold ${collisionEvents.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {collisionEvents.length} 次
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">订单超时</span>
                <span className={`font-semibold ${timeoutEvents.length > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                  {timeoutEvents.length} 次
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">电量耗尽</span>
                <span className={`font-semibold ${batteryEvents.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {batteryEvents.length} 次
                </span>
              </div>
            </div>
          </div>
        </div>

        {collisionEvents.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-700/50">
            <h4 className="text-sm font-semibold text-red-400 mb-2">失败原因分析</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              {collisionEvents.length > 0 && (
                <li>• 发生了 {collisionEvents.length} 次机器人碰撞，建议优化调度顺序</li>
              )}
              {timeoutEvents.length > 0 && (
                <li>• {timeoutEvents.length} 个订单超时，建议优先处理紧急订单</li>
              )}
              {batteryEvents.length > 0 && (
                <li>• {batteryEvents.length} 台机器人电量耗尽，注意及时充电</li>
              )}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={onRestart}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            再来一局
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            导出报告
          </button>
          {recordId && (
            <button
              onClick={() => navigate(`/report/${recordId}`)}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              查看回放
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
