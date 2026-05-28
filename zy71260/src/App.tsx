import { useEffect, useState } from 'react';
import Scene3D from './components/Scene3D';
import ControlPanel from './components/ControlPanel';
import DetailPanel from './components/DetailPanel';
import LegendBar from './components/LegendBar';
import ExportModal from './components/ExportModal';
import { initializeStore, useAppStore } from './store/useAppStore';
import { getMockData } from './data/mockData';
import { validateAllData } from './data/dataValidator';
import type { Mode, Chord } from './types';
import { Music2, Sparkles } from 'lucide-react';

function App() {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const setSelectedMode = useAppStore((state) => state.setSelectedMode);
  const setSelectedChord = useAppStore((state) => state.setSelectedChord);

  useEffect(() => {
    const rawData = getMockData();
    const validatedData = validateAllData(rawData);
    initializeStore({
      ...validatedData,
      dataSources: rawData.dataSources,
    });
    setIsDataLoaded(true);
  }, []);

  const handleSelectMode = (mode: Mode) => {
    setSelectedMode(mode.id);
  };

  const handleSelectChord = (chord: Chord) => {
    setSelectedChord(chord.id);
  };

  if (!isDataLoaded) {
    return (
      <div className="w-full h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Music2 className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <p className="text-slate-400">正在加载和声空间...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#0a1628] overflow-hidden relative">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-3 px-6 py-3 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/50">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-white tracking-wide">
            3D 和声空间
          </h1>
          <span className="text-xs text-slate-400 hidden sm:block">
            音乐理论可视化教学工具
          </span>
        </div>
      </div>

      <Scene3D onSelectMode={handleSelectMode} onSelectChord={handleSelectChord} />
      <ControlPanel />
      <DetailPanel />
      <LegendBar onExport={() => setIsExportModalOpen(true)} />
      
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}

export default App;
