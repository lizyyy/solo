import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useCanvas } from '@/hooks/useCanvas';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40);

  const {
    currentLevel,
    playerPosition,
    plannedPath,
    executedPath,
    guards,
    currentRound,
    events,
    isDesiccantActive,
    phase,
    addToPath,
  } = useGameStore();

  const calculateCellSize = useCallback(() => {
    if (!containerRef.current || !currentLevel) return 40;

    const containerWidth = containerRef.current.clientWidth - 40;
    const containerHeight = containerRef.current.clientHeight - 40;
    const { width, height } = currentLevel.gridSize;

    const maxCellWidth = Math.floor(containerWidth / width);
    const maxCellHeight = Math.floor(containerHeight / height);
    const newCellSize = Math.min(maxCellWidth, maxCellHeight, 60);

    return Math.max(newCellSize, 20);
  }, [currentLevel]);

  useEffect(() => {
    const updateSize = () => {
      const newCellSize = calculateCellSize();
      setCellSize(newCellSize);

      if (canvasRef.current && currentLevel) {
        const canvas = canvasRef.current;
        const { width, height } = currentLevel.gridSize;
        canvas.width = width * newCellSize + 40;
        canvas.height = height * newCellSize + 40;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [currentLevel, calculateCellSize]);

  useCanvas(canvasRef, {
    level: currentLevel,
    playerPosition,
    plannedPath,
    executedPath,
    guards,
    currentRound,
    events,
    isDesiccantActive,
    cellSize,
  });

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'planning' || !currentLevel || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridWidth = currentLevel.gridSize.width * cellSize;
    const gridHeight = currentLevel.gridSize.height * cellSize;
    const offsetX = (canvasRef.current.width - gridWidth) / 2;
    const offsetY = (canvasRef.current.height - gridHeight) / 2;

    const gridX = Math.floor((x - offsetX) / cellSize);
    const gridY = Math.floor((y - offsetY) / cellSize);

    if (
      gridX >= 0 &&
      gridX < currentLevel.gridSize.width &&
      gridY >= 0 &&
      gridY < currentLevel.gridSize.height
    ) {
      addToPath({ x: gridX, y: gridY });
    }
  };

  return (
    <div ref={containerRef} className="scanline-overlay flex-1 flex items-center justify-center p-5">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className={`rounded-lg border border-museum-bgLighter ${
          phase === 'planning' ? 'cursor-crosshair' : 'cursor-default'
        }`}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>
  );
}
