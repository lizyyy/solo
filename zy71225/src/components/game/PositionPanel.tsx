import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import type { Position } from '@/types';
import { formatNumber, formatCurrency, getPnLColor, getPnLBgColor } from '@/utils/format';

interface PositionPanelProps {
  positions: Position[];
  onSelectPosition?: (position: Position) => void;
  selectedPositionId?: string;
}

interface PositionRowProps {
  position: Position;
  onSelect?: (position: Position) => void;
  isSelected?: boolean;
}

const PositionRow: React.FC<PositionRowProps> = ({ position, onSelect, isSelected }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeLabels: Record<string, string> = {
    call: '看涨期权',
    put: '看跌期权',
    underlying: '标的资产',
  };

  const typeColors: Record<string, string> = {
    call: 'text-trader-green bg-trader-green/10',
    put: 'text-trader-red bg-trader-red/10',
    underlying: 'text-bloomberg-text bg-bloomberg-border/30',
  };

  const quantityColor = position.quantity > 0 ? 'text-trader-green' : 'text-trader-red';
  const hasHighGamma = position.individualGreeks && Math.abs(position.individualGreeks.gamma) > 10;

  return (
    <>
      <tr
        className={`
          cursor-pointer transition-all duration-200
          ${isSelected ? 'bg-highlight-blue/20' : 'hover:bg-bloomberg-border/30'}
          ${hasHighGamma ? 'border-l-4 border-warning-orange' : ''}
        `}
        onClick={() => {
          setIsExpanded(!isExpanded);
          onSelect?.(position);
        }}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span className="font-mono font-medium">{position.contractCode}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[position.type]}`}>
            {typeLabels[position.type]}
          </span>
        </td>
        <td className="py-3 px-4 font-mono text-center">
          {position.type !== 'underlying' ? formatNumber(position.strike, 2) : '-'}
        </td>
        <td className="py-3 px-4 font-mono text-center">
          {position.type !== 'underlying' ? `${position.expiryDays}天` : '-'}
        </td>
        <td className={`py-3 px-4 font-mono text-right font-bold ${quantityColor}`}>
          {position.quantity > 0 ? '+' : ''}{position.quantity}
        </td>
        <td className="py-3 px-4 font-mono text-right">
          {formatNumber(position.costPrice, 2)}
        </td>
        <td className="py-3 px-4 font-mono text-right">
          {position.currentPrice !== undefined ? formatNumber(position.currentPrice, 2) : '-'}
        </td>
        <td className="py-3 px-4 font-mono text-right">
          {position.marketValue !== undefined ? formatCurrency(position.marketValue) : '-'}
        </td>
        <td className={`py-3 px-4 font-mono text-right font-bold ${getPnLColor(position.pnl || 0)} ${getPnLBgColor(position.pnl || 0)}`}>
          {position.pnl !== undefined ? (
            <span className="px-2 py-1 rounded">
              {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
            </span>
          ) : '-'}
        </td>
        <td className="py-3 px-4">
          {hasHighGamma && (
            <div className="flex items-center gap-1 text-warning-orange">
              <AlertTriangle size={14} />
              <span className="text-xs">高Gamma</span>
            </div>
          )}
        </td>
      </tr>
      
      {isExpanded && position.individualGreeks && (
        <tr className="bg-bloomberg-bg/50">
          <td colSpan={10} className="py-4 px-8">
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 bg-bloomberg-panel rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">Δ Delta</div>
                <div className={`font-mono font-bold ${Math.abs(position.individualGreeks.delta) > 30 ? 'text-warning-orange' : 'text-bloomberg-text'}`}>
                  {formatNumber(position.individualGreeks.delta, 2)}
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-panel rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">Γ Gamma</div>
                <div className={`font-mono font-bold ${Math.abs(position.individualGreeks.gamma) > 5 ? 'text-warning-orange' : 'text-bloomberg-text'}`}>
                  {formatNumber(position.individualGreeks.gamma, 4)}
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-panel rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">V Vega</div>
                <div className={`font-mono font-bold ${Math.abs(position.individualGreeks.vega) > 50 ? 'text-warning-orange' : 'text-bloomberg-text'}`}>
                  {formatNumber(position.individualGreeks.vega, 2)}
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-panel rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">Θ Theta</div>
                <div className="font-mono font-bold text-bloomberg-text">
                  {formatNumber(position.individualGreeks.theta, 2)}/天
                </div>
              </div>
              <div className="text-center p-3 bg-bloomberg-panel rounded-lg">
                <div className="text-xs text-bloomberg-muted mb-1">P Rho</div>
                <div className="font-mono font-bold text-bloomberg-text">
                  {formatNumber(position.individualGreeks.rho, 2)}
                </div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                {position.pnl && position.pnl >= 0 ? (
                  <TrendingUp className="text-trader-green" size={16} />
                ) : (
                  <TrendingDown className="text-trader-red" size={16} />
                )}
                <span className="text-bloomberg-muted">盈亏构成：</span>
                <span className={getPnLColor(position.pnl || 0)}>
                  内在价值 + 时间价值 = {position.pnl !== undefined ? formatCurrency(position.pnl) : '-'}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const PositionPanel: React.FC<PositionPanelProps> = ({
  positions,
  onSelectPosition,
  selectedPositionId,
}) => {
  const totalMarketValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
  const totalPnL = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);

  return (
    <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border overflow-hidden">
      <div className="p-4 border-b border-bloomberg-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">持仓明细</h3>
          <span className="text-sm text-bloomberg-muted">
            共 {positions.filter(p => p.quantity !== 0).length} 个头寸
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-bloomberg-muted">总市值</div>
            <div className="font-mono font-bold">{formatCurrency(totalMarketValue)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-bloomberg-muted">总盈亏</div>
            <div className={`font-mono font-bold ${getPnLColor(totalPnL)}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </div>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto max-h-96 scrollbar-thin">
        <table className="w-full">
          <thead className="bg-bloomberg-bg sticky top-0">
            <tr className="text-xs text-bloomberg-muted">
              <th className="py-3 px-4 text-left font-medium">合约代码</th>
              <th className="py-3 px-4 text-left font-medium">类型</th>
              <th className="py-3 px-4 text-center font-medium">行权价</th>
              <th className="py-3 px-4 text-center font-medium">到期</th>
              <th className="py-3 px-4 text-right font-medium">持仓量</th>
              <th className="py-3 px-4 text-right font-medium">成本价</th>
              <th className="py-3 px-4 text-right font-medium">现价</th>
              <th className="py-3 px-4 text-right font-medium">市值</th>
              <th className="py-3 px-4 text-right font-medium">盈亏</th>
              <th className="py-3 px-4 text-center font-medium">风险标记</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bloomberg-border/50">
            {positions.map((position) => (
              <PositionRow
                key={position.id}
                position={position}
                onSelect={onSelectPosition}
                isSelected={selectedPositionId === position.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
