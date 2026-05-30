import { useEffect } from 'react';
import { History, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThreeScene } from '../components/ThreeScene';
import { ControlPanel } from '../components/ControlPanel';
import { DataPanel } from '../components/DataPanel';
import { AlertBar } from '../components/RiskMonitor/AlertBar';
import { SearchPanel } from '../components/ObjectSearch/SearchPanel';
import { useSimulationStore } from '../store/useSimulationStore';

export function MainPage() {
  const { state, actions } = useSimulationStore();

  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 16.67;
      lastTime = currentTime;

      if (state === 'running') {
        actions.updateSimulation(deltaTime);
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state, actions]);

  return (
    <div className="h-screen w-screen bg-space-900 flex overflow-hidden">
      <ControlPanel />

      <div className="flex-1 relative">
        <ThreeScene />

        <div className="absolute top-4 left-4 z-10">
          <div className="bg-space-800/90 backdrop-blur-md rounded-lg border border-cyber-500/20 px-4 py-2">
            <h1 className="text-xl font-orbitron text-cyber-500 tracking-wider">
              电磁轨道炮演示台
            </h1>
          </div>
        </div>

        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <AlertBar />
        </div>

        <SearchPanel />

        <DataPanel />

        <div className="absolute bottom-4 left-4 z-10">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="p-2 bg-space-800/90 backdrop-blur-md rounded-lg border border-cyber-500/30 hover:border-cyber-500 transition-all duration-200"
            >
              <Home size={18} className="text-cyber-500" />
            </Link>
            <Link
              to="/history"
              className="p-2 bg-space-800/90 backdrop-blur-md rounded-lg border border-cyber-500/30 hover:border-cyber-500 transition-all duration-200"
            >
              <History size={18} className="text-cyber-500" />
            </Link>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-space-800/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-cyber-500/20">
            <p className="text-xs text-gray-400 font-jetbrains">
              鼠标左键旋转 · 滚轮缩放 · 右键平移
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
