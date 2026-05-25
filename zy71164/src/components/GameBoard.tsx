import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Renderer } from '@/engine/Renderer';
import type { Position } from '@/types/game';

interface GameBoardProps {
  width?: number;
  height?: number;
  isReplay?: boolean;
}

export default function GameBoard({
  width = 600,
  height = 600,
  isReplay = false,
}: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const {
    gameState,
    animationState,
    renderOptions,
    selectPosition,
    clearSelection,
    replayState,
  } = useGameStore();

  const initRenderer = useCallback(() => {
    if (!canvasRef.current || !gameState) return;

    const canvas = canvasRef.current;
    const renderer = new Renderer(canvas);
    renderer.resize(width, height, gameState.level.gridSize);
    rendererRef.current = renderer;
  }, [width, height, gameState]);

  const renderLoop = useCallback(
    (timestamp: number) => {
      if (!rendererRef.current || !gameState) return;

      rendererRef.current.render(
        gameState,
        animationState,
        {
          showTrajectories: isReplay ? true : renderOptions.showTrajectories,
          showNoiseSources: renderOptions.showNoiseSources,
          highlightSelected: !isReplay,
        },
        timestamp
      );

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    },
    [gameState, animationState, renderOptions, isReplay]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!rendererRef.current || !gameState || isReplay) return;
      if (gameState.gameStatus !== 'playing') return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const gridPos = rendererRef.current.screenToGrid(x, y);

      if (gridPos) {
        if (
          gameState.selectedPosition?.x === gridPos.x &&
          gameState.selectedPosition?.y === gridPos.y
        ) {
          clearSelection();
        } else {
          selectPosition(gridPos.x, gridPos.y);
        }
      }
    },
    [gameState, isReplay, selectPosition, clearSelection]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!rendererRef.current || !gameState || isReplay) return;
      if (gameState.gameStatus !== 'playing') return;

      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const gridPos = rendererRef.current.screenToGrid(x, y);

      if (gridPos) {
        const now = Date.now();
        const timeDiff = now - lastTapTimeRef.current;

        if (timeDiff < 300) {
          if (
            gameState.selectedPosition?.x === gridPos.x &&
            gameState.selectedPosition?.y === gridPos.y
          ) {
            clearSelection();
          } else {
            selectPosition(gridPos.x, gridPos.y);
          }
        } else {
          selectPosition(gridPos.x, gridPos.y);
        }

        lastTapTimeRef.current = now;
      }
    },
    [gameState, isReplay, selectPosition, clearSelection]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!rendererRef.current || !gameState || isReplay) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const gridPos = rendererRef.current.screenToGrid(x, y);

      if (gridPos && gridPos.x >= 0 && gridPos.x < gameState.level.gridSize && gridPos.y >= 0 && gridPos.y < gameState.level.gridSize) {
        canvasRef.current!.style.cursor = 'crosshair';
      } else {
        canvasRef.current!.style.cursor = 'default';
      }
    },
    [gameState, isReplay]
  );

  useEffect(() => {
    initRenderer();
  }, [initRenderer]);

  useEffect(() => {
    if (rendererRef.current && gameState) {
      rendererRef.current.resize(width, height, gameState.level.gridSize);
    }
  }, [width, height, gameState]);

  useEffect(() => {
    if (gameState) {
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, renderLoop]);

  if (!gameState) return null;

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onTouchEnd={handleTouchEnd}
        className="border-2 border-sonar-green rounded"
        style={{
          boxShadow: '0 0 20px rgba(57, 255, 20, 0.3), inset 0 0 30px rgba(57, 255, 20, 0.05)',
          maxWidth: '100%',
          height: 'auto',
        }}
      />

      {gameState.gameStatus === 'paused' && !isReplay && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded">
          <div className="text-center">
            <div
              className="font-vt323 text-6xl text-sonar-amber mb-4"
              style={{ textShadow: '0 0 20px #ffb000' }}
            >
              PAUSED
            </div>
            <p className="text-sonar-amber/70 font-jetbrains text-sm">
              按 P 键继续游戏
            </p>
          </div>
        </div>
      )}

      {isReplay && (
        <div className="absolute top-2 left-2 bg-sonar-bg/90 px-3 py-1 rounded border border-sonar-cyan">
          <span className="text-sonar-cyan font-jetbrains text-sm">
            回放模式 | 回合 {replayState.currentTurn + 1}/{replayState.totalTurns + 1}
          </span>
        </div>
      )}

      {gameState.selectedPosition && !isReplay && (
        <div className="absolute bottom-2 left-2 bg-sonar-bg/90 px-3 py-1 rounded border border-sonar-green">
          <span className="text-sonar-green font-jetbrains text-sm">
            选中: ({gameState.selectedPosition.x}, {gameState.selectedPosition.y})
          </span>
        </div>
      )}
    </div>
  );
}
