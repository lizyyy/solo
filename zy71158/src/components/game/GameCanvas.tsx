import React, { useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stalls, customers, totalElectricity, maxElectricity, totalSmoke, maxSmoke, phase } = useGameStore();

  useCanvasRenderer(canvasRef, {
    width: 800,
    height: 500,
    stalls,
    customers,
    totalElectricity,
    maxElectricity,
    totalSmoke,
    maxSmoke,
    phase,
  });

  return (
    <div className="relative rounded-xl overflow-hidden border border-night-border shadow-lg">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="block"
      />
      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-night-bg/80 px-2 py-1 rounded">
        提示：点击左侧摊位卡片进行操作
      </div>
    </div>
  );
}