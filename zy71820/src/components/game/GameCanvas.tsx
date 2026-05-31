import { useEffect, useRef } from 'react';
import type { GameEngine } from '@/game/GameEngine';

interface GameCanvasProps {
  engine: GameEngine | null;
  onCustomerClick?: (customerId: string) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export function GameCanvas({ engine, onCustomerClick }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      engine.render(ctx);
      animationRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [engine]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engine || !onCustomerClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const state = engine.getState();
    const orderingCustomer = state.customers.find(
      (c) =>
        c.state === 'ordering' &&
        Math.abs(c.x - x) < 30 &&
        Math.abs(c.y - y) < 50
    );

    if (orderingCustomer) {
      onCustomerClick(orderingCustomer.id);
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        className="rounded-2xl border-2 border-neon-orange/50 shadow-neon-orange cursor-pointer max-w-full h-auto"
        style={{ touchAction: 'none' }}
      />
      <div className="absolute bottom-3 left-3 text-xs text-gray-400 font-body">
        💡 点击正在点餐的顾客可以快速上菜
      </div>
    </div>
  );
}
