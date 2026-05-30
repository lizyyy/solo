import { useGameStore } from '../store/gameStore';
import { calculateTotalAssets } from '../logic/trading';
import { getErrorTypeLabel, getErrorTypeEmoji } from '../logic/settlement';
import { Trophy, TrendingUp, AlertTriangle, DollarSign, PiggyBank, Target, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export function SettlementView() {
  const { history, initialCash, bonds, positions, cash, errors, couponRecords } = useGameStore();

  const totalAssets = calculateTotalAssets(cash, positions, bonds);
  const totalReturn = totalAssets - initialCash;
  const returnRate = ((totalReturn / initialCash) * 100).toFixed(2);
  
  const totalCouponIncome = couponRecords.reduce((sum, r) => sum + r.actualAmount, 0);

  const chartData = history.map(h => ({
    round: `第${h.round}回合`,
    总资产: Math.round(h.totalAssets),
    现金: Math.round(h.cash)
  }));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-6 shadow-lg border-2 border-amber-300">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-amber-500 rounded-full p-3">
            <Trophy className="text-white" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-amber-900">🐹 游戏结算</h2>
            <p className="text-amber-700">恭喜完成仓鼠债券交易所！</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign size={16} />
              <span className="text-sm">最终资产</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">¥{totalAssets.toLocaleString()}</div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-sm">总收益</span>
            </div>
            <div className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalReturn >= 0 ? '+' : ''}¥{totalReturn.toLocaleString()}
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Target size={16} />
              <span className="text-sm">收益率</span>
            </div>
            <div className={`text-2xl font-bold ${parseFloat(returnRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {parseFloat(returnRate) >= 0 ? '+' : ''}{returnRate}%
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <PiggyBank size={16} />
              <span className="text-sm">票息收入</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">¥{totalCouponIncome.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="text-gray-500" size={20} />
          资产变化曲线
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="round" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="总资产" stroke="#10B981" strokeWidth={2} fill="url(#colorAssets)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-6 shadow-lg border-2 border-red-200">
          <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={20} />
            异常检测 ({errors.length}项)
          </h3>
          
          <div className="space-y-3">
            {errors.map((error) => (
              <div key={error.id} className="bg-white rounded-xl p-4 border border-red-200">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getErrorTypeEmoji(error.type)}</span>
                  <div className="flex-1">
                    <div className="font-bold text-red-700">
                      第{error.round}回合: {getErrorTypeLabel(error.type)}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{error.description}</p>
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">影响指标: </span>
                      <span className="font-medium text-gray-700">{error.impact.metric}</span>
                      <span className="text-gray-500"> | 预期: </span>
                      <span className="text-green-600">{error.impact.expectedValue}</span>
                      <span className="text-gray-500"> | 实际: </span>
                      <span className="text-red-600">{error.impact.actualValue}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="text-gray-500">影响结果: </span>
                      <span className="text-orange-600">{error.affectedResults.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">💡 学习要点</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="font-bold text-blue-800 mb-2">债券价格 vs 利率</h4>
            <p className="text-sm text-blue-700">债券价格与市场利率呈反向关系。利率上升，现有债券价格下跌；利率下降，现有债券价格上涨。</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <h4 className="font-bold text-green-800 mb-2">票息收益</h4>
            <p className="text-sm text-green-700">持有债券每回合可获得票息收入，票息 = 面值 × 票息率。长期持有可获得稳定收益。</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <h4 className="font-bold text-purple-800 mb-2">久期风险</h4>
            <p className="text-sm text-purple-700">到期时间越长的债券，价格对利率变化越敏感。长期债利率风险高但票息也高。</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <h4 className="font-bold text-orange-800 mb-2">到期还本</h4>
            <p className="text-sm text-orange-700">债券到期时按面值赎回，无论当前市场价如何。临近到期的债券价格趋近于面值。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
