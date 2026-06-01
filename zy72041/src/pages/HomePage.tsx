import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Train, Play, Clock, BookOpen, TrendingUp, User } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { levels } from '@/data/levels';
import { sampleImportData, conflictingImportData } from '@/data/importData';
import { PersistenceManager } from '@/utils/persistence';
import DataImporter from '@/components/DataImporter';
import ConflictResolver from '@/components/ConflictResolver';
import AlertMessage from '@/components/AlertMessage';
import type { ImportedData } from '@/types';
import { cn } from '@/lib/utils';

const difficultyColors = {
  easy: 'bg-success-100 text-success-700',
  medium: 'bg-warning-100 text-warning-700',
  hard: 'bg-danger-100 text-danger-700',
};

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    startGame,
    conflicts,
    warnings,
    errors,
    isLoading,
    playerName,
    setPlayerName,
    resolveConflict,
    loadSavedGame,
  } = useGameStore();

  const [selectedLevelId, setSelectedLevelId] = useState<string>(levels[0]?.id || '');
  const [importedData, setImportedData] = useState<ImportedData | null>(null);
  const [useConflictData, setUseConflictData] = useState(false);
  const [savedGames, setSavedGames] = useState<Array<{ gameId: string; levelId: string; lastModified: number; status: string }>>([]);

  useEffect(() => {
    const games = PersistenceManager.listSavedGames();
    setSavedGames(games.filter(g => g.status !== 'completed'));
  }, []);

  const handleImport = (data: ImportedData) => {
    setImportedData(data);
  };

  const handleStartGame = () => {
    const dataToUse = useConflictData ? conflictingImportData : importedData;
    startGame(selectedLevelId, dataToUse || undefined);
    
    setTimeout(() => {
      const currentState = useGameStore.getState().state;
      if (currentState) {
        navigate(`/game/${selectedLevelId}`);
      }
    }, 100);
  };

  const handleContinueGame = (gameId: string) => {
    loadSavedGame(gameId);
    setTimeout(() => {
      const state = useGameStore.getState().state;
      if (state) {
        navigate(`/game/${state.levelId}`);
      }
    }, 100);
  };

  const selectedLevel = levels.find(l => l.id === selectedLevelId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-subway-50 via-white to-subway-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-subway-600 rounded-2xl mb-6 shadow-lg">
            <Train className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3 font-serif">
            地铁客流解谜局
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            根据课堂计分表中的地铁客流数据，做出正确的调度决策，体验真实的运营挑战
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-xl font-bold text-gray-800 mb-4 font-serif flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-subway-600" />
                选择关卡
              </h2>
              
              <div className="space-y-4">
                {levels.map((level, index) => (
                  <div
                    key={level.id}
                    onClick={() => setSelectedLevelId(level.id)}
                    className={cn(
                      'border-2 rounded-xl p-5 cursor-pointer transition-all duration-200',
                      selectedLevelId === level.id
                        ? 'border-subway-500 bg-subway-50 shadow-md'
                        : 'border-gray-200 hover:border-subway-300 hover:bg-gray-50'
                    )}
                    style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg mb-1">
                          {level.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {level.description}
                        </p>
                      </div>
                      <span className={cn(
                        'text-xs px-3 py-1 rounded-full font-medium',
                        difficultyColors[level.difficulty]
                      )}>
                        {difficultyLabels[level.difficulty]}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {level.totalRounds} 回合
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        满分 {level.totalScore} 分
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {savedGames.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                <h2 className="text-xl font-bold text-gray-800 mb-4 font-serif">
                  继续游戏
                </h2>
                <div className="space-y-3">
                  {savedGames.map((game, index) => {
                    const level = levels.find(l => l.id === game.levelId);
                    return (
                      <div
                        key={game.gameId}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                      >
                        <div>
                          <p className="font-medium text-gray-800">
                            {level?.title || '未知关卡'}
                          </p>
                          <p className="text-sm text-gray-500">
                            保存于 {new Date(game.lastModified).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleContinueGame(game.gameId)}
                          className="px-4 py-2 bg-subway-600 hover:bg-subway-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          继续
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <DataImporter
              onImport={handleImport}
              sampleData={sampleImportData}
              className="animate-slide-up"
              style={{ animationDelay: '0.6s' }}
            />

            <div className="bg-white rounded-2xl shadow-lg p-6 animate-slide-up" style={{ animationDelay: '0.7s' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 font-serif">
                  测试冲突数据
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useConflictData}
                    onChange={(e) => setUseConflictData(e.target.checked)}
                    className="w-4 h-4 text-subway-600 rounded"
                  />
                  <span className="text-sm text-gray-600">使用冲突测试数据</span>
                </label>
              </div>
              {useConflictData && (
                <p className="text-sm text-warning-600 bg-warning-50 p-3 rounded-lg">
                  已启用冲突测试数据，开始游戏后将展示数据冲突检测界面，用于验证冲突处理逻辑。
                </p>
              )}
            </div>

            {conflicts.length > 0 && (
              <ConflictResolver
                conflicts={conflicts}
                onResolve={resolveConflict}
                className="animate-slide-up"
                style={{ animationDelay: '0.8s' }}
              />
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <h2 className="text-xl font-bold text-gray-800 mb-4 font-serif flex items-center gap-2">
                <User className="w-5 h-5 text-subway-600" />
                玩家信息
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    姓名（可选）
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="请输入您的姓名"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-subway-500 focus:border-subway-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {selectedLevel && (
              <div className="bg-gradient-to-br from-subway-600 to-subway-800 rounded-2xl shadow-lg p-6 text-white animate-slide-up" style={{ animationDelay: '0.5s' }}>
                <h3 className="font-bold text-lg mb-3 font-serif">
                  即将开始
                </h3>
                <div className="space-y-2 text-subway-100 text-sm mb-6">
                  <p>关卡：{selectedLevel.title}</p>
                  <p>难度：{difficultyLabels[selectedLevel.difficulty]}</p>
                  <p>回合：{selectedLevel.totalRounds} 回合</p>
                  <p>满分：{selectedLevel.totalScore} 分</p>
                </div>
                
                {errors.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {errors.map((error, index) => (
                      <AlertMessage
                        key={index}
                        type="error"
                        message={error}
                      />
                    ))}
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {warnings.map((warning, index) => (
                      <AlertMessage
                        key={index}
                        type="warning"
                        message={warning}
                      />
                    ))}
                  </div>
                )}

                <button
                  onClick={handleStartGame}
                  disabled={isLoading || errors.length > 0}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200',
                    isLoading || errors.length > 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-white text-subway-700 hover:bg-subway-50 hover:shadow-lg hover:-translate-y-0.5'
                  )}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-subway-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      开始解谜
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6 animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <h3 className="font-semibold text-gray-800 mb-3 font-serif">
                游戏说明
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-subway-100 text-subway-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  根据课堂计分表数据分析客流情况
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-subway-100 text-subway-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  在每回合做出正确的调度决策
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-subway-100 text-subway-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  注意处理空值、重复项和边界情况
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-subway-100 text-subway-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  结算页可查看扣分原因和完整报告
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
