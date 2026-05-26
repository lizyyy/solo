import { useEffect, useRef, useCallback } from 'react';
import type { GameState } from '../game/types';

interface GameCanvasProps {
  width: number;
  height: number;
  gameState: GameState | null;
  onEngineReady?: (engine: any) => void;
}

export function GameCanvas({ width, height, gameState, onEngineReady }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    import('../game/GameEngine').then(({ GameEngine }) => {
      const engine = new GameEngine();
      engine.init(canvas, width, height);
      engineRef.current = engine;
      onEngineReady?.(engine);
    });

    return () => {
      engineRef.current?.destroy();
    };
  }, [width, height, onEngineReady]);

  useEffect(() => {
    if (!gameState || !engineRef.current) return;
  }, [gameState]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border-2 border-gray-700 shadow-2xl bg-gray-900"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
