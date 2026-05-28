import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import type { MarketSnapshot, ErrorAnalysis } from '@/types';
import { formatNumber, formatCurrency, getPnLColor, getSeverityColor, getSeverityLabel } from '@/utils/format';

interface ReviewTimelineProps {
  timeline: MarketSnapshot[];
  errors: ErrorAnalysis[];
}

interface TimelineItemProps {
  snapshot: MarketSnapshot;
  errors: ErrorAnalysis[];
  isLast: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ snapshot, errors, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const roundErrors = errors.filter(e => e.round === snapshot.round);
  const hasErrors = roundErrors.length > 0;
  
  const actionType = snapshot.action?.type;
  const actionLabel = {
    adjust: '调仓',
    stopLoss: '止损',
    hold: '持仓不动',
  }[actionType || 'hold'];

  const actionColor = {
    adjust: 'bg-highlight-blue',
    stopLoss: 'bg-trader-red',
    hold: 'bg-bloomberg-muted',
  }[actionType || 'hold'];

  const qualityColor = hasErrors 
    ? 'bg-trader-red' 
    : snapshot.action 
      ? 'bg-trader-green' 
      : 'bg-bloomberg-muted';

  return (
    <div className="relative pl-8 pb-8">
      {!isLast && (
        <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-bloomberg-border" />
      )}
      
      <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-bloomberg-bg ${qualityColor}`} />
      
      <div
        className={`
          bg-bloomberg-panel rounded-xl border border-bloomberg-border p-4 cursor-pointer
          hover:border-bloomberg-muted/50 transition-all
          ${hasErrors ? 'border-trader-red/30' : ''}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">第 {snapshot.round} 回合</span>
            {snapshot.action && (
              <span className={`px-2 py-0.5 rounded text-xs text-white ${actionColor}`}>
                {actionLabel}
              </span>
            )}
            {hasErrors && (
              <span className="flex items-center gap-1 text-trader-red text-sm">
                <AlertTriangle size={14} />
                {roundErrors.length} 个错误
              </span>
            )}
            {!hasErrors && snapshot.action && (
              <span className="flex items-center gap-1 text-trader-green text-sm">
                <CheckCircle size={14} />
                操作良好
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-bloomberg-muted">标的价格</div>
              <div className="font-mono font-bold">¥{formatNumber(snapshot.underlyingPrice, 2)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-bloomberg-muted">波动率</div>
              <div className="font-mono font-bold">{formatNumber(snapshot.volatility, 1)}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-bloomberg-muted">盈亏</div>
              <div className={`font-mono font-bold ${getPnLColor(snapshot.totalPnL)}`}>
                {snapshot.totalPnL >= 0 ? '+' : ''}{formatCurrency(snapshot.totalPnL)}
              </div>
            </div>
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-bloomberg-border space-y-4">
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 bg-bloomberg-bg/50 rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">Δ Delta</div>
                <div className="font-mono font-bold text-bloomberg-text">
                  {formatNumber(snapshot.greeks.delta, 2)}
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-bg/50 rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">Γ Gamma</div>
                <div className="font-mono font-bold text-bloomberg-text">
                  {formatNumber(snapshot.greeks.gamma, 4)}
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-bg/50 rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">V Vega</div>
                <div className="font-mono font-bold text-bloomberg-text">
                  {formatNumber(snapshot.greeks.vega, 2)}
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-bg/50 rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">Θ Theta</div>
                <div className="font-mono font-bold text-bloomberg-text">
                  {formatNumber(snapshot.greeks.theta, 2)}
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-bg/50 rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">保证金率</div>
                <div className={`font-mono font-bold ${
                  snapshot.margin.marginRatio > 80 ? 'text-trader-red' : 
                  snapshot.margin.marginRatio > 60 ? 'text-warning-orange' : 'text-trader-green'
                }`}>
                  {formatNumber(snapshot.margin.marginRatio, 1)}%
                </div>
              </div>
            </div>

            {snapshot.action && snapshot.action.positionChanges.length > 0 && (
              <div className="bg-bloomberg-bg/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={16} className="text-highlight-blue" />
                  <span className="font-bold">操作明细</span>
                  <span className="text-sm text-bloomberg-muted">
                    总费用: <span className="text-warning-orange">{formatCurrency(snapshot.action.totalCost)}</span>
                  </span>
                </div>
                <div className="space-y-2">
                  {snapshot.action.positionChanges.map((pc, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-bloomberg-muted">{pc.contractCode}</span>
                      <div className="flex items-center gap-4">
                        <span className={pc.changeQuantity > 0 ? 'text-trader-green' : 'text-trader-red'}>
                          {pc.changeQuantity > 0 ? '买入' : '卖出'} {Math.abs(pc.changeQuantity)} 张
                        </span>
                        <span className="font-mono">@ ¥{formatNumber(pc.executionPrice, 2)}</span>
                        <span className="text-warning-orange">费用: {formatCurrency(pc.fee)}</span>
                        <span className={getPnLColor(pc.pnlRealized)}>
                          盈亏: {pc.pnlRealized >= 0 ? '+' : ''}{formatCurrency(pc.pnlRealized)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshot.action?.errorType && (
              <div className="bg-trader-red/10 border border-trader-red/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={16} className="text-trader-red" />
                  <span className="font-bold text-trader-red">{snapshot.action.errorType}</span>
                </div>
                <p className="text-sm text-bloomberg-muted">{snapshot.action.errorNote}</p>
              </div>
            )}

            {roundErrors.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold flex items-center gap-2">
                  <AlertTriangle size={16} className="text-trader-red" />
                  错误分析 ({roundErrors.length})
                </h4>
                {roundErrors.map((error, idx) => (
                  <div key={idx} className="bg-bloomberg-bg/50 rounded-lg p-4 border-l-4 border-trader-red">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityColor(error.severity)}`}>
                        {getSeverityLabel(error.severity)}
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-trader-red mb-1">{error.type}</div>
                        <p className="text-sm text-bloomberg-text mb-2">{error.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-bloomberg-muted">后果</div>
                            <p>{error.consequence}</p>
                          </div>
                          <div>
                            <div className="text-xs text-bloomberg-muted">正确做法</div>
                            <p className="text-trader-green">{error.correctAction}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ReviewTimeline: React.FC<ReviewTimelineProps> = ({ timeline, errors }) => {
  return (
    <div className="space-y-2">
      {timeline.map((snapshot, idx) => (
        <TimelineItem
          key={snapshot.round}
          snapshot={snapshot}
          errors={errors}
          isLast={idx === timeline.length - 1}
        />
      ))}
    </div>
  );
};
