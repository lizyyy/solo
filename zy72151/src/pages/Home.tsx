import StatsBar from '@/components/StatsBar';
import Toolbar from '@/components/Toolbar';
import BusStopList from '@/components/BusStopList';
import MapView from '@/components/MapView';
import BusStopDetail from '@/components/BusStopDetail';

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <StatsBar />
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <BusStopList />
        <MapView />
        <BusStopDetail />
      </div>
    </div>
  );
}
