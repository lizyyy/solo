import React from 'react';
import { Clock, Users, AlertTriangle, CheckCircle, XCircle, Timer } from 'lucide-react';
import { GameStats, ScoreBreakdown } from '../game/types';
import { formatTime } from '../utils/export';

interface StatusMonitorProps {
  remainingTime: number;
  totalDuration: number;
  stats: GameStats;
  scores: ScoreBreakdown;
  pendingReview: number;
}

const StatusMonitor: React.FC<StatusMonitorProps> = ({
  remainingTime,
  totalDuration,
  stats,
  scores,
  pendingReview
}) => {
  const progress = ((totalDuration - remainingTime) / totalDuration) * 100;
  const isUrgent = remainingTime <= 30;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-vip';
    return 'text-warning';
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <div className={`p-4 rounded-xl ${isUrgent ? 'bg-warning/20 animate-pulse-fast' : 'bg-navy-700'}`}>
        <div className="flex items-center gap-3 mb-2">
          <Timer className={`w-6 h-6 ${isUrgent ? 'text-warning' : 'text-white'}`} />
          <div className="flex-1">
            <div className="text-sm text-gray-400">距离开演</div>
            <div className={`text-3xl font-bold mono-font ${isUrgent ? 'text-warning' : ''}`}>
              {formatTime(remainingTime)}
            </div>
          </div>
        </div>
        <div className="w-full bg-navy-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              isUrgent ? 'bg-warning' : 'bg-success'
            }`}
            style={{ width: `${100 - progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-navy-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">已安检</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalScanned}</div>
        </div>
        <div className="p-3 bg-navy-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-xs text-gray-400">已放行</span>
          </div>
          <div className="text-2xl font-bold text-success">{stats.totalPassed}</div>
        </div>
        <div className="p-3 bg-navy-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-warning" />
            <span className="text-xs text-gray-400">已拦截</span>
          </div>
          <div className="text-2xl font-bold text-warning">{stats.totalBlocked}</div>
        </div>
        <div className="p-3 bg-navy-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-vip" />
            <span className="text-xs text-gray-400">待核对</span>
          </div>
          <div className="text-2xl font-bold text-vip">{pendingReview}</div>
        </div>
      </div>

      <div className="p-4 bg-navy-700 rounded-xl">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          实时评分
        </h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">安检准确率</span>
              <span className={getScoreColor(scores.accuracy)}>{scores.accuracy}分</span>
            </div>
            <div className="w-full bg-navy-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-success" style={{ width: `${scores.accuracy}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">通行效率</span>
              <span className={getScoreColor(scores.efficiency)}>{scores.efficiency}分</span>
            </div>
            <div className="w-full bg-navy-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${scores.efficiency}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">VIP服务</span>
              <span className={getScoreColor(scores.vipService)}>{scores.vipService}分</span>
            </div>
            <div className="w-full bg-navy-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-vip" style={{ width: `${scores.vipService}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">应急处置</span>
              <span className={getScoreColor(scores.emergency)}>{scores.emergency}分</span>
            </div>
            <div className="w-full bg-navy-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-purple-400" style={{ width: `${scores.emergency}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-navy-700 rounded-xl">
        <h4 className="font-medium mb-2">违禁品统计</h4>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">已发现</div>
            <div className="text-xl font-bold text-success">{stats.contrabandFound}</div>
          </div>
          <div className="text-2xl">⚖️</div>
          <div>
            <div className="text-sm text-gray-400">已漏检</div>
            <div className="text-xl font-bold text-warning">{stats.contrabandMissed}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusMonitor;
