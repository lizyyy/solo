import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Save, Home, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useTimer } from '@/hooks/useTimer';
import { NewsBanner } from '@/components/common/NewsBanner';
import { PortfolioStats } from '@/components/common/PortfolioStats';
import { BondHoldingsTable } from '@/components/common/BondHoldingsTable';
import { AnomalyAlert } from '@/components/common/AnomalyAlert';
import { RoundResultModal } from '@/components/common/RoundResultModal';
import { CircularTimer } from '@/components/ui/CircularTimer';
import { GameEngine } from '@/engine/gameEngine';
import { GAME_CONFIG } from '@/data/constants';
import type { Round, RatingAction, Anomaly } from '@/types';

const GamePage: React.FC = () => {
  const { mode = 'standard' } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const {
    game,
    initializeGame,
    submitRating,
    nextRound,
    finishGame,
    saveGame,
    setSelectedBond,
  } = useGameStore();

  const [showResult, setShowResult] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [currentAnomalies, setCurrentAnomalies] = useState<Anomaly[]>([]);

  const currentRound = game ? game.rounds[game.currentRoundIndex] : null;

  const timeLimit = mode === 'tutorial'
    ? GAME_CONFIG.tutorialTimeLimit
    : GAME_CONFIG.standardTimeLimit;

  const { timeLeft, isRunning, startTimer, stopTimer, resetTimer } = useTimer(
    timeLimit,
    {
      onComplete: () => {
        handleTimeout();
      },
      autoStart: false,
    }
  );

  useEffect(() => {
    initializeGame(mode);
  }, [initializeGame, mode]);

  useEffect(() => {
    if (game?.status === 'playing' && !isRunning) {
      startTimer();
    }
  }, [game?.status, isRunning, startTimer]);

  useEffect(() => {
    if (currentRound?.anomalies) {
      setCurrentAnomalies(currentRound.anomalies);
    }
  }, [currentRound?.anomalies]);

  const handleTimeout = useCallback(() => {
    if (game) {
      const result = GameEngine.handleTimeout(game);
      setCurrentAnomalies(result.anomalies || []);
      setShowResult(true);
    }
  }, [game]);

  const handleSubmitRating = useCallback((action: RatingAction) => {
    const result = submitRating(action);
    if (result) {
      stopTimer();
      setCurrentAnomalies(result.anomalies || []);
      setShowResult(true);
    }
  }, [submitRating, stopTimer]);

  const handleNextRound = useCallback(() => {
    setShowResult(false);
    setShowAnomalies(true);
    setSelectedBond(null);
    resetTimer();

    if (game && game.currentRoundIndex >= game.totalRounds - 1) {
      finishGame();
      navigate(`/report/${game.id}`);
    } else {
      nextRound();
    }
  }, [game, nextRound, finishGame, navigate, resetTimer, setSelectedBond]);

  const handleSaveGame = useCallback(() => {
    if (game) {
      saveGame(game);
      alert('游戏已保存');
    }
  }, [game, saveGame]);

  const handleExit = useCallback(() => {
    if (confirm('确定要退出游戏吗？未保存的进度将丢失。')) {
      navigate('/');
    }
  }, [navigate]);

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const timerColor = timeLeft > timeLimit * 0.5
    ? 'emerald'
    : timeLeft > timeLimit * 0.25
    ? 'amber'
    : 'red';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleExit}
                className="p-2 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
              >
                <Home className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">债券评级急救室</h1>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>
                    {mode === 'standard' ? '标准模式' : mode === 'tutorial' ? '新手教学' : '新人样例'}
                  </span>
                  <span>·</span>
                  <span>
                    回合 {game.currentRoundIndex + 1} / {game.totalRounds}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <CircularTimer
                  timeLeft={timeLeft}
                  totalTime={timeLimit}
                  color={timerColor}
                  size={56}
                  strokeWidth={4}
                />
                <div className="text-right hidden sm:block">
                  <div className="text-white font-bold text-lg">{timeLeft}s</div>
                  <div className="text-xs text-gray-400">剩余时间</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveGame}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">保存</span>
                </button>
                <button
                  onClick={handleExit}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white text-sm transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {currentRound?.news && (
          <NewsBanner 
            news={currentRound.news} 
            roundNumber={game.currentRoundIndex + 1}
            totalRounds={game.totalRounds}
          />
        )}

        <PortfolioStats game={game} />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BondHoldingsTable
              holdings={game.holdings}
              affectedBondCodes={currentRound?.affectedBondCodes || []}
              onSelectBond={setSelectedBond}
              onSubmitRating={handleSubmitRating}
              isPlaying={game.status === 'playing'}
              newsDirection={currentRound?.news?.direction}
            />
          </div>

          <div className="space-y-6">
            {showAnomalies && currentAnomalies.length > 0 && (
              <AnomalyAlert
                anomalies={currentAnomalies}
                onClose={() => setShowAnomalies(false)}
              />
            )}

            {mode === 'tutorial' && currentRound?.news && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  教学提示
                </h4>
                <div className="text-sm text-gray-300 space-y-2">
                  <p>📰 这条新闻的类型是：<strong>{currentRound.news.type}</strong></p>
                  <p>⬆️ 预期方向：<strong className={currentRound.news.direction === 'upgrade' ? 'text-emerald-400' : currentRound.news.direction === 'downgrade' ? 'text-red-400' : 'text-gray-400'}>
                    {currentRound.news.direction === 'upgrade' ? '上调评级' : currentRound.news.direction === 'downgrade' ? '下调评级' : '维持评级'}
                  </strong></p>
                  <p>🎯 受影响债券：{currentRound.affectedBondCodes.join(', ')}</p>
                  <p className="text-gray-400 mt-2">💡 请根据新闻信息调整相关债券的评级，并填写调整理由。</p>
                </div>
              </div>
            )}

            {game.selectedBond && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <h4 className="text-white font-semibold mb-3">操作提示</h4>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">1.</span>
                    选择新的评级档位
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">2.</span>
                    填写调整理由（必填）
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">3.</span>
                    查看预期净值影响
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">4.</span>
                    点击提交评级
                  </li>
                </ul>
              </div>
            )}

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <h4 className="text-white font-semibold mb-3">评分规则</h4>
              <div className="text-sm text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>评级方向正确</span>
                  <span className="text-emerald-400">+20 分</span>
                </div>
                <div className="flex justify-between">
                  <span>评级档位完全匹配</span>
                  <span className="text-emerald-400">+10 分</span>
                </div>
                <div className="flex justify-between">
                  <span>时间奖励（剩余&gt;30s）</span>
                  <span className="text-blue-400">+5 分</span>
                </div>
                <div className="flex justify-between">
                  <span>评级方向错误</span>
                  <span className="text-red-400">-15 分</span>
                </div>
                <div className="flex justify-between">
                  <span>超时未操作</span>
                  <span className="text-red-400">-20 分</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showResult && currentRound && (
          <RoundResultModal
            round={currentRound}
            roundNumber={game.currentRoundIndex + 1}
            totalRounds={game.totalRounds}
            isLastRound={game.currentRoundIndex >= game.totalRounds - 1}
            onNext={handleNextRound}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamePage;
