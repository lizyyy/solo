import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, Home, FileText } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { NewsBanner } from '@/components/common/NewsBanner';
import { PortfolioStats } from '@/components/common/PortfolioStats';
import { BondHoldingsTable } from '@/components/common/BondHoldingsTable';
import { AnomalyAlert } from '@/components/common/AnomalyAlert';
import { RatingBadge } from '@/components/ui/RatingBadge';
import { formatDateTime } from '@/utils/format';
import type { Round } from '@/types';

const ReviewPage: React.FC = () => {
  const { gameId = '' } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { getSavedGame } = useGameStore();

  const [game, setGame] = useState<ReturnType<typeof getSavedGame> | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const savedGame = getSavedGame(gameId);
    if (savedGame) {
      setGame(savedGame);
    }
  }, [gameId, getSavedGame]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && game) {
      timer = setInterval(() => {
        setCurrentRoundIndex((prev) => {
          if (prev >= game.rounds.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, game]);

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">未找到游戏记录</div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const currentRound = game.rounds[currentRoundIndex] as Round;
  const isLastRound = currentRoundIndex >= game.rounds.length - 1;

  const handlePrev = () => {
    setCurrentRoundIndex((prev) => Math.max(0, prev - 1));
    setIsPlaying(false);
  };

  const handleNext = () => {
    setCurrentRoundIndex((prev) => Math.min(game.rounds.length - 1, prev + 1));
    setIsPlaying(false);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">复盘回放</h1>
                <div className="text-xs text-gray-400">
                  {formatDateTime(game.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/report/${game.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                查看报告
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-400">
              第 {currentRoundIndex + 1} 回合 / 共 {game.rounds.length} 回合
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentRoundIndex === 0}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={handleNext}
                disabled={isLastRound}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentRoundIndex + 1) / game.rounds.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {currentRound.news && (
          <NewsBanner 
            news={currentRound.news} 
            roundNumber={currentRoundIndex + 1}
            totalRounds={game.rounds.length}
          />
        )}

        <PortfolioStats game={game} />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BondHoldingsTable
              holdings={currentRound.holdingsAfter || game.holdings}
              affectedBondCodes={currentRound.affectedBondCodes || []}
              onSelectBond={() => {}}
              onSubmitRating={() => {}}
              isPlaying={false}
              newsDirection={currentRound.news?.direction}
            />
          </div>

          <div className="space-y-6">
            {currentRound.action && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <h4 className="text-white font-semibold mb-4">本回合操作</h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">操作债券</span>
                    <span className="text-white font-medium">
                      {currentRound.action.bondCode}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">原评级</span>
                    <RatingBadge rating={currentRound.action.oldRating} size="sm" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">新评级</span>
                    <RatingBadge rating={currentRound.action.newRating} size="sm" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">正确评级</span>
                    <RatingBadge rating={currentRound.correctRating || '-'} size="sm" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">本回合得分</span>
                    <span className={`font-bold ${currentRound.roundScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {currentRound.roundScore >= 0 ? '+' : ''}{currentRound.roundScore}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-gray-400 text-sm mb-1">调整理由</div>
                    <div className="text-gray-300 text-sm">
                      {currentRound.action.reason || '未填写'}
                    </div>
                  </div>

                  {currentRound.feedback && (
                    <div className="pt-3 border-t border-slate-700">
                      <div className="text-gray-400 text-sm mb-1">系统反馈</div>
                      <div className="text-gray-300 text-sm">
                        {currentRound.feedback}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentRound.anomalies && currentRound.anomalies.length > 0 && (
              <AnomalyAlert anomalies={currentRound.anomalies} />
            )}

            {!currentRound.action && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="text-amber-400 font-semibold mb-2">⏰ 超时未操作</div>
                <div className="text-gray-300 text-sm">
                  本回合未能在规定时间内完成评级调整。
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewPage;
