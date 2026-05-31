import { useEffect } from 'react';
import { useRecordsStore } from '../store/useRecordsStore';
import { Toolbar } from '../components/Toolbar';
import { Timeline } from '../components/Timeline';
import { DetailPanel } from '../components/DetailPanel';
import { AnomalyPanel } from '../components/AnomalyPanel';

export default function Home() {
  const { initRecords, showAnomalyPanel } = useRecordsStore();

  useEffect(() => {
    initRecords();
  }, [initRecords]);

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      <Toolbar />
      
      <div className="flex-1 flex relative overflow-hidden">
        <Timeline />
        <DetailPanel />
        {showAnomalyPanel && <AnomalyPanel />}
      </div>
    </div>
  );
}
