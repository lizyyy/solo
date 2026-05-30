import { useGameStore } from '../store/gameStore';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Target, Calendar } from 'lucide-react';
import { calculateTotalAssets } from '../logic/trading';

export function InfoPanel() {
  const { currentRound, totalRounds, marketRate, initialRate, cash, initialCash, positions, bonds } = useGameStore();

  const totalAssets = calculateTotalAssets(cash, positions, bonds);
  const totalReturn = totalAssets - initialCash;
  const returnRate = ((totalReturn / initialCash) * 100).toFixed(2);
  const rateChange = marketRate - initialRate;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-amber-200">
      <h2 className="text-lg font-bold text-amber-800 mb-4 flex items-center gap-2">
        <Target className="text-amber-500" size={20} />
        市场信息
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Calendar size={16} />
            <span className="text-xs font-medium">回合</span>
          </div>
          <div className="text-2xl font-bold text-blue-800">
            {currentRound} / {totalRounds}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            {rateChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="text-xs font-medium">市场利率</span>
          </div>
          <div className="text-2xl font-bold text-purple-800">
            {marketRate.toFixed(2)}%
          </div>
          <div className={`text-xs ${rateChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {rateChange >= 0 ? '+' : ''}{rateChange.toFixed(2)}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <PiggyBank size={16} />
            <span className="text-xs font-medium">现金</span>
          </div>
          <div className="text-2xl font-bold text-green-800">
            ¥{cash.toLocaleString()}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <DollarSign size={16} />
            <span className="text-xs font-medium">总资产</span>
          </div>
          <div className="text-2xl font-bold text-orange-800">
            ¥{totalAssets.toLocaleString()}
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-3">
          <div className="flex items-center gap-2 text-pink-600 mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">总收益</span>
          </div>
          <div className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalReturn >= 0 ? '+' : ''}¥{totalReturn.toLocaleString()}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-3">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Target size={16} />
            <span className="text-xs font-medium">收益率</span>
          </div>
          <div className={`text-2xl font-bold ${parseFloat(returnRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {parseFloat(returnRate) >= 0 ? '+' : ''}{returnRate}%
          </div>
        </div>
      </div>
    </div>
  );
}
