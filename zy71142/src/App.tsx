import { Suspense, useEffect } from 'react';
import SimulationScene from '@/scenes/SimulationScene';
import TopBar from '@/components/TopBar';
import Timeline from '@/components/Timeline';
import DataPanel from '@/components/DataPanel';
import ReportModal from '@/components/ReportModal';
import CompareModal from '@/components/CompareModal';
import { useSimulationStore } from '@/store/simulationStore';

function App() {
  const resetSimulation = useSimulationStore(state => state.resetSimulation);
  
  useEffect(() => {
    resetSimulation();
  }, [resetSimulation]);
  
  return (
    <div className="w-screen h-screen bg-slate-950 overflow-hidden relative">
      <TopBar />
      <DataPanel />
      <Timeline />
      <ReportModal />
      <CompareModal />
      
      <div className="absolute inset-0 pt-14 pb-20 pr-96">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white text-xl">加载中...</div>
          </div>
        }>
          <SimulationScene />
        </Suspense>
      </div>
      
      <div className="absolute bottom-24 left-4 bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 text-xs text-slate-400 z-10">
        <div className="font-medium text-slate-300 mb-2">图例</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-500" />
            <span>等待中</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>移动中</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>楼梯中</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>排队中</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>已到达</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

