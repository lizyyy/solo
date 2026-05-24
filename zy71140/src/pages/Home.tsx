import { ColdStorageScene } from '@/components/scene/ColdStorageScene';
import { Toolbar } from '@/components/ui/Toolbar';
import { ControlPanel } from '@/components/ui/ControlPanel';
import { InfoPanel } from '@/components/ui/InfoPanel';
import { StatusBar } from '@/components/ui/StatusBar';

export default function Home() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 relative">
      <ColdStorageScene />
      <Toolbar />
      <ControlPanel />
      <InfoPanel />
      <StatusBar />
    </div>
  );
}