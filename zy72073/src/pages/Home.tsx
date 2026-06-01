import React from 'react';
import { WarehouseScene } from '../components/three/WarehouseScene';
import { TopToolbar } from '../components/ui/TopToolbar';
import { RightPanel } from '../components/ui/RightPanel';
import { StatusBar } from '../components/ui/StatusBar';

const Home: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <TopToolbar />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <WarehouseScene />
          <div className="absolute top-4 left-4 bg-slate-900/80 border border-cyan-500/20 p-3 backdrop-blur-sm">
            <div className="text-cyan-400 text-xs font-mono mb-2">坐标系说明</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500" />
                <span className="text-slate-400">X轴 · 红色 · 东西向</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500" />
                <span className="text-slate-400">Y轴 · 绿色 · 垂直高度</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500" />
                <span className="text-slate-400">Z轴 · 蓝色 · 南北向</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 text-slate-500 text-xs font-mono">
            鼠标左键旋转 · 滚轮缩放 · 右键平移 · 点击点位查看详情
          </div>
        </div>
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  );
};

export default Home;
