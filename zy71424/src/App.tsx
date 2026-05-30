import { useState } from 'react';
import { MixerBoard } from '@/components/mixer/MixerBoard';
import { GameControls } from '@/components/game/GameControls';
import { StatusPanel } from '@/components/game/StatusPanel';
import { EventLog } from '@/components/game/EventLog';
import { ReviewPanel } from '@/components/review/ReviewPanel';
import { ClueOrganizer } from '@/components/assistant/ClueOrganizer';
import { WelcomeGuide } from '@/components/WelcomeGuide';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useGameStore } from '@/store/useGameStore';
import { Music2, Play, HelpCircle, FileText } from 'lucide-react';

function App() {
  const [showGuide, setShowGuide] = useState(false);
  const status = useGameStore(state => state.status);
  const startGame = useGameStore(state => state.startGame);
  const loadSampleData = useGameStore(state => state.loadSampleData);
  const toggleReview = useGameStore(state => state.toggleReview);
  const toggleClueOrganizer = useGameStore(state => state.toggleClueOrganizer);

  useGameLoop();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <header className="bg-gray-900/80 backdrop-blur border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Music2 className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">混音台救场夜</h1>
                <p className="text-xs text-gray-400">Livehouse 调音师培训模拟器</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadSampleData}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                <FileText size={16} />
                加载样例
              </button>
              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                <HelpCircle size={16} />
                帮助
              </button>
              {status === 'idle' && (
                <button
                  onClick={() => setShowGuide(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-sm font-medium transition-all hover:scale-105"
                >
                  <Play size={16} />
                  开始
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {status === 'idle' && (
          <div className="mb-6 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-2xl p-6 border border-purple-500/30">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">准备好成为今晚的调音师了吗？</h2>
                <p className="text-gray-300 mb-4">
                  乐队正在演出，各种突发的调音问题需要你快速处理。调整推子、响应返听请求、避免啸叫和爆峰！
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowGuide(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all hover:scale-105"
                  >
                    <Play size={18} />
                    开始新手引导
                  </button>
                  <button
                    onClick={startGame}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
                  >
                    直接开始
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">4</div>
                  <div className="text-sm text-gray-400">问题类型</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">8</div>
                  <div className="text-sm text-gray-400">声道控制</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">3</div>
                  <div className="text-sm text-gray-400">分钟一局</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-purple-400">∞</div>
                  <div className="text-sm text-gray-400">复盘分析</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <StatusPanel />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <MixerBoard />
            <GameControls />
          </div>

          <div className="space-y-6">
            <EventLog />
            <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-3">快捷操作</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center justify-between">
                  <span>拖动推子</span>
                  <span className="text-gray-500">调整音量</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>点击"已处理"</span>
                  <span className="text-gray-500">解决事件</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>耳机图标</span>
                  <span className="text-gray-500">调整返听</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {status === 'ended' && (
          <div className="mt-6 bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-semibold text-white">演出结束！</h3>
                <p className="text-sm text-gray-400">点击下方按钮查看详细复盘和交接助手</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={toggleReview}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
                >
                  查看复盘
                </button>
                <button
                  onClick={toggleClueOrganizer}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition-colors"
                >
                  交接助手
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-12 py-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>混音台救场夜 - Livehouse 调音师培训模拟器</p>
          <p className="mt-1 text-xs text-gray-600">
            💡 提示：点击顶部"加载样例"可以直接查看预演示的复盘数据
          </p>
        </div>
      </footer>

      <WelcomeGuide show={showGuide} onClose={() => setShowGuide(false)} />
      <ReviewPanel />
      <ClueOrganizer />
    </div>
  );
}

export default App;
