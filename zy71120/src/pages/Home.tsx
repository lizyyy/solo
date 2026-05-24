import { useEffect } from 'react';
import { DataCenterScene } from '../components/scene/DataCenterScene';
import { ControlPanel } from '../components/ui/ControlPanel';
import { InfoPanel } from '../components/ui/InfoPanel';
import { Timeline } from '../components/ui/Timeline';
import { Toolbar } from '../components/ui/Toolbar';
import { useAppStore } from '../store/useAppStore';

export default function Home() {
  const { loadSampleData, dataCenter } = useAppStore();

  useEffect(() => {
    if (!dataCenter) {
      loadSampleData();
    }
  }, [dataCenter, loadSampleData]);

  return (
    <div className="w-full h-screen bg-[#0a1628] relative overflow-hidden">
      <DataCenterScene />
      <Toolbar />
      <ControlPanel />
      <InfoPanel />
      <Timeline />
      
      <div className="absolute top-4 left-4 text-white">
        <h1 className="text-xl font-bold text-cyan-400 mb-1">机房机柜热区图</h1>
        <p className="text-xs text-gray-500">DataCenter 3D Heatmap</p>
      </div>
    </div>
  );
}
