import { useEffect, useCallback } from 'react';
import { RoofScene } from '../../three/RoofScene';
import { StatusBar } from './StatusBar';
import { ToolBar } from './ToolBar';
import { MessageToast } from './MessageToast';
import { PauseOverlay } from './PauseOverlay';
import { useGameStore } from '../../store/gameStore';
import { TOOL_CONFIG } from '../../game/config';
import type { ToolType } from '../../game/types';

interface GameScreenProps {
  onGameEnd: () => void;
  onExit: () => void;
}

export function GameScreen({ onGameEnd, onExit }: GameScreenProps) {
  const {
    state,
    message,
    clearMessage,
    selectTool,
    useTool,
    endCurrentRound,
    togglePauseGame,
    restartCurrentGame,
    exitToMenu,
  } = useGameStore();

  const handleDrainClick = useCallback(
    (drainId: string) => {
      if (state?.selectedTool) {
        useTool(drainId, 'drain');
      }
    },
    [state?.selectedTool, useTool]
  );

  const handleLowAreaClick = useCallback(
    (lowAreaId: string) => {
      if (state?.selectedTool) {
        useTool(lowAreaId, 'lowarea');
      }
    },
    [state?.selectedTool, useTool]
  );

  useEffect(() => {
    if (state?.phase === 'result') {
      onGameEnd();
    }
  }, [state?.phase, onGameEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state || state.phase !== 'playing') return;

      if (e.key === 'Escape') {
        togglePauseGame();
        return;
      }

      if (state.isPaused) return;

      const toolKeys: Record<string, ToolType> = {
        '1': 'inspect',
        '2': 'unclog',
        '3': 'pump',
        '4': 'reinforce',
      };

      const tool = toolKeys[e.key];
      if (tool && state.actionPoints >= TOOL_CONFIG[tool].cost) {
        selectTool(tool);
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        endCurrentRound();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, selectTool, endCurrentRound, togglePauseGame]);

  if (!state) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <StatusBar gameState={state} />

      <div className="flex-1 relative overflow-hidden">
        <RoofScene
          roofMap={state.roofMap}
          leakPoints={state.leakPoints}
          rainfallIntensity={state.rainfallIntensity}
          onDrainClick={handleDrainClick}
          onLowAreaClick={handleLowAreaClick}
        />

        <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 max-w-xs">
          <h3 className="text-white font-bold mb-2">当前工具</h3>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{TOOL_CONFIG[state.selectedTool].icon}</span>
            <div>
              <p className="text-white font-medium">{TOOL_CONFIG[state.selectedTool].name}</p>
              <p className="text-slate-400 text-sm">{TOOL_CONFIG[state.selectedTool].description}</p>
            </div>
          </div>
        </div>
      </div>

      <ToolBar
        selectedTool={state.selectedTool}
        onSelectTool={selectTool}
        onEndRound={endCurrentRound}
        onPause={togglePauseGame}
        onRestart={restartCurrentGame}
        onExit={exitToMenu}
        isPaused={state.isPaused}
        actionPoints={state.actionPoints}
      />

      <MessageToast message={message} onClose={clearMessage} />

      {state.isPaused && (
        <PauseOverlay
          onResume={togglePauseGame}
          onRestart={restartCurrentGame}
          onExit={exitToMenu}
        />
      )}
    </div>
  );
}
