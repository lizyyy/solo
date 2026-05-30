import { Bond, Position } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { calculatePositionPnL } from '../logic/trading';
import { Clock, Percent, DollarSign, Calendar, Info } from 'lucide-react';

interface BondCardProps {
  bond: Bond;
  position?: Position;
  isSelected: boolean;
  onSelect: () => void;
}

export function BondCard({ bond, position, isSelected, onSelect }: BondCardProps) {
  const { currentRound, status } = useGameStore();
  
  const remainingRounds = Math.max(0, bond.maturityRound - currentRound);
  const pnl = position ? calculatePositionPnL(position, bond) : null;
  
  const priceChange = bond.currentPrice - bond.faceValue;
  const priceChangePercent = ((priceChange / bond.faceValue) * 100).toFixed(2);

  const isMatured = remainingRounds === 0;

  return (
    <div
      onClick={status === 'playing' ? onSelect : undefined}
      className={`relative bg-white rounded-2xl p-5 shadow-lg border-2 transition-all duration-300 cursor-pointer ${
        isSelected
          ? 'border-amber-500 ring-4 ring-amber-200 transform scale-105'
          : 'border-gray-200 hover:border-amber-300 hover:shadow-xl'
      } ${isMatured ? 'opacity-60' : ''}`}
    >
      <div className="absolute top-3 right-3">
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
          remainingRounds <= 2 ? 'bg-red-100 text-red-700' :
          remainingRounds <= 5 ? 'bg-yellow-100 text-yellow-700' :
          'bg-green-100 text-green-700'
        }`}>
          {isMatured ? '已到期' : `剩${remainingRounds}回合`}
        </span>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          📜 {bond.name}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          来源: {bond.source} | 版本: {bond.version}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="flex items-center gap-1 text-blue-600 text-xs mb-1">
            <DollarSign size={12} />
            <span>面值</span>
          </div>
          <div className="text-xl font-bold text-blue-800">¥{bond.faceValue}</div>
        </div>

        <div className="bg-purple-50 rounded-xl p-3">
          <div className="flex items-center gap-1 text-purple-600 text-xs mb-1">
            <Percent size={12} />
            <span>票息率</span>
          </div>
          <div className="text-xl font-bold text-purple-800">{bond.couponRate}%</div>
        </div>

        <div className="bg-amber-50 rounded-xl p-3">
          <div className="flex items-center gap-1 text-amber-600 text-xs mb-1">
            <DollarSign size={12} />
            <span>当前价格</span>
          </div>
          <div className={`text-xl font-bold ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ¥{bond.currentPrice.toFixed(2)}
          </div>
          <div className={`text-xs ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {priceChange >= 0 ? '+' : ''}{parseFloat(priceChangePercent) >= 0 ? '+' : ''}{priceChangePercent}%
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-1 text-gray-600 text-xs mb-1">
            <Calendar size={12} />
            <span>到期回合</span>
          </div>
          <div className="text-xl font-bold text-gray-800">第{bond.maturityRound}回合</div>
        </div>
      </div>

      {position && position.quantity > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">持仓: </span>
              <span className="font-bold text-amber-700">{position.quantity} 张</span>
            </div>
            {pnl && (
              <div className="text-right">
                <div className={`text-sm font-bold ${pnl.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnl.unrealizedPnL >= 0 ? '+' : ''}¥{pnl.unrealizedPnL.toFixed(2)}
                </div>
                <div className={`text-xs ${pnl.unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {pnl.unrealizedPnLPercent >= 0 ? '+' : ''}{pnl.unrealizedPnLPercent}%
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
        <Info size={12} />
        <span>每回合票息: ¥{(bond.faceValue * bond.couponRate / 100).toFixed(2)}/张</span>
      </div>
    </div>
  );
}
