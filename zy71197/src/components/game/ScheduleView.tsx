import React, { useRef, useEffect } from 'react';
import { GameState, Level } from '../../game/types';
import { ScheduleCanvas } from '../../game/ScheduleCanvas';

interface ScheduleViewProps {
  state: GameState;
  level: Level;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ state, level }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scheduleCanvasRef = useRef<ScheduleCanvas | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      if (!scheduleCanvasRef.current) {
        scheduleCanvasRef.current = new ScheduleCanvas(canvasRef.current, level);
      } else {
        scheduleCanvasRef.current.setLevel(level);
      }
      
      scheduleCanvasRef.current.render(state);
    }
  }, [state, level]);

  useEffect(() => {
    const handleResize = () => {
      if (scheduleCanvasRef.current) {
        scheduleCanvasRef.current.resize();
        scheduleCanvasRef.current.render(state);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state]);

  return (
    <div className="h-full bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-900">
        <h3 className="font-semibold text-white">排程甘特图</h3>
        <p className="text-xs text-gray-400 mt-1">
          拖拽订单调整生产顺序，观察换线成本变化
        </p>
      </div>
      <div className="p-4 h-[calc(100%-60px)]">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-lg"
        />
      </div>
    </div>
  );
};
