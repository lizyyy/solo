import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { createRenderer, TrackRenderer } from '../renderer/TrackRenderer';
import { Settings, Thermometer } from 'lucide-react';

export const TrackCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TrackRenderer | null>(null);
  const animationRef = useRef<number>(0);
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  const {
    position,
    heading,
    currentPhysics,
    currentLap,
    status,
    updateGame
  } = useGameStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = createRenderer(canvasRef.current);
    rendererRef.current = renderer;

    const handleResize = () => {
      if (!canvasRef.current) return;
      const newRenderer = createRenderer(canvasRef.current);
      rendererRef.current = newRenderer;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let lastTime = 0;
    const fixedDt = 1000 / 60;

    const gameLoop = (timestamp: number) => {
      if (lastTime === 0) lastTime = timestamp;
      const delta = timestamp - lastTime;

      if (delta >= fixedDt) {
        if (status === 'running') {
          updateGame();
        }
        lastTime = timestamp;
      }

      if (rendererRef.current) {
        rendererRef.current.render(
          position,
          heading,
          currentPhysics,
          currentLap?.frameData || [],
          showHeatmap
        );
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [status, position, heading, currentPhysics, currentLap, updateGame, showHeatmap]);

  return (
    <div className="bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider">
          赛道视图
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showHeatmap 
                ? 'bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30' 
                : 'bg-[#1e3a5f] text-gray-400 hover:text-white'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            速度热力图
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${
              status === 'running' ? 'bg-green-500 animate-pulse' :
              status === 'paused' ? 'bg-yellow-500' :
              status === 'finished' ? 'bg-blue-500' :
              'bg-gray-500'
            }`} />
            <span>
              {status === 'running' ? '运行中' :
               status === 'paused' ? '已暂停' :
               status === 'finished' ? '已完成' :
               '待开始'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-[#0a1628] rounded-xl border border-[#1e3a5f] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />

        <div className="absolute top-3 left-3 bg-[#0a1628]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e3a5f]">
          <div className="text-xs text-gray-500 mb-2">图例</div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#ff6b35]"></span>
              <span className="text-gray-400">行驶轨迹</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
              <span className="text-gray-400">速度向量</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-cyan-500/60"></span>
              <span className="text-gray-400">下压力指示</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-white"></span>
              <span className="text-gray-400">起点/终点线</span>
            </div>
          </div>
        </div>

        <div className="absolute top-3 right-3 bg-[#0a1628]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e3a5f]">
          <div className="text-xs text-gray-500 mb-2">赛段标记</div>
          <div className="space-y-1 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00d4ff]"></span>
              <span className="text-gray-400">S1 起点</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff6b35]"></span>
              <span className="text-gray-400">S2 起点</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4ade80]"></span>
              <span className="text-gray-400">S3 起点</span>
            </div>
          </div>
        </div>

        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00d4ff]/10 flex items-center justify-center">
                <Settings className="w-8 h-8 text-[#00d4ff] animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <div className="text-lg font-medium text-white mb-2 font-['Orbitron']">
                准备就绪
              </div>
              <div className="text-sm text-gray-400">
                调整参数后点击「开始」按钮启动比赛
              </div>
            </div>
          </div>
        )}

        {status === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]/70 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <span className="text-3xl font-bold text-yellow-500 font-['Orbitron']">⏸</span>
              </div>
              <div className="text-xl font-bold text-yellow-500 mb-2 font-['Orbitron']">
                已暂停
              </div>
              <div className="text-sm text-gray-400">
                点击「继续」按钮恢复比赛
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>8字形赛道</span>
          <span>比例 1:{3} </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>60 FPS</span>
        </div>
      </div>
    </div>
  );
};
