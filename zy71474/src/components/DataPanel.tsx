import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { formatNumber } from '@/utils/helpers';

function ConservationIcon({ conserved, experimentId }: { conserved: boolean; experimentId: string | null }) {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    if (experimentId) {
      navigate(`/detail/${experimentId}`);
    }
  };

  return (
    <span
      className="relative inline-block cursor-pointer"
      onClick={handleClick}
      onMouseEnter={() => !experimentId && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {conserved ? (
        <span className="text-brand-green animate-pulse-green text-lg">✓</span>
      ) : (
        <span className="text-brand-red animate-pulse-red text-lg">✗</span>
      )}
      {showTooltip && !experimentId && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-brand-surface border border-brand-border rounded text-xs text-brand-muted whitespace-nowrap z-10">
          请先保存实验
        </span>
      )}
    </span>
  );
}

export default function DataPanel() {
  const currentResult = useStore((s) => s.currentResult);
  const experiments = useStore((s) => s.experiments);

  const latestExperimentId = experiments.length > 0 ? experiments[experiments.length - 1].id : null;

  if (!currentResult) {
    return (
      <div className="bg-brand-card rounded-xl border border-brand-border p-4 font-body">
        <h2 className="font-display text-sm text-brand-cyan mb-4">实时数据</h2>
        <p className="text-brand-muted text-sm text-center py-8">运行碰撞后显示数据</p>
      </div>
    );
  }

  const momentumDevPct = currentResult.momentumBefore !== 0
    ? (currentResult.momentumDeviation * 100)
    : 0;
  const energyDevPct = currentResult.energyBefore !== 0
    ? (currentResult.energyDeviation * 100)
    : 0;
  const energyLoss = currentResult.energyAfter - currentResult.energyBefore;

  return (
    <div className="bg-brand-card rounded-xl border border-brand-border p-4 font-body space-y-4">
      <h2 className="font-display text-sm text-brand-cyan">实时数据</h2>

      <div className="bg-brand-surface rounded-lg border border-brand-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-brand-muted">动量</span>
          <ConservationIcon
            conserved={currentResult.momentumConserved}
            experimentId={latestExperimentId}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-brand-muted mb-1">碰撞前</p>
            <p className="font-display text-brand-text">
              {formatNumber(currentResult.momentumBefore)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-muted mb-1">碰撞后</p>
            <p className="font-display text-brand-text">
              {formatNumber(currentResult.momentumAfter)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-brand-muted">偏差</span>
          <span className={`font-display ${momentumDevPct < 1 ? 'text-brand-green' : 'text-brand-amber'}`}>
            {formatNumber(momentumDevPct)}%
          </span>
        </div>
      </div>

      <div className="bg-brand-surface rounded-lg border border-brand-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-brand-muted">能量</span>
          <ConservationIcon
            conserved={currentResult.energyConserved}
            experimentId={latestExperimentId}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-brand-muted mb-1">碰撞前</p>
            <p className="font-display text-brand-text">
              {formatNumber(currentResult.energyBefore)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-muted mb-1">碰撞后</p>
            <p className="font-display text-brand-text">
              {formatNumber(currentResult.energyAfter)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-brand-muted">偏差</span>
          <span className={`font-display ${energyDevPct < 1 ? 'text-brand-green' : 'text-brand-amber'}`}>
            {formatNumber(energyDevPct)}%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-brand-muted">
            {energyLoss >= 0 ? '能量增加' : '能量损失'}
          </span>
          <span className={`font-display ${energyLoss >= 0 ? 'text-brand-amber' : 'text-brand-red'}`}>
            {energyLoss >= 0 ? '+' : ''}{formatNumber(energyLoss)}
          </span>
        </div>
      </div>
    </div>
  );
}
