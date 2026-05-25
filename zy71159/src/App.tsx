import { useState, useEffect } from 'react';
import { Sprout, Droplets, Info } from 'lucide-react';
import { GameProvider, useGame } from './hooks/useGameState';
import { GameBoard } from './components/GameBoard';
import { ControlPanel } from './components/ControlPanel';
import { InfoPanel } from './components/InfoPanel';
import { ResultModal } from './components/ResultModal';
import { ReplayPlayer } from './components/ReplayPlayer';

function GameContent() {
  const { state, dispatch } = useGame();
  const [showResult, setShowResult] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  useEffect(() => {
    if (state.status === 'won' || state.status === 'lost') {
      setShowResult(true);
    }
  }, [state.status]);

  const handleStartReplay = () => {
    dispatch({ type: 'START_REPLAY' });
    setShowResult(false);
    setShowReplay(true);
  };

  const handleCloseReplay = () => {
    setShowReplay(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-amber-50 to-blue-100">
      <header className="bg-gradient-to-r from-green-700 to-emerald-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sprout className="w-10 h-10" />
              <div>
                <h1 className="text-2xl font-bold">农田灌溉棋盘游戏</h1>
                <p className="text-green-200 text-sm">学习水渠灌溉原理，成为节水小能手</p>
              </div>
            </div>
            <button
              onClick={() => setShowTutorial(!showTutorial)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="游戏说明"
            >
              <Info className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {showTutorial && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-start gap-3">
              <Droplets className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">游戏说明：</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>点击红色/绿色阀门来开关水渠</li>
                  <li>让水流到达所有农田地块，满足作物需水</li>
                  <li>注意天气影响：晴天蒸发快，雨天有额外水量</li>
                  <li>避免过度灌溉和下游断水</li>
                  <li>在限定回合内完成灌溉即可获胜</li>
                </ul>
              </div>
              <button
                onClick={() => setShowTutorial(false)}
                className="text-blue-500 hover:text-blue-700 text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 order-2 lg:order-1 space-y-4">
            <ControlPanel />
            {showReplay && <ReplayPlayer onClose={handleCloseReplay} />}
          </div>

          <div className="lg:col-span-2 order-1 lg:order-2 flex justify-center">
            <GameBoard />
          </div>

          <div className="lg:col-span-1 order-3">
            <InfoPanel />
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-gray-400 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>🌾 农田灌溉棋盘游戏 - 学习农业灌溉知识</p>
          <p className="mt-1 text-gray-500">
            理解下游断水、重复灌溉、天气蒸发等真实灌溉问题
          </p>
        </div>
      </footer>

      {showResult && (
        <ResultModal
          onClose={() => setShowResult(false)}
          onReplay={handleStartReplay}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}
