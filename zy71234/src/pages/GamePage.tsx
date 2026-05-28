import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Pause, Play, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import { CardHand } from '../components/Card/CardHand';
import { CardTable } from '../components/Card/CardTable';
import { PartyPanel } from '../components/Party/PartyPanel';
import { CardDetailModal } from '../components/Common/CardDetailModal';
import { useGameStore } from '../stores/useGameStore';
import { formatCurrency } from '../utils/settlementEngine';
import levelsData from '../data/levels.json';

export function GamePage() {
  const game = useGameStore(state => state.game);
  const setCurrentPage = useGameStore(state => state.setCurrentPage);
  const pauseGame = useGameStore(state => state.pauseGame);
  const resumeGame = useGameStore(state => state.resumeGame);
  const restartGame = useGameStore(state => state.restartGame);
  const endRound = useGameStore(state => state.endRound);
  const calculateSettlement = useGameStore(state => state.calculateSettlement);
  const [showPauseMenu, setShowPauseMenu] = useState(false);

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎵</div>
          <p className="text-gray-400 mb-4">游戏未开始</p>
          <button
            onClick={() => setCurrentPage('levels')}
            className="px-6 py-3 bg-music-gold text-music-dark font-bold rounded-lg"
          >
            选择关卡
          </button>
        </div>
      </div>
    );
  }

  const level = levelsData.find(l => l.id === game.levelId);
  const isLastRound = game.currentRound >= game.maxRounds;
  const totalSplit = game.partyStates.reduce((sum, p) => sum + p.splitPercentage, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-music-card/80 backdrop-blur-sm border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPauseMenu(true)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-lg font-bold text-music-gold">
                {level?.name || '版权谈判'}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>回合 {game.currentRound}/{game.maxRounds}</span>
                <span>总营收 {formatCurrency(game.totalRevenue)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              totalSplit >= 95 && totalSplit <= 105
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {totalSplit >= 95 && totalSplit <= 105 ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              分成 {totalSplit.toFixed(1)}%
            </div>

            <button
              onClick={() => game.status === 'paused' ? resumeGame() : pauseGame()}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              {game.status === 'paused' ? (
                <Play className="w-5 h-5" />
              ) : (
                <Pause className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={restartGame}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="重新开始"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          <PartyPanel
            parties={game.partyStates}
            totalRevenue={game.totalRevenue}
          />

          <CardTable cards={game.tableCards} title="谈判桌 - 已打出的卡牌" />

          <div className="flex justify-center gap-4">
            <button
              onClick={endRound}
              disabled={game.status !== 'playing'}
              className={`px-6 py-3 rounded-lg font-bold transition-all ${
                isLastRound
                  ? 'bg-music-gold text-music-dark hover:shadow-lg hover:shadow-music-gold/30'
                  : 'bg-music-card border border-music-gold/50 text-music-gold hover:bg-music-gold/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLastRound ? '💰 完成谈判 & 结算' : '下一回合 →'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-music-card/80 backdrop-blur-sm border-t border-white/10">
        <CardHand cards={game.playerHand} />
      </div>

      <AnimatePresence>
        {showPauseMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowPauseMenu(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-music-card rounded-2xl p-8 max-w-md w-full mx-4 border border-music-gold/30"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-serif text-music-gold font-bold text-center mb-8">
                游戏暂停
              </h2>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    setShowPauseMenu(false);
                    resumeGame();
                  }}
                  className="w-full py-3 bg-music-gold text-music-dark font-bold rounded-lg
                    hover:shadow-lg hover:shadow-music-gold/30 transition-all"
                >
                  继续游戏
                </button>

                <button
                  onClick={() => {
                    setShowPauseMenu(false);
                    restartGame();
                  }}
                  className="w-full py-3 bg-music-card border border-music-gold/50 text-music-gold
                    font-bold rounded-lg hover:bg-music-gold/10 transition-all"
                >
                  重新开始
                </button>

                <button
                  onClick={() => {
                    setShowPauseMenu(false);
                    setCurrentPage('levels');
                  }}
                  className="w-full py-3 bg-music-card border border-gray-600 text-gray-400
                    font-bold rounded-lg hover:bg-white/5 transition-all"
                >
                  返回关卡选择
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardDetailModal />
    </div>
  );
}
