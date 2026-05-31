import { useState, useEffect, useCallback } from 'react';
import { GameCanvas } from '@/components/game/GameCanvas';
import { GameHUD } from '@/components/game/GameHUD';
import { GameControls } from '@/components/game/GameControls';
import { GameEngine, checkUnfinishedGame } from '@/game/GameEngine';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { submitPlayerScore, initDefaultLevelIfNeeded } from '@/services/DataService';
import { FriendlyError, getErrorMessage } from '@/utils/errorMessages';
import type { GameState } from '@/types/game';
import { Play, RotateCcw, User, Trophy } from 'lucide-react';

export default function GamePage() {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [playerName, setPlayerName] = useState('');

  const { levelConfig, setLevelConfig, setGameState: setStoreGameState, showResumeDialog, setShowResumeDialog, savedGame, setSavedGame, setLastScore, resetGame } = useGameStore();
  const { showError, showSuccess, showWarning, openModal, closeModal } = useUIStore();

  useEffect(() => {
    const init = async () => {
      try {
        const level = await initDefaultLevelIfNeeded();
        setLevelConfig(level);

        const unfinished = await checkUnfinishedGame();
        if (unfinished && !unfinished.gameState.isGameOver) {
          setSavedGame(unfinished);
          setShowResumeDialog(true);
        }
      } catch (error) {
        if (error instanceof FriendlyError) {
          showError(getErrorMessage(error.code));
        } else {
          showError(getErrorMessage('UNKNOWN_ERROR'));
        }
      }
    };
    init();
  }, [setLevelConfig, setSavedGame, setShowResumeDialog, showError]);

  const handleStateChange = useCallback((state: GameState) => {
    setGameState(state);
    setStoreGameState(state);
  }, [setStoreGameState]);

  const handleGameOver = useCallback(async (score: number, state: GameState) => {
    setIsStarted(false);
    if (playerName.trim()) {
      try {
        const savedScore = await submitPlayerScore(playerName.trim(), levelConfig!.id, state);
        setLastScore(savedScore);
        
        if (savedScore.status === 'pending') {
          showWarning(`分数已提交，但系统觉得有点高，已标记待复核。来源：${savedScore.anomalyDetail?.sourceType === 'level_draft' ? '关卡草表' : '玩家反馈'}，下一步：${savedScore.anomalyDetail?.contact}`);
        } else {
          showSuccess(`游戏结束！最终得分：${score} 分，已保存`);
        }
      } catch (error) {
        if (error instanceof FriendlyError) {
          showError(getErrorMessage(error.code));
        } else {
          showError(getErrorMessage('UNKNOWN_ERROR'));
        }
      }
    }
  }, [playerName, levelConfig, setLastScore, showSuccess, showWarning, showError]);

  const startGame = (resumeFromSave?: GameState) => {
    if (!levelConfig) return;

    if (!playerName.trim()) {
      openModal({
        title: '请输入你的名字',
        confirmText: '开始游戏',
        cancelText: '取消',
        onConfirm: () => {
          closeModal();
          if (playerName.trim()) {
            startGame(resumeFromSave);
          }
        },
      });
      return;
    }

    const newEngine = new GameEngine(levelConfig, resumeFromSave);
    newEngine.setOnStateChange(handleStateChange);
    newEngine.setOnGameOver(handleGameOver);
    
    setEngine(newEngine);
    setIsStarted(true);
    newEngine.start();
    setShowResumeDialog(false);
  };

  const handleResume = () => {
    if (savedGame) {
      startGame(savedGame.gameState);
    }
  };

  const handleNewGame = () => {
    if (engine) {
      engine.stop();
    }
    resetGame();
    setEngine(null);
    setGameState(null);
    setIsStarted(false);
    setShowResumeDialog(false);
  };

  const handleRestart = () => {
    openModal({
      title: '确定要重新开始吗？',
      error: {
        code: 'CONFIRM_RESTART',
        message: '当前进度将会丢失',
        suggestion: '重新开始后，之前的分数会被清除，确定要继续吗？',
        contact: '有问题找运营组 @活动负责人',
      },
      confirmText: '重新开始',
      cancelText: '取消',
      onConfirm: () => {
        closeModal();
        handleNewGame();
      },
    });
  };

  const handlePauseResume = () => {
    if (!engine) return;
    const state = engine.getState();
    if (state.isPaused) {
      engine.resume();
    } else {
      engine.pause();
    }
  };

  const handleCustomerClick = (customerId: string) => {
    if (engine) {
      engine.serveCustomer(customerId);
    }
  };

  const handleSetPrice = (productId: string, price: number) => {
    if (engine) {
      engine.setPrice(productId, price);
    }
  };

  const handleRestock = (productId: string, amount: number) => {
    if (engine) {
      engine.restock(productId, amount);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-deep-purple via-neon-purple/30 to-deep-purple p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-title text-4xl md:text-5xl text-neon-orange mb-2 drop-shadow-[0_0_10px_rgba(255,107,53,0.5)]">
            🌙 夜市摊位经营赛
          </h1>
          <p className="text-gray-300 font-body">用心经营你的夜市小铺，服务每一位顾客！</p>
        </div>

        {showResumeDialog && savedGame && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-deep-purple border-2 border-neon-orange rounded-2xl p-6 max-w-md w-full shadow-neon-orange">
              <h3 className="font-title text-2xl text-neon-orange mb-4">🔄 发现未完成的游戏</h3>
              <p className="text-gray-300 mb-2 font-body">
                检测到上次有未完成的游戏，保存时间：{new Date(savedGame.savedAt).toLocaleString('zh-CN')}
              </p>
              <p className="text-neon-yellow mb-6 font-body">
                当时分数：{savedGame.gameState.score} 分 | 剩余时间：{Math.ceil(savedGame.gameState.timeRemaining)} 秒
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleResume}
                  className="flex-1 bg-neon-green text-deep-purple font-bold py-3 px-4 rounded-xl hover:shadow-neon-green transition-all font-body"
                >
                  继续游戏
                </button>
                <button
                  onClick={() => setShowResumeDialog(false)}
                  className="flex-1 bg-gray-700 text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-600 transition-all font-body"
                >
                  暂不恢复
                </button>
              </div>
            </div>
          </div>
        )}

        {!isStarted && !showResumeDialog && (
          <div className="bg-deep-purple/80 backdrop-blur border-2 border-neon-purple rounded-2xl p-8 max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-neon-orange" />
              <input
                type="text"
                placeholder="输入你的名字..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="flex-1 bg-neon-purple/20 border-2 border-neon-purple/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-neon-orange focus:outline-none font-body transition-all"
              />
            </div>
            <div className="bg-neon-purple/10 rounded-xl p-4 mb-6">
              <h4 className="text-neon-yellow font-bold mb-2 font-body">🎮 游戏说明</h4>
              <ul className="text-gray-300 text-sm space-y-1 font-body">
                <li>• 点击正在点餐的顾客可以快速上菜</li>
                <li>• 注意库存，及时补货</li>
                <li>• 合理定价，平衡收益和顾客满意度</li>
                <li>• 游戏每5秒自动保存，断线也不怕</li>
              </ul>
            </div>
            <button
              onClick={() => startGame()}
              disabled={!playerName.trim()}
              className="w-full bg-neon-orange text-white font-bold py-4 px-6 rounded-xl hover:shadow-neon-orange transition-all flex items-center justify-center gap-2 font-body text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-6 h-6" />
              开始游戏
            </button>
          </div>
        )}

        {isStarted && (
          <div className="space-y-6">
            {gameState && (
              <GameHUD 
                state={gameState} 
                levelName={levelConfig?.name || ''}
                playerName={playerName}
              />
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <GameCanvas engine={engine} onCustomerClick={handleCustomerClick} />
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={handlePauseResume}
                    className="flex-1 bg-neon-purple text-white font-bold py-3 px-4 rounded-xl hover:shadow-neon-purple transition-all flex items-center justify-center gap-2 font-body"
                  >
                    {gameState?.isPaused ? <Play className="w-5 h-5" /> : '⏸'}
                    {gameState?.isPaused ? '继续' : '暂停'}
                  </button>
                  <button
                    onClick={handleRestart}
                    className="bg-gray-700 text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-600 transition-all flex items-center justify-center gap-2 font-body"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>

                {levelConfig && gameState && (
                  <GameControls
                    products={levelConfig.products}
                    prices={gameState.prices}
                    inventory={gameState.inventory}
                    revenue={gameState.revenue}
                    onSetPrice={handleSetPrice}
                    onRestock={handleRestock}
                  />
                )}

                {gameState?.isGameOver && (
                  <div className="bg-neon-orange/20 border-2 border-neon-orange rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-6 h-6 text-neon-yellow" />
                      <span className="font-title text-xl text-neon-yellow">游戏结束！</span>
                    </div>
                    <p className="text-white font-body">最终得分：<span className="text-neon-orange font-bold text-2xl">{gameState.score}</span> 分</p>
                    <p className="text-gray-300 text-sm font-body mt-1">服务顾客：{gameState.totalCustomersServed} 位 | 满意度：{Math.floor(gameState.satisfaction)}%</p>
                    <button
                      onClick={handleNewGame}
                      className="w-full mt-4 bg-neon-orange text-white font-bold py-3 px-4 rounded-xl hover:shadow-neon-orange transition-all font-body"
                    >
                      再来一局
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
