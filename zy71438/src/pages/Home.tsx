import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, History, Star, Lock, Zap, Volume2, User } from 'lucide-react';
import { LEVELS } from '../data/levels';
import { getPlayer, savePlayer, generatePlayerId, getBestScore } from '../utils/storage';
import { Player } from '../types';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  useEffect(() => {
    const savedPlayer = getPlayer();
    if (savedPlayer) {
      setPlayer(savedPlayer);
    } else {
      setShowNameInput(true);
    }
  }, []);

  const handleStartGame = (levelId: string) => {
    if (!player) return;
    navigate(`/game/${levelId}`);
  };

  const handleSaveName = () => {
    if (playerName.trim()) {
      const newPlayer: Player = {
        id: generatePlayerId(),
        nickname: playerName.trim(),
        highScores: {},
      };
      savePlayer(newPlayer);
      setPlayer(newPlayer);
      setShowNameInput(false);
    }
  };

  const getDifficultyStars = (difficulty: number) => {
    return Array.from({ length: 3 }, (_, i) => (
      <Star
        key={i}
        size={14}
        className={i < difficulty ? 'text-cyber-accent fill-cyber-accent' : 'text-cyber-muted'}
      />
    ));
  };

  return (
    <div className="min-h-screen cyber-grid p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-orbitron font-bold neon-text-cyan mb-2">
              合成器波形闯关
            </h1>
            <p className="text-cyber-muted">
              调节振荡器，匹配目标音色，解锁你的合成器天赋！
            </p>
          </div>
          <div className="flex items-center gap-4">
            {player && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg neon-border bg-cyber-card/50">
                <User size={18} className="text-cyber-primary" />
                <span className="font-orbitron text-cyber-primary">{player.nickname}</span>
              </div>
            )}
            <button
              onClick={() => navigate('/history')}
              className="cyber-btn flex items-center gap-2 px-4 py-2 rounded-lg neon-border-pink bg-cyber-card/50 text-cyber-secondary hover:bg-cyber-secondary/20 transition-all"
            >
              <History size={18} />
              <span>历史记录</span>
            </button>
          </div>
        </div>

        {showNameInput && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="p-8 rounded-xl neon-border bg-cyber-card max-w-md w-full mx-4">
              <h2 className="text-2xl font-orbitron font-bold text-cyber-primary mb-6 text-center">
                欢迎来到波形闯关！
              </h2>
              <p className="text-cyber-muted text-center mb-6">
                请输入你的昵称，开始你的合成器学习之旅
              </p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                placeholder="输入你的昵称..."
                className="w-full px-4 py-3 rounded-lg bg-cyber-bg border border-cyber-primary/30 text-cyber-primary font-orbitron focus:outline-none focus:border-cyber-primary focus:shadow-neon-cyan transition-all mb-6"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={!playerName.trim()}
                className="cyber-btn w-full py-3 rounded-lg bg-cyber-primary text-cyber-bg font-orbitron font-bold hover:shadow-neon-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                开始闯关
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {LEVELS.map((level) => {
            const bestScore = player ? getBestScore(level.id, player.id) : 0;
            const isUnlocked = level.unlocked;

            return (
              <div
                key={level.id}
                className={`relative p-6 rounded-xl transition-all duration-300 ${
                  isUnlocked
                    ? 'neon-border bg-cyber-card/50 hover:bg-cyber-card/70 cursor-pointer hover:scale-105'
                    : 'border-cyber-muted/30 bg-cyber-card/20 opacity-60'
                }`}
                onClick={() => isUnlocked && handleStartGame(level.id)}
              >
                {!isUnlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <Lock size={48} className="text-cyber-muted" />
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-cyber-primary" size={24} />
                    <span className="font-orbitron font-bold text-cyber-primary">
                      {level.name}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {getDifficultyStars(level.difficulty)}
                  </div>
                </div>

                <p className="text-cyber-muted text-sm mb-4 h-12">
                  {level.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-cyber-muted" />
                    <span className="text-xs text-cyber-muted">
                      {level.targetOscillators.length} 个振荡器
                    </span>
                  </div>
                  {bestScore > 0 && (
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-cyber-accent fill-cyber-accent" />
                      <span className="text-xs font-orbitron text-cyber-accent">
                        {bestScore}%
                      </span>
                    </div>
                  )}
                </div>

                {isUnlocked && (
                  <div className="mt-4 pt-4 border-t border-cyber-muted/20">
                    <div className="flex items-center justify-center gap-2 text-cyber-primary font-orbitron text-sm">
                      <Play size={16} />
                      <span>开始挑战</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 p-6 rounded-xl neon-border bg-cyber-card/30">
          <h3 className="font-orbitron text-cyber-primary font-bold mb-4">游戏说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-cyber-muted">
            <div>
              <h4 className="text-cyber-primary font-bold mb-2">🎯 目标</h4>
              <p>调节振荡器的波形、频率、音量和相位，使合成的波形与目标波形尽可能匹配。</p>
            </div>
            <div>
              <h4 className="text-cyber-primary font-bold mb-2">🎛️ 控制</h4>
              <p>上下拖拽旋钮来调节参数。点击电源按钮启用/禁用振荡器。选择不同波形类型。</p>
            </div>
            <div>
              <h4 className="text-cyber-primary font-bold mb-2">👂 试听</h4>
              <p>点击播放按钮试听目标音色和你合成的音色。用耳朵辅助判断匹配程度！</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
