import { useEffect } from 'react';
import Scene from '@/components/3d/Scene';
import VoltageDomainPanel from '@/components/panels/VoltageDomainPanel';
import ConflictPanel from '@/components/panels/ConflictPanel';
import DetailPanel from '@/components/panels/DetailPanel';
import ExportToolbar from '@/components/panels/ExportToolbar';
import { useChipStore } from '@/store/chipStore';

export default function Home() {
  const initChipData = useChipStore((state) => state.init);

  useEffect(() => {
    initChipData();
  }, [initChipData]);

  return (
    <div className="w-full h-full bg-chip-bg relative overflow-hidden">
      <div className="w-full h-full">
        <Scene />
      </div>

      <VoltageDomainPanel />
      <ConflictPanel />
      <DetailPanel />
      <ExportToolbar />
    </div>
  );
}
