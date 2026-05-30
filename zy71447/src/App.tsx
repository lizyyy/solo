import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { SectionView } from '@/pages/SectionView';
import { FrequencyView } from '@/pages/FrequencyView';
import { HotspotView } from '@/pages/HotspotView';
import { ReportView } from '@/pages/ReportView';
import { useInstrumentStore } from '@/store/useInstrumentStore';
import type { InstrumentName } from '@/types';

function AppLayout() {
  const { currentInstrument, setCurrentInstrument } = useInstrumentStore();

  const handleInstrumentChange = (name: InstrumentName) => {
    setCurrentInstrument(name);
  };

  return (
    <div className="min-h-screen bg-charcoal-950 text-gray-100">
      <Navbar
        currentInstrument={currentInstrument}
        onInstrumentChange={handleInstrumentChange}
      />
      <main className="pt-16 md:pt-16 pb-4 px-4 h-screen">
        <div className="max-w-screen-2xl mx-auto h-full">
          <Routes>
            <Route path="/" element={<SectionView />} />
            <Route path="/frequency" element={<FrequencyView />} />
            <Route path="/hotspots" element={<HotspotView />} />
            <Route path="/report" element={<ReportView />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}
