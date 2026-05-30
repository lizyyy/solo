import { useState } from 'react';
import ControlPanel from './components/layout/ControlPanel';
import SchemePanel from './components/layout/SchemePanel';
import GuidePanel from './components/layout/GuidePanel';
import SolarSystem from './components/three/SolarSystem';

function App() {
  const [showSpacecraftDetail, setShowSpacecraftDetail] = useState(false);

  return (
    <div className="h-screen w-screen flex bg-slate-950 overflow-hidden">
      <ControlPanel />
      
      <div className="flex-1 relative game-wrapper">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <h1 
            className="text-2xl font-bold text-white tracking-wider"
            style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 20px rgba(0, 212, 255, 0.5)' }}
          >
            太阳帆姿态模拟台
          </h1>
          <p className="text-center text-xs text-slate-400 mt-1">
            Solar Sail Attitude Simulator
          </p>
        </div>

        <SolarSystem />

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-4">
          <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm rounded-lg text-xs text-slate-400 border border-slate-700/50">
            🖱️ 拖拽旋转 | 滚轮缩放 | 右键平移
          </div>
        </div>
      </div>
      
      <SchemePanel />
      <GuidePanel />
    </div>
  );
}

export default App;
