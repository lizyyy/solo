import { usePortfolioStore, useSelectedWorks } from '../store/usePortfolioStore';
import ScoreRadar from '../components/portfolio/ScoreRadar';
import PortfolioPreview from '../components/portfolio/PortfolioPreview';
import AnomalyPanel from '../components/dashboard/AnomalyPanel';
import { generateRecommendation } from '../utils/scoring';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Portfolio() {
  const score = usePortfolioStore(s => s.currentScore);
  const anomalies = usePortfolioStore(s => s.anomalies);
  const selectedWorks = useSelectedWorks();
  const selectAllFiltered = usePortfolioStore(s => s.selectAllFiltered);
  const criteria = usePortfolioStore(s => s.filterCriteria);
  const navigate = useNavigate();

  const recommendation = score
    ? generateRecommendation(score, anomalies.length, selectedWorks.length)
    : '请先选择作品以生成评估建议';

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-cream-100 tracking-tight">
          组合评分
        </h1>
        <p className="text-cream-400/70 mt-2">
          多维度评估作品组合，智能分析优势与短板
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          {score ? (
            <>
              <ScoreRadar score={score} />

              <div className="glass-card rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-ochre-500/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-ochre-400" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-cream-200 mb-1">
                      评估建议
                    </h3>
                    <p className="text-sm text-cream-300/90 leading-relaxed">
                      {recommendation}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => selectAllFiltered()}
                    className="btn-secondary text-sm flex-1"
                  >
                    全选当前筛选结果
                  </button>
                  <button
                    onClick={() => navigate('/export')}
                    disabled={selectedWorks.length === 0}
                    className="btn-primary text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    导出报告
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <AnomalyPanel />
            </>
          ) : (
            <div className="glass-card rounded-xl p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-charcoal-700/50 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-cream-400/30" />
              </div>
              <h3 className="font-display text-xl font-semibold text-cream-200 mb-3">
                尚未选择作品
              </h3>
              <p className="text-sm text-cream-400/60 max-w-md mx-auto mb-6">
                在分析看板中点击作品卡片进行选择，系统将实时计算组合评分并进行多维度分析
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn-primary inline-flex items-center gap-2"
              >
                前往分析看板
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <PortfolioPreview />
        </div>
      </div>
    </div>
  );
}
