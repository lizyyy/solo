import React from 'react';
import { Trophy, BarChart3, FileText, RotateCcw, Home } from 'lucide-react';
import { ScoreBreakdown, GameStats, GameEvent } from '../game/types';

interface GameOverModalProps {
  score: number;
  rating: { grade: string; color: string; message: string };
  scores: ScoreBreakdown;
  stats: GameStats;
  events: GameEvent[];
  onReplay: () => void;
  onReport: () => void;
  onRestart: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  rating,
  scores,
  stats,
  events,
  onReplay,
  onReport,
  onRestart
}) => {
  const scoreDetails = [
    { name: '安检准确率', value: scores.accuracy, color: 'bg-success' },
    { name: '通行效率', value: scores.efficiency, color: 'bg-blue-400' },
    { name: 'VIP服务', value: scores.vipService, color: 'bg-vip' },
    { name: '应急处置', value: scores.emergency, color: 'bg-purple-400' }
  ];

  const missedEvents = events.filter(e => e.needReview && e.scoreChange < 0);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-navy-900">
      <div className="max-w-2xl w-full animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold mb-2">本局结束！</h1>
          <p className="text-gray-400">演唱会即将开始，辛苦了！</p>
        </div>

        <div className={`p-8 rounded-2xl border-2 ${
          rating.grade === 'S' ? 'border-yellow-400 bg-yellow-400/10' :
          rating.grade === 'A' ? 'border-success bg-success/10' :
          rating.grade === 'B' ? 'border-blue-400 bg-blue-400/10' :
          rating.grade === 'C' ? 'border-vip bg-vip/10' :
          'border-warning bg-warning/10'
        } mb-6`}>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-7xl font-bold animate-count">{score}</div>
              <p className="text-gray-400 mt-1">最终得分</p>
            </div>
            <div className="text-center">
              <div className={`text-8xl font-black ${rating.color}`}>
                {rating.grade}
              </div>
              <p className={`mt-2 ${rating.color}`}>{rating.message}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {scoreDetails.map(detail => (
            <div key={detail.name} className="bg-navy-800 rounded-xl p-4 text-center">
              <div className="w-full bg-navy-700 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full ${detail.color} transition-all duration-1000`}
                  style={{ width: `${detail.value}%` }}
                />
              </div>
              <div className="text-2xl font-bold">{detail.value}</div>
              <div className="text-xs text-gray-400">{detail.name}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-navy-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{stats.totalScanned}</div>
            <div className="text-xs text-gray-400">已安检</div>
          </div>
          <div className="bg-navy-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-success">{stats.totalPassed}</div>
            <div className="text-xs text-gray-400">已放行</div>
          </div>
          <div className="bg-navy-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-warning">{stats.totalBlocked}</div>
            <div className="text-xs text-gray-400">已拦截</div>
          </div>
          <div className="bg-navy-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-vip">{stats.contrabandFound}</div>
            <div className="text-xs text-gray-400">违禁品</div>
          </div>
        </div>

        {missedEvents.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6">
            <h4 className="font-medium text-warning mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              需要注意的问题 ({missedEvents.length}项)
            </h4>
            <ul className="space-y-1 text-sm text-gray-300">
              {missedEvents.slice(0, 5).map(event => (
                <li key={event.id} className="flex items-start gap-2">
                  <span>•</span>
                  <span>{event.description}</span>
                </li>
              ))}
              {missedEvents.length > 5 && (
                <li className="text-gray-500">还有 {missedEvents.length - 5} 项...</li>
              )}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={onReplay}
            className="py-4 bg-navy-700 hover:bg-navy-600 rounded-xl font-medium 
              transition-colors flex items-center justify-center gap-2"
          >
            <BarChart3 className="w-5 h-5" />
            复盘回放
          </button>
          <button
            onClick={onReport}
            className="py-4 bg-navy-700 hover:bg-navy-600 rounded-xl font-medium 
              transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" />
            查看报告
          </button>
          <button
            onClick={onRestart}
            className="py-4 bg-gradient-to-r from-vip to-warning hover:opacity-90 
              rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            再来一局
          </button>
        </div>

        <button
          onClick={onRestart}
          className="w-full mt-4 py-3 bg-navy-800 hover:bg-navy-700 rounded-xl 
            transition-colors flex items-center justify-center gap-2 text-gray-400"
        >
          <Home className="w-4 h-4" />
          返回主页
        </button>
      </div>
    </div>
  );
};

export default GameOverModal;
