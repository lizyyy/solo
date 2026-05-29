import { usePortfolioStore } from '../../store/usePortfolioStore';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2, RotateCcw, ArrowRight, Tag, Layers, Star } from 'lucide-react';
import { formatDateTime, getScoreColor } from '../../lib/utils';
import type { ScreeningSession } from '../../types';

export default function HistoryList() {
  const sessions = usePortfolioStore(s => s.sessions);
  const loadSession = usePortfolioStore(s => s.loadSession);
  const deleteSession = usePortfolioStore(s => s.deleteSession);
  const navigate = useNavigate();

  const handleLoad = (session: ScreeningSession) => {
    loadSession(session.id);
    navigate('/');
  };

  if (sessions.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-charcoal-700/50 flex items-center justify-center">
          <Clock className="w-8 h-8 text-cream-400/40" />
        </div>
        <h4 className="font-display text-lg font-semibold text-cream-200 mb-2">暂无历史记录</h4>
        <p className="text-sm text-cream-400/60 max-w-xs mx-auto">
          在导出报告页面保存筛选会话后，历史记录将显示在这里，方便回溯和同事交接
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-cream-200">历史记录</h2>
        <span className="text-sm text-cream-400/60">共 {sessions.length} 条记录</span>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-ochre-500/50 via-ochre-500/20 to-transparent" />
        
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className="relative pl-16 pb-6 opacity-0 animate-fadeInUp"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="absolute left-4 w-5 h-5 rounded-full bg-charcoal-800 border-2 border-ochre-500/50 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-ochre-500" />
            </div>

            <div className="glass-card card-hover rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-cream-200">
                      {session.name}
                    </h3>
                    {session.note && (
                      <p className="text-sm text-cream-400/70 mt-1">{session.note}</p>
                    )}
                    <p className="text-xs text-cream-400/50 mt-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(session.createdAt)}
                    </p>
                  </div>
                  <div className={`text-right px-4 py-2 rounded-lg ${getScoreColor(session.score.overall).replace('text-', 'bg-')}/10`}>
                    <div className={`text-2xl font-display font-bold ${getScoreColor(session.score.overall)}`}>
                      {session.score.overall}
                    </div>
                    <div className="text-[10px] text-cream-400/60">综合评分</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-700/30">
                    <Layers className="w-4 h-4 text-ochre-400" />
                    <div>
                      <div className="text-sm font-medium text-cream-200">{session.selectedWorkIds.length}</div>
                      <div className="text-[10px] text-cream-400/60">入选作品</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-700/30">
                    <Tag className="w-4 h-4 text-moss-500" />
                    <div>
                      <div className="text-sm font-medium text-cream-200">{session.criteria.tags.length || '-'}</div>
                      <div className="text-[10px] text-cream-400/60">主题筛选</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-700/30">
                    <Star className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-sm font-medium text-cream-200">{session.criteria.minCompletion}★+</div>
                      <div className="text-[10px] text-cream-400/60">最低完成度</div>
                    </div>
                  </div>
                </div>

                {session.criteria.applicationDirection && (
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ochre-500/10 text-ochre-400 text-xs">
                      <ArrowRight className="w-3 h-3" />
                      申请方向：{session.criteria.applicationDirection}
                    </span>
                  </div>
                )}

                {session.anomalies.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-terracotta-500/10 border border-terracotta-500/20">
                    <p className="text-xs text-terracotta-400 font-medium">
                      包含 {session.anomalies.length} 项异常记录
                    </p>
                    <p className="text-xs text-cream-400/70 mt-0.5">
                      {session.anomalies.map(a => a.description).slice(0, 2).join('；')}
                      {session.anomalies.length > 2 && '...'}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                  <button
                    onClick={() => handleLoad(session)}
                    className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    恢复此筛选
                  </button>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="btn-danger text-sm py-2 px-4 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
