import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getEventEmoji, getRateChangeDisplay } from '../logic/events';
import { History, ChevronLeft, ChevronRight, Target, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function ReviewView() {
  const { history, totalRounds, bonds, reviewRound, setReviewMode } = useGameStore();
  const [selectedRound, setSelectedRound] = useState(reviewRound || 1);

  const currentSnapshot = history.find(h => h.round === selectedRound);
  
  const chartData = history.map(h => ({
    round: `R${h.round}`,
    总资产: Math.round(h.totalAssets),
    现金: Math.round(h.cash),
    市场利率: h.marketRate * 1000
  }));

  const allBondPrices = history.map(h => {
    const data: any = { round: `R${h.round}` };
    bonds.forEach(b => {
      data[b.name] = h.bondPrices[b.id] || 0;
    });
    return data;
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl p-6 shadow-lg border-2 border-blue-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500 rounded-full p-3">
              <History className="text-white" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-blue-900">📊 复盘分析</h2>
              <p className="text-blue-700">回顾每回合的详细数据</p>
            </div>
          </div>
          <button
            onClick={() => setReviewMode(false)}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-blue-700 rounded-xl font-bold shadow transition-all"
          >
            返回游戏
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setSelectedRound(Math.max(1, selectedRound - 1))}
            disabled={selectedRound <= 1}
            className="p-3 bg-white rounded-full shadow hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={24} className="text-blue-600" />
          </button>
          
          <div className="bg-white rounded-2xl px-8 py-4 shadow-lg">
            <div className="text-center">
              <div className="text-sm text-blue-600">当前回合</div>
              <div className="text-4xl font-bold text-blue-900">{selectedRound} / {totalRounds}</div>
            </div>
          </div>
          
          <button
            onClick={() => setSelectedRound(Math.min(totalRounds, selectedRound + 1))}
            disabled={selectedRound >= totalRounds}
            className="p-3 bg-white rounded-full shadow hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={24} className="text-blue-600" />
          </button>
        </div>
      </div>

      {currentSnapshot && (
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">第 {selectedRound} 回合详情</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                <Target size={14} />
                <span>市场利率</span>
              </div>
              <div className="text-2xl font-bold text-blue-800">{currentSnapshot.marketRate.toFixed(2)}%</div>
            </div>
            
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                <DollarSign size={14} />
                <span>现金</span>
              </div>
              <div className="text-2xl font-bold text-green-800">¥{currentSnapshot.cash.toLocaleString()}</div>
            </div>
            
            <div className="bg-orange-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
                <TrendingUp size={14} />
                <span>总资产</span>
              </div>
              <div className="text-2xl font-bold text-orange-800">¥{currentSnapshot.totalAssets.toLocaleString()}</div>
            </div>
            
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
                <DollarSign size={14} />
                <span>票息收入</span>
              </div>
              <div className="text-2xl font-bold text-purple-800">¥{currentSnapshot.couponIncome.toFixed(2)}</div>
            </div>
          </div>

          {currentSnapshot.event && (
            <div className={`rounded-xl p-4 mb-4 ${
              currentSnapshot.event.direction === 'up' ? 'bg-red-50 border-2 border-red-200' :
              currentSnapshot.event.direction === 'down' ? 'bg-green-50 border-2 border-green-200' :
              'bg-gray-50 border-2 border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <Zap className={
                  currentSnapshot.event.direction === 'up' ? 'text-red-500' :
                  currentSnapshot.event.direction === 'down' ? 'text-green-500' :
                  'text-gray-500'
                } size={24} />
                <div>
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-xl">{getEventEmoji(currentSnapshot.event.direction)}</span>
                    <span>利率变化: {getRateChangeDisplay(currentSnapshot.event.rateChange)}</span>
                  </div>
                  <p className="text-gray-600">{currentSnapshot.event.description}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-bold text-gray-700 mb-3">债券价格</h4>
            <div className="grid grid-cols-3 gap-3">
              {bonds.map(bond => (
                <div key={bond.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-sm text-gray-600">{bond.name}</div>
                  <div className="text-xl font-bold text-gray-800">
                    ¥{currentSnapshot.bondPrices[bond.id]?.toFixed(2) || '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {currentSnapshot.positions.length > 0 && (
            <div className="mt-4">
              <h4 className="font-bold text-gray-700 mb-3">持仓情况</h4>
              <div className="bg-gray-50 rounded-xl p-4">
                {currentSnapshot.positions.map(pos => {
                  const bond = bonds.find(b => b.id === pos.bondId);
                  return (
                    <div key={pos.bondId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-gray-700">{bond?.name}</span>
                      <span className="font-bold text-amber-700">{pos.quantity} 张</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">资产走势</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="round" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="总资产" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
              <Line type="monotone" dataKey="现金" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">债券价格走势</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={allBondPrices}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="round" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[80, 120]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="仓鼠短期债" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
              <Line type="monotone" dataKey="仓鼠中期债" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} />
              <Line type="monotone" dataKey="仓鼠长期债" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">回合时间轴</h3>
        <div className="flex overflow-x-auto gap-2 pb-2">
          {history.map(h => (
            <button
              key={h.round}
              onClick={() => setSelectedRound(h.round)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center transition-all ${
                selectedRound === h.round
                  ? 'bg-blue-500 text-white shadow-lg scale-110'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-lg font-bold">{h.round}</span>
              <span className="text-xs">{h.marketRate.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
