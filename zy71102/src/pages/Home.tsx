import React from 'react';
import { SceneViewer } from '@/components/viewer/SceneViewer';
import { ControlPanel } from '@/components/panels/ControlPanel';
import { StatsPanel } from '@/components/panels/StatsPanel';
import { Timeline } from '@/components/panels/Timeline';

const Home: React.FC = () => {
  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 right-0 h-12 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 z-20 flex items-center px-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚇</span>
          <h1 className="text-lg font-bold text-white">地铁站客流疏散模拟系统</h1>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          <span className="px-2 py-1 bg-slate-800 rounded text-xs">v1.0.0</span>
        </div>
      </div>

      <div className="absolute top-12 left-0 right-0 bottom-0">
        <SceneViewer />
      </div>

      <div className="absolute top-12 left-0 right-0 bottom-0 pointer-events-none">
        <div className="pointer-events-auto">
          <ControlPanel />
        </div>
        <div className="pointer-events-auto">
          <StatsPanel />
        </div>
        <div className="pointer-events-auto">
          <Timeline />
        </div>
      </div>

      <div className="absolute bottom-20 right-4 z-10">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-slate-300">移动中</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-slate-300">等待中</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-slate-300">滞留</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
