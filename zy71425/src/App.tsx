import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { TrackEditor } from './pages/TrackEditor';
import { SampleLibrary } from './pages/SampleLibrary';
import { HistoryView } from './pages/HistoryView';
import { AnalysisView } from './pages/AnalysisView';
import { ReplayView } from './pages/ReplayView';
import { SimulationView } from './components/simulation/SimulationView';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-space-deep text-white">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-plasma-blue/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-magnetic-purple/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-green/3 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <Navbar />

          <Routes>
            <Route path="/" element={<Navigate to="/editor" replace />} />
            <Route path="/editor" element={<TrackEditor />} />
            <Route path="/samples" element={<SampleLibrary />} />
            <Route path="/history" element={<HistoryView />} />
            <Route path="/simulation" element={<SimulationView />} />
            <Route path="/analysis" element={<AnalysisView />} />
            <Route path="/replay" element={<ReplayView />} />
            <Route path="*" element={<Navigate to="/editor" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
