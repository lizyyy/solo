import { useEffect } from 'react';
import { Toolbar } from '@/components/Toolbar';
import { PhaserGame } from '@/components/PhaserGame';
import { SidePanel } from '@/components/SidePanel';
import { StatusBar } from '@/components/StatusBar';
import { ImportModal } from '@/components/ImportModal';
import { ExportModal } from '@/components/ExportModal';
import { HistoryModal } from '@/components/HistoryModal';
import { useAppStore } from '@/store/useAppStore';
import { mockOrbitData } from '@/data/mockData';

export default function Home() {
  const load = useAppStore(state => state.load);
  const importData = useAppStore(state => state.importData);
  const windows = useAppStore(state => state.windows);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (windows.length === 0) {
      importData(mockOrbitData);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-space-950 overflow-hidden">
      <Toolbar />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative grid-bg">
          <PhaserGame />
        </div>
        <SidePanel />
      </div>
      
      <StatusBar />
      
      <ImportModal />
      <ExportModal />
      <HistoryModal />
    </div>
  );
}
