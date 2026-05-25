import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { PipeNetwork } from '../components/PipeNetwork';
import { StatusPanel } from '../components/StatusPanel';
import { Toolbar } from '../components/Toolbar';
import { useGameLoop } from '../hooks/useGameLoop';
import { getLevelById } from '../data/levels';

export const Game: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();

  const {
    currentLevel,
    gameState,
    gameStatus,
    history,
    settlementResult,
    highlightedNodeId,
    highlightedValveId,
    loadLevel,
    toggleValve,
    undo,
    pause,
    resume,
    restart,
    settle,
    setHighlightedNode,
    setHighlightedValve,
    resetStore,
  } = useGameStore();

  const { resetTime } = useGameLoop();

  useEffect(() => {
    if (levelId) {
      loadLevel(levelId);
      resetTime();
    }
    return () => {
      resetStore();
    };
  }, [levelId, loadLevel, resetTime, resetStore]);

  useEffect(() => {
    if (gameStatus === 'settled' && settlementResult) {
      navigate('/settlement', { state: { levelId } });
    }
  }, [gameStatus, settlementResult, navigate, levelId]);

  const handleBack = () => {
    navigate('/');
  };

  if (!currentLevel || !gameState) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const level = getLevelById(levelId!) || currentLevel;

  return (
    <div className="min-h-screen bg-slate-900 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {level.name}
          </h1>
          <p className="text-slate-400 text-sm">难度 {'⭐'.repeat(level.difficulty)}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-shrink-0">
          <StatusPanel gameState={gameState} level={level} />
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex-1 min-h-0">
            <PipeNetwork
              gameState={gameState}
              level={level}
              onValveClick={toggleValve}
              highlightedNodeId={highlightedNodeId}
              highlightedValveId={highlightedValveId}
              onNodeHighlight={setHighlightedNode}
              onValveHighlight={setHighlightedValve}
              disabled={gameStatus === 'paused'}
            />
          </div>

          <Toolbar
            gameStatus={gameStatus}
            onPause={pause}
            onResume={resume}
            onRestart={() => {
              restart();
              resetTime();
            }}
            onUndo={undo}
            onSettle={settle}
            onBack={handleBack}
            canUndo={history.length > 1}
          />
        </div>
      </div>
    </div>
  );
};
