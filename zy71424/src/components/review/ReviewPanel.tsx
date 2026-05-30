import React, { useState } from 'react';
import { X, Award, TrendingUp, Clock, Target, AlertCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { calculateGameStats, getGrade } from '@/engine/scoringEngine';
import { formatTime, getEventTypeLabel } from '@/engine/evidenceRecorder';
import { Timeline } from './Timeline';
import { EvidenceCard } from './EvidenceCard';

export const ReviewPanel: React.FC = () => {
  const showReview = useGameStore(state => state.showReview);
  const toggleReview = useGameStore(state => state.toggleReview);
  const score = useGameStore(state => state.score);
  const events = useGameStore(state => state.events);
  const actionLogs = useGameStore(state => state.actionLogs);
  const evidenceChains = useGameStore(state => state.evidenceChains);
  const totalDuration = useGameStore(state => state.totalDuration);
  const selectedEvidenceId = useGameStore(state => state.selectedEvidenceId);
  const selectEvidence = useGameStore(state => state.selectEvidence);

  const [activeTab, setActiveTab] = useState<'summary' | 'timeline' | 'evidence'>('summary');

  const stats = calculateGameStats(events, totalDuration);
  const gradeInfo = getGrade(score);

  if (!showReview) return null;

  const selectedEvidence = evidenceChains.find(e => e.id === selectedEvidenceId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="text-yellow-400" size={24} />
            <h2 className="text-xl font-bold text-white">演出复盘</h2>
          </div>
          <button
            onClick={toggleReview}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-700 flex gap-2">
          {[
            { id: 'summary', label: '摘要', icon: TrendingUp },
            { id: 'timeline', label: '时间线', icon: Clock },
            { id: 'evidence', label: '证据链', icon: Target },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className={`text-8xl font-bold ${gradeInfo.color} mb-2`}>
                  {gradeInfo.grade}
                </div>
                <div className="text-2xl text-white font-semibold">
                  {score.toFixed(0)} 分
                </div>
                <p className="text-gray-400 mt-2">{gradeInfo.message}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-white">{stats.totalEvents}</div>
                  <div className="text-sm text-gray-400 mt-1">总事件数</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{stats.resolvedEvents}</div>
                  <div className="text-sm text-gray-400 mt-1">已处理</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{stats.missedEvents}</div>
                  <div className="text-sm text-gray-400 mt-1">未处理</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">{stats.avgResponseTime}s</div>
                  <div className="text-sm text-gray-400 mt-1">平均响应</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">问题类型分布</h3>
                <div className="space-y-3">
                  {[
                    { label: '音量失衡', count: stats.imbalanceCount, color: 'bg-yellow-500' },
                    { label: '返听请求', count: stats.monitorMissCount, color: 'bg-blue-500' },
                    { label: '啸叫事件', count: stats.feedbackCount, color: 'bg-red-500' },
                    { label: '主输出爆峰', count: stats.clippingCount, color: 'bg-orange-500' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-24 text-sm text-gray-400">{item.label}</div>
                      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} transition-all`}
                          style={{ width: `${stats.totalEvents > 0 ? (item.count / stats.totalEvents) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm text-white font-mono">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-white font-medium">导师建议</h4>
                    <p className="text-sm text-gray-300 mt-1">
                      {score >= 80
                        ? '表现优秀！继续保持对突发问题的快速响应能力。建议关注细节处理，特别是返听调整的准确性。'
                        : score >= 60
                        ? '基本合格，但需要提升响应速度。建议多练习快速定位问题声道，熟悉推子操作。'
                        : '需要加强基础训练。建议先熟悉各声道功能，再逐步提升处理速度。可以从复盘时间线入手，分析每次失误的原因。'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <Timeline events={events} actions={actionLogs} />
          )}

          {activeTab === 'evidence' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">证据链列表</h3>
                <div className="space-y-3">
                  {evidenceChains.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">暂无证据链记录</div>
                  ) : (
                    evidenceChains.map(chain => (
                      <button
                        key={chain.id}
                        onClick={() => selectEvidence(chain.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          selectedEvidenceId === chain.id
                            ? 'bg-blue-900/30 border-blue-500'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">
                              {getEventTypeLabel(chain.eventType)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatTime(chain.startTime)} - {chain.endTime ? formatTime(chain.endTime) : '进行中'}
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            chain.conclusion === 'resolved'
                              ? 'bg-green-900/50 text-green-400'
                              : chain.conclusion === 'missed'
                              ? 'bg-red-900/50 text-red-400'
                              : 'bg-yellow-900/50 text-yellow-400'
                          }`}>
                            {chain.conclusion === 'resolved' ? '已解决' : chain.conclusion === 'missed' ? '遗漏' : '处理中'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          关联操作: {chain.actions.length} 次 | 关联事件: {chain.events.length} 个
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">证据详情</h3>
                {selectedEvidence ? (
                  <EvidenceCard evidence={selectedEvidence} />
                ) : (
                  <div className="text-center text-gray-500 py-8">选择左侧证据链查看详情</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
