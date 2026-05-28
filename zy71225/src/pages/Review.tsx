import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Home, RotateCcw, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { ScoreCard } from '@/components/review/ScoreCard';
import { ReviewTimeline } from '@/components/review/ReviewTimeline';
import { formatCurrency, getPnLColor, getRatingLabel, getRatingColor } from '@/utils/format';

export const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const { reviewReport, currentGame, clearCurrentGame, exportReview } = useGameStore();

  useEffect(() => {
    if (!reviewReport && !currentGame) {
      navigate('/');
    }
  }, [reviewReport, currentGame, navigate]);

  if (!reviewReport || !currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-highlight-blue border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-bloomberg-muted">加载复盘报告中...</p>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    const data = exportReview();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `复盘报告-${reviewReport.materialName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackToHome = () => {
    clearCurrentGame();
    navigate('/');
  };

  const handleReplay = () => {
    navigate(`/game/${currentGame.materialId}`);
  };

  const overallRating = getRatingLabel(reviewReport.scores.overall);
  const ratingColor = getRatingColor(reviewReport.scores.overall);
  const isBankrupt = currentGame.status === 'bankrupt';
  const criticalErrors = reviewReport.errors.filter(e => e.severity === 'critical').length;
  const highErrors = reviewReport.errors.filter(e => e.severity === 'high').length;
  const mediumErrors = reviewReport.errors.filter(e => e.severity === 'medium').length;
  const lowErrors = reviewReport.errors.filter(e => e.severity === 'low').length;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToHome}
              className="p-2 hover:bg-bloomberg-border/30 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">复盘报告</h1>
              <p className="text-sm text-bloomberg-muted">
                {reviewReport.materialName} · 第 {reviewReport.playedRounds} / {reviewReport.totalRounds} 回合
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReplay}
              className="flex items-center gap-2 px-4 py-2 bg-bloomberg-border hover:bg-bloomberg-border/50 rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
              重新训练
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors"
            >
              <Download size={16} />
              导出报告
            </button>
          </div>
        </div>

        {isBankrupt && (
          <div className="mb-6 bg-trader-red/10 border border-trader-red/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-trader-red/20 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-trader-red" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-trader-red mb-2">爆仓</h3>
                <p className="text-bloomberg-text mb-2">{currentGame.bankruptReason}</p>
                <p className="text-sm text-bloomberg-muted">
                  第 {currentGame.bankruptRound} 回合，保证金耗尽，所有头寸被强制平仓
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6 mb-6">
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="col-span-3 text-center">
              <div className={`text-8xl font-bold ${ratingColor} text-shadow-glow mb-2`}>
                {overallRating}
              </div>
              <div className="text-sm text-bloomberg-muted">综合评级</div>
            </div>

            <div className="col-span-3">
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-bloomberg-muted mb-1">综合评分</div>
                  <div className="text-4xl font-mono font-bold">{reviewReport.scores.overall}</div>
                </div>
                <div>
                  <div className="text-xs text-bloomberg-muted mb-1">最终盈亏</div>
                  <div className={`text-3xl font-mono font-bold ${getPnLColor(reviewReport.finalPnL)}`}>
                    {reviewReport.finalPnL >= 0 ? '+' : ''}{formatCurrency(reviewReport.finalPnL)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-bloomberg-bg/50 rounded-lg">
                  <div className="text-3xl font-bold text-trader-red mb-1">{criticalErrors}</div>
                  <div className="text-xs text-bloomberg-muted">严重错误</div>
                </div>
                <div className="text-center p-4 bg-bloomberg-bg/50 rounded-lg">
                  <div className="text-3xl font-bold text-warning-orange mb-1">{highErrors}</div>
                  <div className="text-xs text-bloomberg-muted">高风险</div>
                </div>
                <div className="text-center p-4 bg-bloomberg-bg/50 rounded-lg">
                  <div className="text-3xl font-bold text-highlight-yellow mb-1">{mediumErrors}</div>
                  <div className="text-xs text-bloomberg-muted">中风险</div>
                </div>
                <div className="text-center p-4 bg-bloomberg-bg/50 rounded-lg">
                  <div className="text-3xl font-bold text-highlight-blue mb-1">{lowErrors}</div>
                  <div className="text-xs text-bloomberg-muted">需改进</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 space-y-6">
            <ScoreCard
              scores={reviewReport.scores}
              timeline={reviewReport.timeline}
              finalPnL={reviewReport.finalPnL}
            />
          </div>

          <div className="col-span-7">
            <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold">操作时间线</h3>
                  <p className="text-sm text-bloomberg-muted">点击展开查看每回合详细分析</p>
                </div>
                {reviewReport.errors.length === 0 && (
                  <div className="flex items-center gap-2 text-trader-green">
                    <CheckCircle size={20} />
                    <span className="font-bold">完美操作！</span>
                  </div>
                )}
              </div>

              <ReviewTimeline
                timeline={reviewReport.timeline}
                errors={reviewReport.errors}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText size={24} className="text-highlight-blue" />
            <h3 className="text-xl font-bold">培训师批注</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-bloomberg-bg/50 rounded-lg p-4 border-l-4 border-trader-green">
              <h4 className="font-bold text-trader-green mb-2">做得好的地方</h4>
              <ul className="space-y-2 text-sm text-bloomberg-muted">
                {reviewReport.scores.riskManagement >= 80 && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-green">✓</span>
                    风险管理意识较强，大部分时间希腊值控制在目标区间内
                  </li>
                )}
                {reviewReport.scores.costControl >= 80 && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-green">✓</span>
                    成本控制良好，调仓费用控制在合理范围内
                  </li>
                )}
                {reviewReport.scores.decisionTiming >= 80 && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-green">✓</span>
                    决策响应迅速，风险暴露后能及时采取行动
                  </li>
                )}
                {reviewReport.scores.greekStability >= 80 && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-green">✓</span>
                    希腊值稳定性好，组合风险敞口波动较小
                  </li>
                )}
                {reviewReport.scores.overall >= 80 && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-green">✓</span>
                    综合表现优秀，展现了良好的期权风险管理能力
                  </li>
                )}
                {reviewReport.scores.riskManagement < 80 && reviewReport.scores.costControl < 80 && 
                 reviewReport.scores.decisionTiming < 80 && reviewReport.scores.greekStability < 80 && (
                  <li className="text-bloomberg-muted">继续努力，每次练习都是进步的机会</li>
                )}
              </ul>
            </div>

            <div className="bg-bloomberg-bg/50 rounded-lg p-4 border-l-4 border-trader-red">
              <h4 className="font-bold text-trader-red mb-2">需要改进</h4>
              <ul className="space-y-2 text-sm text-bloomberg-muted">
                {reviewReport.errors.some(e => e.type === 'Gamma暴露过高') && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-red">!</span>
                    <span><strong className="text-trader-red">Gamma风险：</strong>需重点关注空头Gamma暴露，行情突变时损失会加速扩大</span>
                  </li>
                )}
                {reviewReport.errors.some(e => e.type.includes('保证金')) && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-red">!</span>
                    <span><strong className="text-trader-red">保证金管理：</strong>应保持足够的保证金安全垫，避免触发追缴或爆仓</span>
                  </li>
                )}
                {reviewReport.errors.some(e => e.type === '调仓费用过高') && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-red">!</span>
                    <span><strong className="text-trader-red">交易成本：</strong>频繁调仓会侵蚀利润，应优化调仓策略</span>
                  </li>
                )}
                {reviewReport.errors.some(e => e.type === '不作为风险') && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-red">!</span>
                    <span><strong className="text-trader-red">决策效率：</strong>风险暴露时应及时采取行动，避免风险累积</span>
                  </li>
                )}
                {reviewReport.errors.some(e => e.type === 'Vega暴露过高') && (
                  <li className="flex items-start gap-2">
                    <span className="text-trader-red">!</span>
                    <span><strong className="text-trader-red">波动率风险：</strong>需关注Vega敞口，IV突变会对组合价值产生重大影响</span>
                  </li>
                )}
                {reviewReport.errors.length === 0 && (
                  <li className="text-trader-green">非常棒！本次训练没有发现明显错误</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-highlight-yellow/10 rounded-lg border border-highlight-yellow/30 paper-texture">
            <div className="flex items-start gap-3">
              <div className="text-4xl font-handwritten text-highlight-yellow transform -rotate-2">
                💡
              </div>
              <div>
                <h4 className="font-bold text-highlight-yellow mb-1 handwritten-underline">学习要点</h4>
                <p className="text-sm text-bloomberg-muted font-handwritten">
                  期权风险管理的核心是平衡收益与风险。记住：<strong>Gamma是加速度</strong>，决定了价格变动时盈亏变化的速度；
                  <strong>Vega是波动率敏感度</strong>，决定了市场情绪变化时的盈亏；
                  <strong>保证金是生命线</strong>，永远不要让自己处于爆仓的边缘。
                  每次调仓前先算一算成本，想想是否有更优的对冲方案。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 px-6 py-3 bg-bloomberg-border hover:bg-bloomberg-border/50 rounded-lg font-bold transition-colors"
          >
            <Home size={20} />
            返回首页
          </button>
          <button
            onClick={handleReplay}
            className="flex items-center gap-2 px-6 py-3 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg font-bold transition-colors"
          >
            <RotateCcw size={20} />
            再来一局
          </button>
        </div>
      </div>
    </div>
  );
};
