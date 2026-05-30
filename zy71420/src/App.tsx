import { useGameStore } from './store/gameStore';
import { ControlBar } from './components/ControlBar';
import { InfoPanel } from './components/InfoPanel';
import { BondCard } from './components/BondCard';
import { TradePanel } from './components/TradePanel';
import { EventCard } from './components/EventCard';
import { SettlementView } from './components/SettlementView';
import { ReviewView } from './components/ReviewView';
import { ScrollText } from 'lucide-react';

function App() {
  const { bonds, positions, selectedBondId, selectBond, status, reviewMode } = useGameStore();

  if (reviewMode && status !== 'idle') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <ControlBar />
          <div className="mt-6">
            <ReviewView />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <ControlBar />
          <div className="mt-6">
            <SettlementView />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto p-6">
          <ControlBar />
          
          <div className="mt-8 bg-white rounded-3xl p-8 shadow-xl border-2 border-amber-200">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4">🐹</div>
              <h1 className="text-3xl font-bold text-amber-900 mb-2">
                欢迎来到仓鼠债券交易所
              </h1>
              <p className="text-amber-700">
                在轻松的小游戏中理解债券价格、票息和利率变化的关系
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-50 rounded-2xl p-4">
                <div className="text-3xl mb-2">📜</div>
                <h3 className="font-bold text-blue-800 mb-1">债券卡</h3>
                <p className="text-sm text-blue-600">
                  购买不同期限的债券，获取票息收益
                </p>
              </div>
              <div className="bg-purple-50 rounded-2xl p-4">
                <div className="text-3xl mb-2">📈</div>
                <h3 className="font-bold text-purple-800 mb-1">利率事件</h3>
                <p className="text-sm text-purple-600">
                  每回合随机事件影响市场利率
                </p>
              </div>
              <div className="bg-green-50 rounded-2xl p-4">
                <div className="text-3xl mb-2">💰</div>
                <h3 className="font-bold text-green-800 mb-1">现金管理</h3>
                <p className="text-sm text-green-600">
                  合理配置现金和债券，追求收益
                </p>
              </div>
              <div className="bg-orange-50 rounded-2xl p-4">
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-bold text-orange-800 mb-1">复盘分析</h3>
                <p className="text-sm text-orange-600">
                  游戏结束后查看详细数据和学习要点
                </p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <ScrollText className="text-amber-500 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h4 className="font-bold text-amber-800 mb-2">游戏规则</h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• 初始资金 ¥10,000，共 10 回合</li>
                    <li>• 每回合先公布利率事件，然后可以交易债券</li>
                    <li>• 持有债券每回合可获得票息收入</li>
                    <li>• 利率上升 → 债券价格下跌；利率下降 → 债券价格上涨</li>
                    <li>• 债券到期时按面值赎回</li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-gray-500">
              点击上方「开始游戏」按钮开始体验
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <ControlBar />

        {status === 'paused' && (
          <div className="bg-yellow-100 border-2 border-yellow-300 rounded-2xl p-4 text-center">
            <span className="text-2xl">⏸️</span>
            <span className="text-yellow-800 font-bold ml-2">游戏已暂停</span>
          </div>
        )}

        <InfoPanel />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-amber-200">
              <h2 className="text-lg font-bold text-amber-800 mb-4">📜 债券市场</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {bonds.map(bond => (
                  <BondCard
                    key={bond.id}
                    bond={bond}
                    position={positions.find(p => p.bondId === bond.id)}
                    isSelected={selectedBondId === bond.id}
                    onSelect={() => selectBond(bond.id === selectedBondId ? null : bond.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <EventCard />
            <TradePanel />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">💡 投教小贴士</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-bold text-blue-800 mb-2">🔄 反向关系</h4>
              <p className="text-blue-700">
                债券价格与市场利率呈反向变动。记住这个核心关系是理解债券投资的基础！
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <h4 className="font-bold text-green-800 mb-2">⏰ 久期风险</h4>
              <p className="text-green-700">
                到期时间越长的债券，价格对利率变化越敏感。长期债波动大但票息高。
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <h4 className="font-bold text-purple-800 mb-2">🎯 投资策略</h4>
              <p className="text-purple-700">
                预期利率下降时买入长期债，预期利率上升时持有现金或短期债。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
