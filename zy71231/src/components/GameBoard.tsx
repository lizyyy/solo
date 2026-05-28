import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import type { PurchaseDecision, PriceAdjustment, GameEvent } from '../types/game';
import { Header } from './Header';
import { PurchasePanel } from './PurchasePanel';
import { InventoryPanel } from './InventoryPanel';
import { EventLog } from './EventLog';
import { CustomerPanel } from './CustomerPanel';
import { DetailModal } from './DetailModal';
import { GameOverScreen } from './GameOverScreen';
import { HistoryModal } from './HistoryModal';

export const GameBoard: React.FC = () => {
  const { state, actions } = useGame();
  const [selectedPurchases, setSelectedPurchases] = useState<PurchaseDecision[]>([]);
  const [priceAdjustments, setPriceAdjustments] = useState<PriceAdjustment[]>([]);
  const [todayEvents, setTodayEvents] = useState<GameEvent[]>([]);
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; type: string; data: any }>({
    isOpen: false,
    type: '',
    data: null
  });
  const [showWelcome, setShowWelcome] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const hasSavedGame = actions.loadSavedGame();
    if (hasSavedGame) {
      setShowWelcome(false);
    }
  }, []);

  const handleShowDetail = (type: string, data: any) => {
    setDetailModal({ isOpen: true, type, data });
  };

  const handleCloseDetail = () => {
    setDetailModal({ isOpen: false, type: '', data: null });
  };

  const handleAdvanceDay = () => {
    const events = actions.processDay(selectedPurchases, priceAdjustments);
    setTodayEvents(events);
    setSelectedPurchases([]);
    setPriceAdjustments([]);
  };

  const handleStartGame = () => {
    setShowWelcome(false);
  };

  const handleNewGame = () => {
    actions.startNewGame();
    setTodayEvents([]);
    setSelectedPurchases([]);
    setPriceAdjustments([]);
  };

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center">
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">黑胶店进货博弈</h1>
          <p className="text-gray-500 mb-6">Vinyl Store Tycoon</p>
          
          <div className="bg-amber-50 rounded-xl p-4 mb-6 text-left">
            <h3 className="font-bold text-amber-800 mb-2">📖 游戏说明</h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• 你将经营一家黑胶唱片店，为期14天</li>
              <li>• 每天可以进货新唱片、调整售价</li>
              <li>• 研究顾客偏好，进对的货才能赚钱</li>
              <li>• 注意现金流转，避免资金链断裂</li>
              <li>• 目标：最终利润超过¥100即为成功</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleStartGame}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg"
            >
              🚀 开始经营
            </button>
            <button
              onClick={handleNewGame}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              🔄 新游戏
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium transition-colors"
            >
              📜 查看历史对局
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            游戏进度会自动保存，刷新页面也不会丢失
          </p>
        </div>

        <HistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <main className="max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewGame}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              🔄 重新开始
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>游戏ID: {state.gameId.slice(0, 8)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <PurchasePanel
              selectedPurchases={selectedPurchases}
              onPurchaseChange={setSelectedPurchases}
              onShowDetail={handleShowDetail}
            />
          </div>

          <div className="lg:col-span-1 space-y-4">
            <InventoryPanel
              priceAdjustments={priceAdjustments}
              onPriceChange={setPriceAdjustments}
              onShowDetail={handleShowDetail}
            />
            
            <div className="bg-white rounded-xl shadow-lg p-4">
              <button
                onClick={handleAdvanceDay}
                disabled={state.isGameOver}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-xl font-bold text-lg transition-all shadow-lg"
              >
                ⏭️ 结束今天，进入第 {state.day + 1} 天
              </button>
              <p className="text-center text-xs text-gray-500 mt-2">
                点击后将模拟顾客购买行为
              </p>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <CustomerPanel onShowDetail={handleShowDetail} />
            <EventLog events={todayEvents.length > 0 ? todayEvents : state.gameEvents} />
          </div>
        </div>
      </main>

      <DetailModal
        isOpen={detailModal.isOpen}
        onClose={handleCloseDetail}
        type={detailModal.type}
        data={detailModal.data}
      />

      {state.isGameOver && <GameOverScreen />}
      
      <HistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
      />
    </div>
  );
};
