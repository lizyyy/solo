import { useSelectedWorks, usePortfolioStore } from '../../store/usePortfolioStore';
import { Star, X, FileWarning, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PortfolioPreview() {
  const selectedWorks = useSelectedWorks();
  const toggleSelection = usePortfolioStore(s => s.toggleWorkSelection);
  const anomalies = usePortfolioStore(s => s.anomalies);

  if (selectedWorks.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-charcoal-700/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-cream-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h4 className="font-display text-lg font-semibold text-cream-200 mb-2">尚未选择作品</h4>
        <p className="text-sm text-cream-400/60 max-w-xs mx-auto">
          在分析看板中点击作品卡片将其加入作品集，系统会实时计算评分并检测异常
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-cream-200">作品组合预览</h3>
          <p className="text-xs text-cream-400/60">已选择 {selectedWorks.length} 件作品</p>
        </div>
        {anomalies.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-terracotta-500/10 border border-terracotta-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-terracotta-500" />
            <span className="text-xs text-terracotta-400 font-medium">{anomalies.length} 项异常</span>
          </div>
        )}
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        <div className="divide-y divide-white/5">
          {selectedWorks.map((work, index) => {
            const hasAnomaly = anomalies.some(a => a.relatedWorkIds.includes(work.id));
            const completionStars = Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-2.5 h-2.5',
                  i < work.completion ? 'text-amber-400 fill-amber-400' : 'text-charcoal-500'
                )}
              />
            ));

            return (
              <div
                key={work.id}
                className="p-3 flex items-center gap-3 hover:bg-charcoal-700/30 transition-colors group opacity-0 animate-fadeInUp"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div className="text-xs text-cream-400/40 w-6 text-center font-mono">
                  {index + 1}
                </div>

                <img
                  src={work.thumbnail}
                  alt={work.title}
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-cream-200 truncate">{work.title}</h4>
                    {hasAnomaly && (
                      <AlertTriangle className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                    )}
                    {!work.copyright.hasClearance && (
                      <FileWarning className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-cream-400/70 mt-0.5">{work.studentName}</p>
                  <div className="flex items-center gap-1 mt-1">{completionStars}</div>
                </div>

                <button
                  onClick={() => toggleSelection(work.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-cream-400/40 hover:text-terracotta-400 hover:bg-terracotta-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
