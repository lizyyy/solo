import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Settings, HelpCircle, BookOpen } from 'lucide-react';
import { StatusBoard } from '../components/game/StatusBoard';
import { NewsFeed } from '../components/game/NewsFeed';
import { ControlPanel } from '../components/game/ControlPanel';
import { PauseOverlay } from '../components/game/PauseOverlay';
import { PositionTable } from '../components/trade/PositionTable';
import { TradePanel } from '../components/trade/TradePanel';
import { useGameLogic } from '../hooks/useGameLogic';
import type { NewsConfig } from '../types/game';

export default function GamePage() {
  const navigate = useNavigate();
  const { status, settlement } = useGameLogic();
  const [selectedNews, setSelectedNews] = useState<NewsConfig | null>(null);

  const handleSelectNews = (news: NewsConfig) => {
    setSelectedNews(news);
  };

  const handleCloseTradePanel = () => {
    setSelectedNews(null);
  };

  const handleViewReport = () => {
    if (settlement) {
      navigate(`/report/${settlement.gameId}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-primary-500" />
            <div>
              <h1 className="font-serif text-xl font-bold text-neutral-800">股票新闻快反局</h1>
              <p className="text-xs text-neutral-500">投资社团新闻事件快速反应训练系统</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/config')}
              className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="关卡管理"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => navigate('/history')}
              className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="历史记录"
            >
              <History size={20} />
            </button>
            <button
              onClick={() => navigate('/help')}
              className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="使用帮助"
            >
              <HelpCircle size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {status === 'settled' && (
          <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-xl flex items-center justify-between sticky top-[57px] z-30">
            <div>
              <h3 className="font-serif font-semibold text-success-800">对局已完成</h3>
              <p className="text-sm text-success-600">点击右侧按钮查看完整报告</p>
            </div>
            <button
              onClick={handleViewReport}
              className="btn-success flex-shrink-0"
            >
              查看报告
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-6">
            <StatusBoard />
            <ControlPanel />
          </div>

          <div className="col-span-6">
            <NewsFeed onSelectNews={handleSelectNews} />
          </div>

          <div className="col-span-3">
            <PositionTable />
          </div>
        </div>
      </main>

      <PauseOverlay />
      <TradePanel selectedNews={selectedNews} onClose={handleCloseTradePanel} />
    </div>
  );
}
