import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Trash2, Download, Upload, Trophy, Clock, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import type { Difficulty } from '@/types/game';
import { cn } from '@/lib/utils';

const difficultyConfig: Record<Difficulty, { label: string; desc: string; rounds: number; color: string }> = {
  easy: { label: '新手模式', desc: '8回合，事件频率低', rounds: 8, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  normal: { label: '标准模式', desc: '12回合，正常事件频率', rounds: 12, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  hard: { label: '挑战模式', desc: '16回合，高事件频率', rounds: 16, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export function Lobby() {
  const navigate = useNavigate();
  const [showNewGame, setShowNewGame] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal');
  const [gameTitle, setGameTitle] = useState('');
  const [importData, setImportData] = useState('');
  const [showImport, setShowImport] = useState(false);

  const games = useGameStore((state) => state.games);
  const gameStates = useGameStore((state) => state.gameStates);
  const createGame = useGameStore((state) => state.createGame);
  const deleteGame = useGameStore((state) => state.deleteGame);
  const importGame = useGameStore((state) => state.importGame);
  const exportGame = useGameStore((state) => state.exportGame);

  const handleCreateGame = () => {
    const title = gameTitle.trim() || `棋局 ${new Date().toLocaleDateString()}`;
    const gameId = createGame(title, selectedDifficulty);
    navigate(`/game/${gameId}`);
  };

  const handleImport = () => {
    const gameId = importGame(importData);
    if (gameId) {
      setShowImport(false);
      setImportData('');
      navigate(`/game/${gameId}`);
    }
  };

  const handleExport = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const data = exportGame(gameId);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omcb-game-${gameId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个对局吗？')) {
      deleteGame(gameId);
    }
  };

  const sortedGames = [...games].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-3">
            <span className="text-gold-400">央行公开市场</span>
            <span className="text-navy-200"> · 棋局</span>
          </h1>
          <p className="text-navy-400">
            通过逆回购、MLF等政策工具，管理银行体系流动性，观察利率传导机制
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <button
            onClick={() => setShowNewGame(true)}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-navy-900 font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 shadow-lg shadow-gold-500/25"
          >
            <Plus size={24} />
            创建新对局
          </button>
        </motion.div>

        <AnimatePresence>
          {showNewGame && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-6">
                <h3 className="font-semibold text-gold-400 mb-4">设置新对局</h3>
                
                <div className="mb-4">
                  <label className="block text-sm text-navy-400 mb-2">对局名称</label>
                  <input
                    type="text"
                    value={gameTitle}
                    onChange={(e) => setGameTitle(e.target.value)}
                    placeholder="输入对局名称（可选）"
                    className="w-full bg-navy-900/50 border border-navy-600 rounded-lg px-4 py-3 input-focus"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-navy-400 mb-2">难度选择</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(Object.keys(difficultyConfig) as Difficulty[]).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-all text-left',
                          selectedDifficulty === diff
                            ? 'border-gold-500 bg-gold-500/10'
                            : 'border-navy-600 hover:border-navy-500'
                        )}
                      >
                        <div className={cn('text-xs px-2 py-0.5 rounded inline-block mb-2 border', difficultyConfig[diff].color)}>
                          {difficultyConfig[diff].label}
                        </div>
                        <div className="text-sm text-navy-300">{difficultyConfig[diff].desc}</div>
                        <div className="text-xs text-navy-500 mt-1 flex items-center gap-1">
                          <Target size={12} />
                          {difficultyConfig[diff].rounds} 回合
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowNewGame(false)}
                    className="flex-1 bg-navy-700 hover:bg-navy-600 py-3 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateGame}
                    className="flex-1 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold py-3 rounded-lg transition-colors"
                  >
                    开始对局
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-200">历史对局</h2>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-sm text-navy-400 hover:text-gold-400 flex items-center gap-1 transition-colors"
          >
            <Upload size={14} />
            导入对局
          </button>
        </div>

        <AnimatePresence>
          {showImport && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4">
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="粘贴JSON数据..."
                  className="w-full bg-navy-900/50 border border-navy-600 rounded-lg px-4 py-3 input-focus text-sm font-mono h-24 resize-none mb-3"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowImport(false)}
                    className="flex-1 bg-navy-700 hover:bg-navy-600 py-2 rounded-lg transition-colors text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!importData.trim()}
                    className={cn(
                      'flex-1 py-2 rounded-lg transition-colors text-sm',
                      importData.trim()
                        ? 'bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold'
                        : 'bg-navy-700 text-navy-500 cursor-not-allowed'
                    )}
                  >
                    导入
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sortedGames.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-16 bg-navy-800/30 rounded-xl border border-navy-700 border-dashed"
          >
            <Trophy className="mx-auto text-navy-600 mb-4" size={48} />
            <p className="text-navy-500">还没有对局记录</p>
            <p className="text-navy-600 text-sm">点击上方按钮创建你的第一个棋局</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {sortedGames.map((game, index) => {
              const state = gameStates[game.id];
              const lastMarket = state?.marketHistory[state.marketHistory.length - 1];

              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(game.status === 'finished' ? `/result/${game.id}` : `/game/${game.id}`)}
                  className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4 hover:border-gold-500/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-navy-100 group-hover:text-gold-400 transition-colors">
                          {game.title}
                        </h3>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded border',
                          difficultyConfig[game.difficulty].color
                        )}>
                          {difficultyConfig[game.difficulty].label}
                        </span>
                        {game.status === 'finished' && (
                          <span className="text-xs px-2 py-0.5 rounded bg-navy-600 text-navy-300">
                            已完成
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-navy-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          回合 {game.currentRound}/{game.maxRounds}
                        </span>
                        {lastMarket && (
                          <>
                            <span>流动性: {lastMarket.liquidity.toLocaleString()}亿</span>
                            <span>DR007: {lastMarket.dr007.toFixed(2)}%</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleExport(game.id, e)}
                        className="p-2 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-gold-400 transition-colors"
                        title="导出"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(game.id, e)}
                        className="p-2 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-liquidity-danger transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button className="p-2 rounded-lg bg-gold-500/10 text-gold-400 group-hover:bg-gold-500 group-hover:text-navy-900 transition-colors">
                        <Play size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
