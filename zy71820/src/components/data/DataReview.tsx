import { useState } from 'react';
import { CheckCircle, XCircle, Eye, AlertTriangle, User, Calendar } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { getSourceTypeLabel } from '@/services/AnomalyService';
import { formatDate, formatNumber } from '@/utils/helpers';
import type { PlayerScore, LevelConfig } from '@/types/data';

interface DataReviewProps {
  scores: PlayerScore[];
  levels: LevelConfig[];
  isLoading: boolean;
  selectedScore: PlayerScore | null;
  onSelectScore: (score: PlayerScore | null) => void;
  onReview: (scoreId: string, isApproved: boolean, note: string) => Promise<void>;
}

export function DataReview({
  scores,
  levels: _levels,
  isLoading,
  selectedScore: _selectedScore,
  onSelectScore,
  onReview,
}: DataReviewProps) {
  const { showError, showSuccess, openModal } = useUIStore();
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingScores = scores.filter((s) => s.status === 'pending');

  const handleReview = async (score: PlayerScore, isApproved: boolean) => {
    setIsSubmitting(true);
    try {
      await onReview(score.id, isApproved, reviewNote);
      showSuccess(isApproved ? '已通过复核' : '已驳回该记录');
      onSelectScore(null);
      setReviewNote('');
    } catch (error) {
      showError({
        code: 'UNKNOWN_ERROR',
        message: '复核操作失败',
        suggestion: '请重试或联系技术支持',
        contact: '联系技术组 @技术支持',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewModal = (score: PlayerScore) => {
    onSelectScore(score);
    setReviewNote('');
    openModal({
      title: '复核分数记录',
      onConfirm: () => handleReview(score, true),
      onCancel: () => handleReview(score, false),
      confirmText: '✓ 通过',
      cancelText: '✗ 驳回',
      children: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">玩家：</span>
              <span className="text-white font-medium">{score.playerName}</span>
            </div>
            <div>
              <span className="text-gray-400">分数：</span>
              <span className="text-neon-orange font-bold">{formatNumber(score.score)}</span>
            </div>
            <div>
              <span className="text-gray-400">满意度：</span>
              <span className="text-neon-green">{Math.floor(score.satisfaction)}%</span>
            </div>
            <div>
              <span className="text-gray-400">提交时间：</span>
              <span className="text-white">{formatDate(score.createdAt)}</span>
            </div>
          </div>

          {score.anomalyDetail && (
            <div className="bg-neon-pink/10 rounded-xl p-4 border border-neon-pink/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-neon-pink" />
                <span className="text-neon-pink font-medium">异常信息</span>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">{score.anomalyDetail.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">来源：</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    score.anomalyDetail.sourceType === 'level_draft'
                      ? 'bg-neon-blue/20 text-neon-blue'
                      : 'bg-neon-yellow/20 text-neon-yellow'
                  }`}>
                    {getSourceTypeLabel(score.anomalyDetail.sourceType)}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">
                  置信度：{Math.floor(score.anomalyDetail.confidence * 100)}%
                </p>
                <p className="text-gray-400 text-xs">
                  联系人：{score.anomalyDetail.contact}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">复核备注（可选）</label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="请输入复核备注..."
              className="w-full px-4 py-3 bg-night-card border border-night-card rounded-xl text-white placeholder-gray-500 focus:border-neon-orange/50 focus:outline-none transition-colors resize-none"
              rows={3}
            />
          </div>
        </div>
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-neon-orange">
          待复核记录 ({pendingScores.length})
        </h3>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-neon-orange border-t-transparent rounded-full mx-auto mb-4" />
          <p className="font-body text-gray-400">加载中...</p>
        </div>
      ) : pendingScores.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle size={48} className="mx-auto text-neon-green mb-4 opacity-50" />
          <p className="font-body text-gray-400">暂无待复核的记录</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-night-card">
                <th className="pb-3 font-body font-medium">玩家</th>
                <th className="pb-3 font-body font-medium">分数</th>
                <th className="pb-3 font-body font-medium">满意度</th>
                <th className="pb-3 font-body font-medium">异常来源</th>
                <th className="pb-3 font-body font-medium">提交时间</th>
                <th className="pb-3 font-body font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingScores.map((score) => (
                <tr
                  key={score.id}
                  className="border-b border-night-card/50 hover:bg-night-card/30 transition-colors"
                >
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-gray-500" />
                      <span className="font-body text-white">{score.playerName}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="font-display text-neon-orange text-lg">
                      {formatNumber(score.score)}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="font-body text-neon-green">
                      {Math.floor(score.satisfaction)}%
                    </span>
                  </td>
                  <td className="py-4">
                    {score.anomalyDetail && (
                      <span
                        className={`px-2 py-1 rounded text-xs bg-neon-yellow/20 text-neon-yellow border-neon-yellow/50 border`}
                      >
                        {getSourceTypeLabel(score.anomalyDetail.sourceType)}
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar size={14} />
                      {formatDate(score.createdAt)}
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openReviewModal(score)}
                        disabled={isSubmitting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neon-orange/20 hover:bg-neon-orange/30 text-neon-orange text-sm transition-colors disabled:opacity-50"
                      >
                        <Eye size={14} />
                        复核
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-night-card rounded-xl p-4">
        <h4 className="font-display text-neon-orange mb-2">📝 复核说明</h4>
        <div className="space-y-2 text-sm text-gray-400 font-body">
          <p>• <span className="text-neon-blue">关卡草表</span>来源的异常：请联系 @关卡策划 确认配置是否合理</p>
          <p>• <span className="text-neon-yellow">玩家反馈</span>来源的异常：请联系 @玩家反馈专员 核实情况</p>
          <p>• 复核通过：分数将转为正常状态，计入排行榜</p>
          <p>• 复核驳回：分数将被标记为已驳回，不计入统计</p>
        </div>
      </div>
    </div>
  );
}
