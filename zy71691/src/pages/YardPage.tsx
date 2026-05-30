import { YardScene } from '@/components/3d/YardScene';
import { TopBar } from '@/components/ui/TopBar';
import { SidePanel } from '@/components/ui/SidePanel';
import { Timeline } from '@/components/ui/Timeline';
import { NavBar } from '@/components/ui/NavBar';

export default function YardPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950">
      <NavBar />
      <div className="pl-14 h-full">
        <TopBar />
        <div className="absolute top-14 left-14 right-0 bottom-0">
          <YardScene />
        </div>
        <SidePanel />
        <Timeline />
      </div>
    </div>
  );
}
