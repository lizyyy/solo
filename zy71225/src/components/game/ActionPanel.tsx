import React, { useState, useEffect } from 'react';
import { Plus, Minus, DollarSign, AlertTriangle, CheckCircle, XCircle, Calculator } from 'lucide-react';
import type { Position, GreekValues, FeeConfig, GreekTarget } from '@/types';
import { estimatePositionChangeImpact } from '@/engine/feeCalculator';
import { calculatePortfolioGreeks } from '@/engine/greekCalculator';
import { formatCurrency, formatNumber, getPnLColor } from '@/utils/format';

interface ActionPanelProps {
  positions: Position[];
  currentGreeks: GreekValues;
  currentPrice: number;
  volatility: number;
  feeConfig: FeeConfig;
  greekTargets: GreekTarget;
  cash: number;
  isPlaying: boolean;
  onExecuteAction: (
    actionType: 'adjust' | 'stopLoss' | 'hold',
    positionChanges: Array<{ positionId: string; changeQuantity: number }>
  ) => { success: boolean; error?: string };
  onNextRound: () => void;
}

interface PositionAdjustment {
  positionId: string;
  changeQuantity: number;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  positions,
  currentGreeks,
  currentPrice,
  volatility,
  feeConfig,
  greekTargets,
  cash,
  isPlaying,
  onExecuteAction,
  onNextRound,
}) => {
  const [adjustments, setAdjustments] = useState<PositionAdjustment[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionType, setActionType] = useState<'adjust' | 'stopLoss' | 'hold'>('hold');
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{
    totalCost: number;
    totalFee: number;
    estimatedGreeks: GreekValues;
    estimatedCash: number;
  } | null>(null);

  useEffect(() => {
    if (adjustments.length === 0 || adjustments.every(a => a.changeQuantity === 0)) {
      setEstimate(null);
      return;
    }

    const adjustedPositions = positions.map(pos => {
      const adj = adjustments.find(a => a.positionId === pos.id);
      if (!adj) return pos;
      return { ...pos, quantity: pos.quantity + adj.changeQuantity };
    });

    const { portfolioGreeks: estimatedGreeks } = calculatePortfolioGreeks(
      adjustedPositions,
      currentPrice,
      volatility
    );

    let totalCost = 0;
    let totalFee = 0;

    for (const adj of adjustments) {
      if (adj.changeQuantity === 0) continue;
      const position = positions.find(p => p.id === adj.positionId);
      if (!position) continue;

      const impact = estimatePositionChangeImpact(
        position,
        adj.changeQuantity,
        currentPrice,
        volatility,
        feeConfig
      );
      totalCost += impact.estimatedCost;
      totalFee += impact.estimatedFee;
    }

    setEstimate({
      totalCost,
      totalFee,
      estimatedGreeks,
      estimatedCash: cash - totalCost,
    });
  }, [adjustments, positions, currentPrice, volatility, feeConfig, cash]);

  const handleQuantityChange = (positionId: string, delta: number) => {
    setAdjustments(prev => {
      const existing = prev.find(a => a.positionId === positionId);
      if (existing) {
        return prev.map(a =>
          a.positionId === positionId
            ? { ...a, changeQuantity: Math.max(-1000, Math.min(1000, a.changeQuantity + delta)) }
            : a
        );
      }
      return [...prev, { positionId, changeQuantity: delta }];
    });
    setActionType('adjust');
  };

  const handleSliderChange = (positionId: string, value: number) => {
    setAdjustments(prev => {
      const existing = prev.find(a => a.positionId === positionId);
      if (existing) {
        return prev.map(a =>
          a.positionId === positionId ? { ...a, changeQuantity: value } : a
        );
      }
      return [...prev, { positionId, changeQuantity: value }];
    });
    setActionType('adjust');
  };

  const handleStopLoss = () => {
    const stopLossAdjustments = positions
      .filter(p => p.quantity !== 0)
      .map(p => ({
        positionId: p.id,
        changeQuantity: -p.quantity,
      }));
    setAdjustments(stopLossAdjustments);
    setActionType('stopLoss');
  };

  const handleHold = () => {
    setAdjustments([]);
    setActionType('hold');
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const validAdjustments = adjustments.filter(a => a.changeQuantity !== 0);
    
    const result = onExecuteAction(actionType, validAdjustments);
    
    if (result.success) {
      setShowConfirm(false);
      setAdjustments([]);
      setError(null);
      setActionType('hold');
      onNextRound();
    } else {
      setError(result.error || '操作失败');
    }
  };

  const hasAdjustments = adjustments.some(a => a.changeQuantity !== 0);

  return (
    <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">操作面板</h3>
        {!isPlaying && (
          <span className="text-sm text-bloomberg-muted">等待行情...</span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-bloomberg-muted mb-2 block">选择调仓头寸</label>
          <select
            className="w-full p-3 bg-bloomberg-bg border border-bloomberg-border rounded-lg text-bloomberg-text font-mono focus:outline-none focus:border-highlight-blue"
            value={selectedPositionId || ''}
            onChange={(e) => setSelectedPositionId(e.target.value || null)}
          >
            <option value="">-- 选择头寸 --</option>
            {positions.filter(p => p.quantity !== 0 || p.type === 'underlying').map(pos => (
              <option key={pos.id} value={pos.id}>
                {pos.contractCode} ({pos.type === 'call' ? '看涨' : pos.type === 'put' ? '看跌' : '标的'})
                当前持仓: {pos.quantity}
              </option>
            ))}
          </select>
        </div>

        {selectedPositionId && (
          <div className="p-4 bg-bloomberg-bg/50 rounded-lg border border-bloomberg-border">
            {(() => {
              const position = positions.find(p => p.id === selectedPositionId);
              if (!position) return null;
              
              const currentAdj = adjustments.find(a => a.positionId === selectedPositionId);
              const changeQuantity = currentAdj?.changeQuantity || 0;

              return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold">{position.contractCode}</span>
                    <span className="text-sm text-bloomberg-muted">
                      当前持仓: <span className="text-bloomberg-text">{position.quantity}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <button
                      className="p-2 bg-trader-red/20 hover:bg-trader-red/30 text-trader-red rounded-lg transition-colors"
                      onClick={() => handleQuantityChange(selectedPositionId, -10)}
                      disabled={!isPlaying}
                    >
                      <Minus size={16} />
                    </button>
                    
                    <div className="flex-1">
                      <input
                        type="range"
                        min={-Math.abs(position.quantity) - 100}
                        max={1000}
                        value={changeQuantity}
                        onChange={(e) => handleSliderChange(selectedPositionId, parseInt(e.target.value))}
                        className="w-full h-2 bg-bloomberg-border rounded-lg appearance-none cursor-pointer accent-highlight-blue"
                        disabled={!isPlaying}
                      />
                    </div>
                    
                    <button
                      className="p-2 bg-trader-green/20 hover:bg-trader-green/30 text-trader-green rounded-lg transition-colors"
                      onClick={() => handleQuantityChange(selectedPositionId, 10)}
                      disabled={!isPlaying}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-bloomberg-muted">调仓量</div>
                      <div className={`font-mono font-bold ${changeQuantity > 0 ? 'text-trader-green' : changeQuantity < 0 ? 'text-trader-red' : 'text-bloomberg-text'}`}>
                        {changeQuantity > 0 ? '+' : ''}{changeQuantity}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-bloomberg-muted">调仓后</div>
                      <div className="font-mono font-bold">
                        {position.quantity + changeQuantity}
                      </div>
                    </div>
                    {estimate && (
                      <div>
                        <div className="text-xs text-bloomberg-muted">预计费用</div>
                        <div className="font-mono font-bold text-warning-orange">
                          {formatCurrency(estimate.totalFee / adjustments.length)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {hasAdjustments && estimate && (
          <div className="p-4 bg-highlight-blue/10 border border-highlight-blue/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={16} className="text-highlight-blue" />
              <span className="text-sm font-bold text-highlight-blue">调仓预估</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-bloomberg-muted">预计交易费用</span>
                <span className="font-mono text-warning-orange">-{formatCurrency(estimate.totalFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-bloomberg-muted">预计现金变化</span>
                <span className={`font-mono ${estimate.estimatedCash >= cash ? 'text-trader-green' : 'text-trader-red'}`}>
                  {estimate.estimatedCash >= cash ? '+' : ''}{formatCurrency(estimate.estimatedCash - cash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-bloomberg-muted">调仓后Delta</span>
                <span className={`font-mono ${Math.abs(estimate.estimatedGreeks.delta) < 50 ? 'text-trader-green' : 'text-warning-orange'}`}>
                  {formatNumber(estimate.estimatedGreeks.delta, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-bloomberg-muted">调仓后Gamma</span>
                <span className={`font-mono ${Math.abs(estimate.estimatedGreeks.gamma) < 30 ? 'text-trader-green' : 'text-warning-orange'}`}>
                  {formatNumber(estimate.estimatedGreeks.gamma, 4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-bloomberg-muted">调仓后Vega</span>
                <span className={`font-mono ${Math.abs(estimate.estimatedGreeks.vega) < 200 ? 'text-trader-green' : 'text-warning-orange'}`}>
                  {formatNumber(estimate.estimatedGreeks.vega, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-bloomberg-muted">剩余现金</span>
                <span className={`font-mono ${estimate.estimatedCash >= 0 ? 'text-bloomberg-text' : 'text-trader-red'}`}>
                  {formatCurrency(estimate.estimatedCash)}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-trader-red/10 border border-trader-red/30 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-trader-red" />
              <span className="text-sm text-trader-red">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 pt-2">
          <button
            className={`p-4 rounded-lg font-bold transition-all ${
              actionType === 'hold'
                ? 'bg-bloomberg-border text-bloomberg-text'
                : 'bg-bloomberg-bg hover:bg-bloomberg-border/50 text-bloomberg-muted'
            }`}
            onClick={handleHold}
            disabled={!isPlaying}
          >
            <div className="text-2xl mb-1">⏸</div>
            <div className="text-sm">持仓不动</div>
          </button>
          
          <button
            className={`p-4 rounded-lg font-bold transition-all ${
              actionType === 'adjust' && hasAdjustments
                ? 'bg-highlight-blue text-white'
                : 'bg-bloomberg-bg hover:bg-bloomberg-border/50 text-bloomberg-muted'
            }`}
            onClick={() => {
              if (hasAdjustments) {
                setShowConfirm(true);
                setActionType('adjust');
              }
            }}
            disabled={!isPlaying || !hasAdjustments}
          >
            <div className="text-2xl mb-1">🔄</div>
            <div className="text-sm">确认调仓</div>
          </button>
          
          <button
            className={`p-4 rounded-lg font-bold transition-all ${
              actionType === 'stopLoss'
                ? 'bg-trader-red text-white'
                : 'bg-bloomberg-bg hover:bg-trader-red/20 text-trader-red'
            }`}
            onClick={() => {
              handleStopLoss();
              setShowConfirm(true);
            }}
            disabled={!isPlaying}
          >
            <div className="text-2xl mb-1">🛑</div>
            <div className="text-sm">全部止损</div>
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-bloomberg-panel border border-bloomberg-border rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              {actionType === 'hold' ? (
                <CheckCircle size={24} className="text-highlight-blue" />
              ) : actionType === 'stopLoss' ? (
                <AlertTriangle size={24} className="text-trader-red" />
              ) : (
                <DollarSign size={24} className="text-trader-green" />
              )}
              <h4 className="text-xl font-bold">
                {actionType === 'hold' ? '确认持仓不动' : 
                 actionType === 'stopLoss' ? '确认全部止损' : '确认调仓'}
              </h4>
            </div>

            {actionType !== 'hold' && (
              <div className="mb-4 space-y-2">
                {adjustments.filter(a => a.changeQuantity !== 0).map(adj => {
                  const pos = positions.find(p => p.id === adj.positionId);
                  return (
                    <div key={adj.positionId} className="flex justify-between text-sm">
                      <span className="text-bloomberg-muted">{pos?.contractCode}</span>
                      <span className={`font-mono ${adj.changeQuantity > 0 ? 'text-trader-green' : 'text-trader-red'}`}>
                        {adj.changeQuantity > 0 ? '买入 ' : '卖出 '}{Math.abs(adj.changeQuantity)} 张
                      </span>
                    </div>
                  );
                })}
                {estimate && (
                  <div className="pt-2 border-t border-bloomberg-border flex justify-between text-sm font-bold">
                    <span className="text-bloomberg-muted">预计总费用</span>
                    <span className={getPnLColor(-estimate.totalFee)}>
                      -{formatCurrency(estimate.totalFee)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {actionType === 'hold' && (
              <p className="text-bloomberg-muted mb-4">
                确定本回合不进行任何操作？希腊值风险将持续暴露。
              </p>
            )}

            {actionType === 'stopLoss' && (
              <p className="text-trader-red mb-4">
                ⚠️ 这将平掉所有头寸，锁定当前盈亏。此操作不可撤销！
              </p>
            )}

            <div className="flex gap-3">
              <button
                className="flex-1 p-3 bg-bloomberg-bg hover:bg-bloomberg-border/50 rounded-lg text-bloomberg-muted font-bold transition-colors"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                className={`flex-1 p-3 rounded-lg text-white font-bold transition-colors ${
                  actionType === 'stopLoss' 
                    ? 'bg-trader-red hover:bg-trader-red/80' 
                    : 'bg-highlight-blue hover:bg-highlight-blue/80'
                }`}
                onClick={handleConfirm}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
