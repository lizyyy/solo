import { ThreeScene } from '@/components/three/Scene';
import { Toolbar } from '@/components/ui/Toolbar';
import { LeftPanel } from '@/components/ui/LeftPanel';
import { RightPanel } from '@/components/ui/RightPanel';
import { Timeline } from '@/components/ui/Timeline';
import { useReportExporter } from '@/hooks/useReportExporter';

export default function Home() {
  useReportExporter();

  return (
    <div className="w-full h-screen bg-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 pt-14 pb-20 pl-0 pr-0">
        <ThreeScene />
      </div>
      <Toolbar />
      <LeftPanel />
      <RightPanel />
      <Timeline />
    </div>
  );
}
