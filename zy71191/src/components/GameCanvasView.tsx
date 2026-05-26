import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GameCanvas } from '@/game/canvas/GameCanvas';

interface Props {
  onBoothClick?: (boothId: string) => void;
  onBoothHover?: (boothId: string | null) => void;
  selectedBoothId?: string | null;
}

export default function GameCanvasView({ onBoothClick, onBoothHover, selectedBoothId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameCanvasRef = useRef<GameCanvas | null>(null);
  const state = useGameStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    const gameCanvas = new GameCanvas(canvasRef.current);
    gameCanvasRef.current = gameCanvas;

    if (onBoothClick) gameCanvas.setOnBoothClick(onBoothClick);
    if (onBoothHover) gameCanvas.setOnBoothHover(onBoothHover);

    gameCanvas.start();

    const handleResize = () => gameCanvas.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      gameCanvas.destroy();
    };
  }, [onBoothClick, onBoothHover]);

  useEffect(() => {
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setState(state);
    }
  }, [state]);

  useEffect(() => {
    if (gameCanvasRef.current && selectedBoothId !== undefined) {
      gameCanvasRef.current.setSelectedBooth(selectedBoothId);
    }
  }, [selectedBoothId]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block cursor-pointer"
      style={{ background: '#0f172a' }}
    />
  );
}
