import { useEffect } from 'react';
import { Toolbar } from '@/components/Toolbar';
import { LeftPanel } from '@/components/LeftPanel';
import { RightPanel } from '@/components/RightPanel';
import { Viewer } from '@/components/Viewer';
import { ReportModal } from '@/components/ReportModal';
import { useStore } from '@/store/useStore';

export default function Home() {
  const { loadSampleData } = useStore();

  useEffect(() => {
    loadSampleData();
  }, [loadSampleData]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />

        <div className="flex-1 relative">
          <Viewer id="viewer-container" />

          <ViewControls />
        </div>

        <RightPanel />
      </div>

      <ReportModal />
    </div>
  );
}

function ViewControls() {
  const { setCameraState } = useStore();

  const views = [
    {
      name: '俯视图',
      position: [0, 100, 0.01] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
    },
    {
      name: '正视图',
      position: [0, 30, 80] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
    },
    {
      name: '侧视图',
      position: [80, 30, 0] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
    },
    {
      name: '等轴测',
      position: [50, 50, 50] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
    },
  ];

  return (
    <div className="absolute bottom-4 left-4 flex gap-2">
      {views.map(view => (
        <button
          key={view.name}
          onClick={() => setCameraState({ position: view.position, target: view.target })}
          className="px-3 py-1.5 bg-slate-800/80 text-slate-300 text-xs rounded-md hover:bg-slate-700 hover:text-white transition-all border border-slate-600"
        >
          {view.name}
        </button>
      ))}
    </div>
  );
}
