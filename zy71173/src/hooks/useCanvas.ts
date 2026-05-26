import { useEffect, useRef, useCallback } from 'react';
import type { Level, Position, Guard, GameEvent } from '../game/types';
import { getHumidityAt } from '../game/map';

interface UseCanvasOptions {
  level: Level | null;
  playerPosition: Position | null;
  plannedPath: Position[];
  executedPath: Position[];
  guards: Guard[];
  currentRound: number;
  events: GameEvent[];
  isDesiccantActive: boolean;
  cellSize: number;
}

export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseCanvasOptions
) {
  const {
    level,
    playerPosition,
    plannedPath,
    executedPath,
    guards,
    currentRound,
    isDesiccantActive,
    cellSize,
  } = options;

  const animationFrameRef = useRef<number>();

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      for (let y = 0; y < level.gridSize.height; y++) {
        for (let x = 0; x < level.gridSize.width; x++) {
          const cellType = level.map[y]?.[x];
          const px = offsetX + x * cellSize;
          const py = offsetY + y * cellSize;

          if (cellType === 'wall') {
            ctx.fillStyle = '#374151';
          } else if (cellType === 'exhibit') {
            ctx.fillStyle = '#1a365d';
          } else if (cellType === 'storage') {
            ctx.fillStyle = '#065f46';
          } else {
            ctx.fillStyle = '#1f2937';
          }
          ctx.fillRect(px, py, cellSize, cellSize);

          ctx.strokeStyle = '#112240';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, cellSize, cellSize);
        }
      }
    },
    [level, cellSize]
  );

  const drawHumidityZones = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      for (let y = 0; y < level.gridSize.height; y++) {
        for (let x = 0; x < level.gridSize.width; x++) {
          const humidity = getHumidityAt(level, x, y);
          if (humidity >= 60) {
            const px = offsetX + x * cellSize;
            const py = offsetY + y * cellSize;
            const alpha = Math.min((humidity - 50) / 100, 0.5);
            ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
            ctx.fillRect(px, py, cellSize, cellSize);
          }
        }
      }
    },
    [level, cellSize]
  );

  const drawCongestionZones = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      for (const zone of level.congestionZones) {
        if (zone.activeRounds.includes(currentRound)) {
          const px = offsetX + zone.position.x * cellSize;
          const py = offsetY + zone.position.y * cellSize;
          ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      }
    },
    [level, cellSize, currentRound]
  );

  const drawDoors = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      for (const door of level.doors) {
        const px = offsetX + door.position.x * cellSize;
        const py = offsetY + door.position.y * cellSize;

        ctx.fillStyle = door.isAuthorized ? '#059669' : '#f59e0b';
        ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(door.requiredCard, px + cellSize / 2, py + cellSize / 2);
      }
    },
    [level, cellSize]
  );

  const drawGuardVision = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      for (const guard of guards) {
        const range = guard.visionRange;
        for (let dy = -range; dy <= range; dy++) {
          for (let dx = -range; dx <= range; dx++) {
            const distance = Math.abs(dx) + Math.abs(dy);
            if (distance <= range) {
              const x = guard.position.x + dx;
              const y = guard.position.y + dy;
              if (x >= 0 && x < level.gridSize.width && y >= 0 && y < level.gridSize.height) {
                const px = offsetX + x * cellSize;
                const py = offsetY + y * cellSize;
                const alpha = 0.2 * (1 - distance / (range + 1));
                ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
                ctx.fillRect(px, py, cellSize, cellSize);
              }
            }
          }
        }
      }
    },
    [level, guards, cellSize]
  );

  const drawGuards = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      for (const guard of guards) {
        const px = offsetX + guard.position.x * cellSize + cellSize / 2;
        const py = offsetY + guard.position.y * cellSize + cellSize / 2;
        const radius = cellSize / 3;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = guard.isAlerted ? '#dc2626' : '#991b1b';
        ctx.fill();
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('G', px, py);
      }
    },
    [level, guards, cellSize]
  );

  const drawPath = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      if (plannedPath.length > 0) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        if (playerPosition) {
          const startX = offsetX + playerPosition.x * cellSize + cellSize / 2;
          const startY = offsetY + playerPosition.y * cellSize + cellSize / 2;
          ctx.moveTo(startX, startY);
        }
        for (const pos of plannedPath) {
          const px = offsetX + pos.x * cellSize + cellSize / 2;
          const py = offsetY + pos.y * cellSize + cellSize / 2;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        for (let i = 0; i < plannedPath.length; i++) {
          const pos = plannedPath[i];
          const px = offsetX + pos.x * cellSize + cellSize / 2;
          const py = offsetY + pos.y * cellSize + cellSize / 2;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), px, py);
        }
      }

      if (executedPath.length > 1) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const startX = offsetX + executedPath[0].x * cellSize + cellSize / 2;
        const startY = offsetY + executedPath[0].y * cellSize + cellSize / 2;
        ctx.moveTo(startX, startY);
        for (let i = 1; i < executedPath.length; i++) {
          const px = offsetX + executedPath[i].x * cellSize + cellSize / 2;
          const py = offsetY + executedPath[i].y * cellSize + cellSize / 2;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    },
    [level, plannedPath, executedPath, playerPosition, cellSize]
  );

  const drawPlayer = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level || !playerPosition) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      const px = offsetX + playerPosition.x * cellSize + cellSize / 2;
      const py = offsetY + playerPosition.y * cellSize + cellSize / 2;
      const radius = cellSize / 2.5;

      if (isDesiccantActive) {
        ctx.beginPath();
        ctx.arc(px, py, radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(96, 165, 250, 0.3)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0a1628';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', px, py);
    },
    [level, playerPosition, isDesiccantActive, cellSize]
  );

  const drawExhibit = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      const px = offsetX + level.exhibit.startPosition.x * cellSize;
      const py = offsetY + level.exhibit.startPosition.y * cellSize;

      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fillRect(px, py, cellSize, cellSize);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💎', px + cellSize / 2, py + cellSize / 2);
    },
    [level, cellSize]
  );

  const drawStorage = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!level) return;

      const gridWidth = level.gridSize.width * cellSize;
      const gridHeight = level.gridSize.height * cellSize;
      const offsetX = (width - gridWidth) / 2;
      const offsetY = (height - gridHeight) / 2;

      const px = offsetX + level.storagePosition.x * cellSize;
      const py = offsetY + level.storagePosition.y * cellSize;

      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fillRect(px, py, cellSize, cellSize);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📦', px + cellSize / 2, py + cellSize / 2);
    },
    [level, cellSize]
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !level) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, width, height);
    drawHumidityZones(ctx, width, height);
    drawCongestionZones(ctx, width, height);
    drawGuardVision(ctx, width, height);
    drawDoors(ctx, width, height);
    drawPath(ctx, width, height);
    drawExhibit(ctx, width, height);
    drawStorage(ctx, width, height);
    drawGuards(ctx, width, height);
    drawPlayer(ctx, width, height);
  }, [
    canvasRef,
    level,
    drawGrid,
    drawHumidityZones,
    drawCongestionZones,
    drawGuardVision,
    drawDoors,
    drawPath,
    drawExhibit,
    drawStorage,
    drawGuards,
    drawPlayer,
  ]);

  useEffect(() => {
    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  return { render };
}
