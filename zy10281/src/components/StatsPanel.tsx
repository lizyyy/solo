import React from 'react';
import type { ProgressStats, BusinessPhase } from '../types';

interface StatsPanelProps {
  stats: ProgressStats;
  currentPhase: BusinessPhase;
}

const phaseLabels: Record<BusinessPhase, string> = {
  preparation: '准备阶段',
  signing: '签字阶段',
  publicity: '公示阶段',
  implementation: '实施阶段',
  completed: '已完成',
};

const phaseColors: Record<BusinessPhase, string> = {
  preparation: 'bg-gray-500',
  signing: 'bg-blue-500',
  publicity: 'bg-yellow-500',
  implementation: 'bg-green-500',
  completed: 'bg-purple-500',
};

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, currentPhase }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">进度概览</h2>
        <span className={`px-3 py-1 rounded-full text-white text-sm ${phaseColors[currentPhase]}`}>
          {phaseLabels[currentPhase]}
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
          <div className="text-3xl font-bold text-blue-600">{stats.agreeCount}</div>
          <div className="text-sm text-blue-500">同意户数</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg">
          <div className="text-3xl font-bold text-red-600">{stats.disagreeCount}</div>
          <div className="text-sm text-red-500">不同意户数</div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg">
          <div className="text-3xl font-bold text-gray-600">{stats.pendingCount}</div>
          <div className="text-sm text-gray-500">未签字户数</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
          <div className="text-3xl font-bold text-orange-600">{stats.unresolvedObjectionCount}</div>
          <div className="text-sm text-orange-500">待处理异议</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">签字率</span>
            <span className="font-medium text-gray-800">{stats.signedRate.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.signedRate}%` }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">同意率</span>
            <span className="font-medium text-gray-800">{stats.agreeRate.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                stats.agreeRate >= 75 ? 'bg-green-500' : stats.agreeRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${stats.agreeRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">总户数</span>
          <span className="font-medium">{stats.totalHouseholds} 户</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-gray-500">已签字</span>
          <span className="font-medium">{stats.signedCount} 户</span>
        </div>
      </div>
    </div>
  );
};
