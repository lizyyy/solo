import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PortScene } from '../../scenes/PortScene';
import { useGameStore, useGameState, useGameActions } from '../../store/gameStore';
import { useGameLoop } from '../../hooks/useGameLoop';
import ControlPanel from './ControlPanel';
import InfoPanel from './InfoPanel';
import { getLevelById } from '../../data/levels';

export default function GameScene() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const state = useGameState();
  const { startGame } = useGameActions();

  useGameLoop();

  useEffect(() => {
    if (levelId) {
      startGame(levelId);
    }
  }, [levelId, startGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (state && state.phase === 'playing') {
          useGameStore.getState().actions.pauseGame();
        } else if (state && state.phase === 'paused') {
          useGameStore.getState().actions.resumeGame();
        }
      }
      if (e.key === '1') useGameStore.getState().actions.setTimeSpeed(1);
      if (e.key === '2') useGameStore.getState().actions.setTimeSpeed(2);
      if (e.key === '3') useGameStore.getState().actions.setTimeSpeed(4);
      if (e.key === 'Escape') navigate('/');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, navigate]);

  useEffect(() => {
    if (state && state.phase === 'ended') {
      const timer = setTimeout(() => {
        const sessionId = `result-${Date.now()}`;
        (window as any).lastGameState = state;
        navigate(`/result/${sessionId}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, navigate]);

  if (!state) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-navy-800">
        <div className="text-white text-2xl font-oswald">加载中...</div>
      </div>
    );
  }

  const level = getLevelById(levelId || '');

  return (
    <div className="w-full h-full relative">
      <div className="absolute inset-0">
        <PortScene state={state} />
      </div>

      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="btn-industrial bg-navy-700 border-navy-500 text-harbor-200 hover:bg-navy-600 text-sm"
          >
            ← 返回菜单
          </button>
          
          <div className="glass-panel px-6 py-2 rounded-lg">
            <h1 className="font-oswald font-bold text-xl text-white">
              {level?.name || '港口调度'}
            </h1>
          </div>

          <div className="w-24" />
        </div>
      </div>

      <div className="absolute left-4 top-20 bottom-4 w-80 z-10 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <InfoPanel state={state} />
        </div>
      </div>

      <div className="absolute right-4 top-20 bottom-4 w-80 z-10">
        <ControlPanel state={state} />

        <div className="mt-4 glass-panel rounded-lg p-4">
          <h3 className="font-oswald font-bold text-white mb-2">任务目标</h3>
          <div className="space-y-2">
            {state.objectives.map((obj) => (
              <div key={obj.id} className="flex items-center gap-2 text-sm">
                <span className={obj.completed ? 'text-green-400' : 'text-harbor-400'}>
                  {obj.completed ? '✓' : '○'}
                </span>
                <span className={obj.completed ? 'text-harbor-300 line-through' : 'text-harbor-200'}>
                  {obj.description}
                </span>
                <span className="ml-auto text-harbor-400 font-mono text-xs">
                  {obj.currentValue}/{obj.targetValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {state.phase === 'paused' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
          <div className="glass-panel rounded-xl p-8 text-center">
            <h2 className="font-oswald font-bold text-4xl text-white mb-4">⏸ 暂停</h2>
            <p className="text-harbor-300 mb-6">按空格键继续游戏</p>
            <div className="text-sm text-harbor-400 space-y-1">
              <p>1键 - 1倍速</p>
              <p>2键 - 2倍速</p>
              <p>3键 - 4倍速</p>
              <p>ESC - 返回菜单</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
