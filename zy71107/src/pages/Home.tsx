import React, { useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import Scene3D from '../components/scene/Scene3D';
import TopToolbar from '../components/panels/TopToolbar';
import LeftPanel from '../components/panels/LeftPanel';
import Timeline from '../components/panels/Timeline';
import RightPanel from '../components/panels/RightPanel';

const Home: React.FC = () => {
  const loadSample = useSceneStore((state) => state.loadSample);
  const hallData = useSceneStore((state) => state.hallData);

  useEffect(() => {
    loadSample('normal');
  }, [loadSample]);

  return (
    <div className="w-full h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0">
        <Scene3D />
      </div>

      <TopToolbar />
      <LeftPanel />
      <RightPanel />
      <Timeline />

      {!hallData && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">加载展厅数据中...</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-24 left-4 z-10">
        <div className="bg-slate-900/80 backdrop-blur-md rounded-lg px-3 py-2 border border-slate-700/50">
          <p className="text-slate-400 text-xs">操作提示: 鼠标拖拽旋转视角 | 滚轮缩放 | 点击展柜查看详情</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
