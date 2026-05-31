import { useState } from 'react';
import { Edit2, Save, History, User, Calendar, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { getDataVersions } from '@/services/DataService';
import { getStatusLabel, getStatusColor } from '@/services/AnomalyService';
import { formatDate, formatNumber } from '@/utils/helpers';
import type { PlayerScore, LevelConfig, DataVersion } from '@/types/data';

interface DataCorrectProps {
  scores: PlayerScore[];
  levels: LevelConfig[];
  isLoading: boolean;
  selectedScore: PlayerScore | null;
  onSelectScore: (score: PlayerScore | null) => void;
  onCorrect: (scoreId: string, newScore: number, newSatisfaction: number, reason: string) => Promise<void>;
}

export function DataCorrect({
  scores,
  levels: _levels,
  isLoading,
  selectedScore: _selectedScore,
  onSelectScore,
  onCorrect,
}: DataCorrectProps) {
  const { showError, showSuccess, openModal, closeModal } = useUIStore();
  const [editingScore, setEditingScore] = useState<PlayerScore | null>(null);
  const [newScore, setNewScore] = useState(0);
  const [newSatisfaction, setNewSatisfaction] = useState(100);
  const [correctReason, setCorrectReason] = useState('');
  const [versions, setVersions] = useState<DataVersion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const correctableScores = scores.filter(
    (s) => s.status === 'normal' || s.status === 'corrected' || s.status === 'pending'
  );

  const handleEdit = (score: PlayerScore) => {
    setEditingScore(score);
    setNewScore(score.score);
    setNewSatisfaction(score.satisfaction);
    setCorrectReason('');
  };

  const handleViewHistory = async (score: PlayerScore) => {
    try {
      const dataVersions = await getDataVersions('player_score', score.id);
      setVersions(dataVersions);
      onSelectScore(score);
      openModal({
        title: '版本历史',
        confirmText: '关闭',
        children: (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {dataVersions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">暂无历史版本</p>
            ) : (
              dataVersions.map((version, index) => {
                const snapshot = version.snapshot as PlayerScore;
                return (
                  <div
                    key={version.id}
                    className={`p-4 rounded-xl border ${
                      index === 0
                        ? 'bg-neon-orange/10 border-neon-orange/30'
                        : 'bg-night-card border-night-card'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-display ${
                        index === 0 ? 'text-neon-orange' : 'text-white'
                      }`}>
                        v{version.version} {index === 0 && '(当前)'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(version.createdAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">分数：</span>
                        <span className="text-neon-orange font-medium">
                          {formatNumber(snapshot.score)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">满意度：</span>
                        <span className="text-neon-green">
                          {Math.floor(snapshot.satisfaction)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">状态：</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(
                            snapshot.status
                          )}`}
                        >
                          {getStatusLabel(snapshot.status)}
                        </span>
                      </div>
                      {snapshot.reviewNote && (
                        <div className="col-span-2">
                          <span className="text-gray-400">备注：</span>
                          <span className="text-gray-300">{snapshot.reviewNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ),
      });
    } catch (error) {
      showError({
        code: 'UNKNOWN_ERROR',
        message: '获取版本历史失败',
        suggestion: '请重试或联系技术支持',
        contact: '联系技术组 @技术支持',
      });
    }
  };

  const handleSave = async () => {
    if (!editingScore) return;
    if (!correctReason.trim()) {
      showError({
        code: 'INVALID_OPERATION',
        message: '请填写修正原因',
        suggestion: '修正数据必须注明原因，方便后续追溯',
        contact: '联系运营组 @活动负责人',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onCorrect(
        editingScore.id,
        newScore,
        newSatisfaction,
        correctReason
      );
      showSuccess('数据已修正');
      setEditingScore(null);
      closeModal();
    } catch (error) {
      showError({
        code: 'UNKNOWN_ERROR',
        message: '修正操作失败',
        suggestion: '请重试或联系技术支持',
        contact: '联系技术组 @技术支持',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCorrectModal = () => {
    if (!editingScore) return;
    openModal({
      title: '修正分数记录',
      onConfirm: handleSave,
      onCancel: () => {
        setEditingScore(null);
        closeModal();
      },
      confirmText: '保存修正',
      cancelText: '取消',
      children: (
        <div className="space-y-4">
          <div className="bg-night-card rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-400">玩家：</span>
                <span className="text-white font-medium">{editingScore.playerName}</span>
              </div>
              <div>
                <span className="text-gray-400">当前状态：</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(
                    editingScore.status
                  )}`}
                >
                  {getStatusLabel(editingScore.status)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400 line-through">原分数：</span>
                <span className="text-gray-500 line-through ml-1">
                  {formatNumber(editingScore.score)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 line-through">原满意度：</span>
                <span className="text-gray-500 line-through ml-1">
                  {Math.floor(editingScore.satisfaction)}%
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              新分数 <span className="text-neon-pink">*</span>
            </label>
            <input
              type="number"
              value={newScore}
              onChange={(e) => setNewScore(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-3 bg-night-card border border-night-card rounded-xl text-white text-xl font-display focus:border-neon-orange/50 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              新满意度 <span className="text-neon-pink">*</span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={newSatisfaction}
                onChange={(e) => setNewSatisfaction(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="font-display text-neon-green text-xl w-16 text-right">
                {newSatisfaction}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              修正原因 <span className="text-neon-pink">*</span>
            </label>
            <textarea
              value={correctReason}
              onChange={(e) => setCorrectReason(e.target.value)}
              placeholder="请详细说明修正原因，如：数据异常、玩家申诉、运营调整等..."
              className="w-full px-4 py-3 bg-night-card border border-night-card rounded-xl text-white placeholder-gray-500 focus:border-neon-orange/50 focus:outline-none transition-colors resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-neon-yellow/10 rounded-xl border border-neon-yellow/30">
            <AlertCircle size={18} className="text-neon-yellow flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-300">
              修正操作会保留所有历史版本，可以随时查看和追溯。请谨慎操作！
            </p>
          </div>
        </div>
      ),
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg text-neon-orange">数据修正</h3>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-neon-orange border-t-transparent rounded-full mx-auto mb-4" />
          <p className="font-body text-gray-400">加载中...</p>
        </div>
      ) : correctableScores.length === 0 ? (
        <div className="text-center py-12">
          <Edit2 size={48} className="mx-auto text-gray-500 mb-4 opacity-50" />
          <p className="font-body text-gray-400">暂无可修正的记录</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-night-card">
                <th className="pb-3 font-body font-medium">玩家</th>
                <th className="pb-3 font-body font-medium">分数</th>
                <th className="pb-3 font-body font-medium">满意度</th>
                <th className="pb-3 font-body font-medium">状态</th>
                <th className="pb-3 font-body font-medium">更新时间</th>
                <th className="pb-3 font-body font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {correctableScores.map((score) => (
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
                    <span
                      className={`px-2 py-1 rounded text-xs border ${getStatusColor(
                        score.status
                      )}`}
                    >
                      {getStatusLabel(score.status)}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar size={14} />
                      {formatDate(score.updatedAt)}
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewHistory(score)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-night-card hover:bg-night-card/80 text-gray-400 hover:text-white text-sm transition-colors"
                      >
                        <History size={14} />
                        历史
                      </button>
                      <button
                        onClick={() => {
                          handleEdit(score);
                          openCorrectModal();
                        }}
                        disabled={isSubmitting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue text-sm transition-colors disabled:opacity-50"
                      >
                        <Edit2 size={14} />
                        修正
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
