import { Header } from '../components/ui/Header';
import { LayerPanel } from '../components/ui/LayerPanel';
import { FilterPanel } from '../components/ui/FilterPanel';
import { InfoPanel } from '../components/ui/InfoPanel';
import { ViewControls } from '../components/ui/ViewControls';
import { Timeline } from '../components/ui/Timeline';
import { ExcavationScene } from '../components/three/ExcavationScene';

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-col bg-stone-950 overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <LayerPanel />

        <div className="flex-1 relative">
          <ExcavationScene />
          <ViewControls />
          <InfoPanel />
          <Timeline />
        </div>

        <FilterPanel />
      </div>
    </div>
  );
}
