import { useState } from 'react';
import { Trophy, Award, BookOpen, Save, RotateCcw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import type { GameSession, ScoreResult, Resources } from '@/types';
import { RESOURCE_LABELS } from '@/types';
import { formatDateTime, formatNumber } from '@/utils/helpers';

interface ResultPanelProps {
  session: GameSession;
  scoreResult: ScoreResult;
  onRestart: () => void;
  onSaveNotes: (notes: string) => void;
  onViewHistory: () => void;
}

export function ResultPanel({
  session,
  scoreResult,
  onRestart,
  onSaveNotes,
  onViewHistory,
}: ResultPanelProps) {
  const [teacherNotes, setTeacherNotes] = useState(scoreResult.teacherNotes || session.teacherNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const percentage = scoreResult.maxScore > 0 
    ? Math.round((scoreResult.totalScore / scoreResult.maxScore) * 100) 
    : 0;

  const getGrade = () => {
    if (percentage >= 90) return { grade: 'A', label: '优秀', color: 'text-success-400', bgColor: 'bg-success-500/20' };
    if (percentage >= 80) return { grade: 'B', label: '良好', color: 'text-accent-400', bgColor: 'bg-accent-500/20' };
    if (percentage >= 70) return { grade: 'C', label: '中等', color: 'text-warning-400', bgColor: 'bg-warning-500/20' };
    if (percentage >= 60) return { grade: 'D', label: '及格', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
    return { grade: 'F', label: '需努力', color: 'text-danger-400', bgColor: 'bg-danger-500/20' };
  };

  const gradeInfo = getGrade();

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await onSaveNotes(teacherNotes);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const resourceKeys = Object.keys(session.currentResources) as (keyof Resources)[];

  return (
    <div className="card animate-slide-up">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-primary-900" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">游戏结算</h2>
        <p className="text-white/60">{session.levelName}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className={`p-4 rounded-lg ${gradeInfo.bgColor} text-center`}>
          <div className={`text-4xl font-bold ${gradeInfo.color} mb-1`}>{gradeInfo.grade}</div>
          <div className="text-sm text-white/70">{gradeInfo.label}</div>
        </div>
        <div className="p-4 rounded-lg bg-white/5 text-center">
          <div className="text-3xl font-bold text-white mb-1">{scoreResult.totalScore}</div>
          <div className="text-sm text-white/70">总分 / {scoreResult.maxScore}</div>
        </div>
        <div className="p-4 rounded-lg bg-white/5 text-center">
          <div className="text-3xl font-bold text-accent-400 mb-1">{percentage}%</div>
          <div className="text-sm text-white/70">得分率</div>
        </div>
        <div className="p-4 rounded-lg bg-white/5 text-center">
          <div className="text-3xl font-bold text-white mb-1">{session.stepHistory.length}</div>
          <div className="text-sm text-white/70">总步数</div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5" />
          评分详情
        </h3>
        <div className="space-y-3">
          {scoreResult.breakdown.map((item, index) => {
            const itemPercent = item.maxScore > 0 
              ? Math.round((item.earnedScore / item.maxScore) * 100) 
              : 0;
            
            return (
              <div key={index} className="p-4 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-white">{item.category}</span>
                    <p className="text-xs text-white/60 mt-1">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-accent-400">{item.earnedScore}</span>
                    <span className="text-white/50"> / {item.maxScore}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-500"
                    style={{ width: `${itemPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          最终资源状态
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {resourceKeys.map((key) => {
            const value = session.currentResources[key];
            const isNegative = value < 0;
            
            return (
              <div 
                key={key} 
                className={`p-3 rounded-lg ${isNegative ? 'bg-danger-500/20 border border-danger-500/30' : 'bg-white/5'}`}
              >
                <div className="text-xs text-white/60 mb-1">{RESOURCE_LABELS[key]}</div>
                <div className={`text-xl font-bold ${isNegative ? 'text-danger-400' : 'text-white'}`}>
                  {formatNumber(value)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          教师评语
        </h3>
        <textarea
          value={teacherNotes}
          onChange={(e) => setTeacherNotes(e.target.value)}
          placeholder="请输入对学生的评语和建议..."
          rows={4}
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSaveNotes}
            disabled={isSaving}
            className="btn-accent flex items-center gap-2 text-sm"
          >
            {saveSuccess ? (
              <>
                <CheckCircle className="w-4 h-4" />
                已保存
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isSaving ? '保存中...' : '保存评语'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 bg-white/5 rounded-lg mb-8">
        <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
          <Clock className="w-4 h-4" />
          游戏时间
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-white/50">开始时间：</span>
            <span className="text-white">{formatDateTime(session.startTime)}</span>
          </div>
          <div>
            <span className="text-xs text-white/50">结束时间：</span>
            <span className="text-white">{session.endTime ? formatDateTime(session.endTime) : '-'}</span>
          </div>
        </div>
      </div>

      {session.conflicts.length > 0 && (
        <div className="p-4 bg-warning-500/20 border border-warning-500/30 rounded-lg mb-8">
          <div className="flex items-center gap-2 text-warning-300 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">数据冲突记录</span>
          </div>
          <p className="text-sm text-white/70">
            本局游戏共检测到 {session.conflicts.length} 处数据冲突，已记录在案。
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onViewHistory}
          className="flex-1 btn-secondary flex items-center justify-center gap-2"
        >
          <Clock className="w-4 h-4" />
          查看历史记录
        </button>
        <button
          onClick={onRestart}
          className="flex-1 btn-primary flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          再来一局
        </button>
      </div>
    </div>
  );
}
