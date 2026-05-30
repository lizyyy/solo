import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameCanvas } from '../components/GameCanvas';
import { GameInfoPanel } from '../components/GameInfoPanel';
import {
  Play, Pause, RotateCcw, Home, FileText, ArrowLeft, ArrowRight } from 'lucide-react';
import { functionCards } from '../data/functionCards';
import { generateId } from '../utils/curveGenerator';

export const Game = () => {
  const {
    selectedFunctionCard,
    curvePoints,
    player,
    gameStatus,
    score,
    lives,
    combo,
    maxCombo,
    currentBatchId,
    setScreen,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    resetGame,
    movePlayer,
    setPlayerSpeed,
    generateReport,
  } = useGameStore();

  const lastTimeRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>();

  const currentPoint = curvePoints.find(
    (p) => Math.abs(p.x - player.position.x) < 0.03
  );

  const gameLoop = useCallback(
    (timestamp: number) => {
      if (gameStatus !== 'playing') return;

      const deltaTime = lastTimeRef.current
        ? (timestamp - lastTimeRef.current) / 1000
        : 0;
      lastTimeRef.current = timestamp;

      if (keysPressed.current.has('ArrowLeft')) {
        movePlayer(-1, deltaTime);
      }
      if (keysPressed.current.has('ArrowRight')) {
        movePlayer(1, deltaTime);
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    },
    [gameStatus, movePlayer]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        keysPressed.current.add(e.key);
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (gameStatus === 'playing') {
          pauseGame();
        } else if (gameStatus === 'paused') {
          resumeGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStatus, pauseGame, resumeGame]);

  useEffect(() => {
    if (gameStatus === 'playing') {
      lastTimeRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameStatus, gameLoop]);

  const handleStartGame = () => {
    if (gameStatus === 'idle') {
      startGame();
    } else if (gameStatus === 'paused') {
      resumeGame();
    }
  };

  const handlePauseGame = () => {
    pauseGame();
  };

  const handleEndGame = () => {
    endGame();
    generateReport();
  };

  const handleGenerateReport = () => {
    generateReport();
    setScreen('reports');
  };

  if (!selectedFunctionCard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4 font-orbitron">
            请先选择函数卡
          </h2>
          <p className="text-slate-400 mb-6">
            请返回首页选择一张函数卡开始游戏
          </p>
          <button
            onClick={() => setScreen('home')}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setScreen('home')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Home className="w-4 h-4" />
              首页
            </button>
            <div className="text-cyan-400 font-mono text-sm">
              {selectedFunctionCard.expression}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gameStatus === 'idle' && (
              <button
                onClick={handleStartGame}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-lg font-bold hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/30"
              >
                <Play className="w-5 h-5" />
                开始游戏
              </button>
            )}
            {gameStatus === 'playing' && (
              <button
                onClick={handlePauseGame}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-500 transition-colors"
              >
                <Pause className="w-5 h-5" />
                暂停
              </button>
            )}
            {gameStatus === 'paused' && (
              <button
                onClick={handleStartGame}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-500 transition-colors"
              >
                <Play className="w-5 h-5" />
                继续
              </button>
            )}
            {gameStatus !== 'ended' && (
              <button
                onClick={handleEndGame}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <FileText className="w-5 h-5" />
                结束并生成报告
              </button>
            )}
            {gameStatus === 'ended' && (
              <>
                <button
                  onClick={resetGame}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  重新开始
                </button>
                <button
                  onClick={handleGenerateReport}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-lg font-bold hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/30"
                >
                  <FileText className="w-5 h-5" />
                  查看报告
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <GameCanvas
              functionCard={selectedFunctionCard}
              curvePoints={curvePoints}
              playerPosition={player.position}
              width={800}
              height={500}
            />

            <div className="mt-4 flex items-center justify-center gap-8 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-center">
                <span className="text-xs text-slate-400 block mb-1">
                  得分
                </span>
                <span className="text-3xl font-bold text-yellow-400 font-orbitron">
                  {score}
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-slate-400 block mb-1">
                  生命
                </span>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-2xl ${
                        i < lives
                          ? 'text-red-500'
                          : 'text-slate-600'
                      }`}
                    >
                      ❤️
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <span className="text-xs text-slate-400 block mb-1">
                  连击
                </span>
                <span className="text-3xl font-bold text-purple-400 font-orbitron">
                  {combo}
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-slate-400 block mb-1">
                  最高连击
                </span>
                <span className="text-3xl font-bold text-cyan-400 font-orbitron">
                  {maxCombo}
                </span>
              </div>
            </div>

            {gameStatus === 'playing' && (
              <div className="mt-4 flex items-center justify-center gap-4">
                <button
                  onMouseDown={() => keysPressed.current.add('ArrowLeft')}
              onMouseUp={() => keysPressed.current.delete('ArrowLeft')}
              onMouseLeave={() => keysPressed.current.delete('ArrowLeft')}
              onTouchStart={() => keysPressed.current.add('ArrowLeft')}
              onTouchEnd={() => keysPressed.current.delete('ArrowLeft')}
              className="w-20 h-20 bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-10 h-10" />
            </button>
            <button
              onMouseDown={() => keysPressed.current.add('ArrowRight')}
              onMouseUp={() => keysPressed.current.delete('ArrowRight')}
              onMouseLeave={() => keysPressed.current.delete('ArrowRight')}
              onTouchStart={() => keysPressed.current.add('ArrowRight')}
              onTouchEnd={() => keysPressed.current.delete('ArrowRight')}
              className="w-20 h-20 bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 active:scale-95 transition-transform"
            >
              <ArrowRight className="w-10 h-10" />
            </button>
              </div>
            )}

            {gameStatus === 'ended' && (
              <div className="mt-6 bg-gradient-to-r from-cyan-600/20 to-purple-600/20 rounded-xl p-8 border border-cyan-500/30 text-center">
                <h2 className="text-4xl font-bold text-white mb-4 font-orbitron">
                  游戏结束
                </h2>
                <p className="text-xl text-slate-300 mb-6">
                  最终得分: <span className="text-yellow-400 font-bold">{score}</span>
                </p>
                <p className="text-lg text-slate-400">
                  最高连击: <span className="text-purple-400 font-bold">{maxCombo}</span>
                </p>
              </div>
            )}

            {gameStatus === 'paused' && (
              <div className="mt-6 bg-yellow-500/10 rounded-xl p-8 border border-yellow-500/30 text-center">
                <h2 className="text-3xl font-bold text-yellow-400 mb-4 font-orbitron">
                  游戏暂停
                </h2>
                <p className="text-slate-300">
                  按空格键或点击继续按钮恢复游戏
                </p>
              </div>
            )}
          </div>

          <div className="w-80">
            <GameInfoPanel
              functionCard={selectedFunctionCard}
              currentPoint={currentPoint}
              score={score}
              lives={lives}
              combo={combo}
              maxCombo={maxCombo}
              speed={player.speed}
              onSpeedChange={setPlayerSpeed}
              batchId={currentBatchId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
