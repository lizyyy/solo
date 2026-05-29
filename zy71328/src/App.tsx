import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import List from '@/pages/List';
import Detail from '@/pages/Detail';
import Edit from '@/pages/Edit';
import History from '@/pages/History';
import Export from '@/pages/Export';
import { useAudioStore } from '@/store/useAudioStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { mockData } from '@/mock/sampleData';

export default function App() {
  const {
    audioFiles,
    tracks,
    loudnessData,
    peakMarks,
    protectedRegions,
    currentAudioId,
    setAudioFiles,
    setTracks,
    setLoudnessData,
    setPeakMarks,
    setProtectedRegions,
  } = useAudioStore();
  const { historyRecords, reports, setHistoryRecords, setReports } = useHistoryStore();

  useEffect(() => {
    if (audioFiles.length === 0) {
      setAudioFiles(mockData.audioFiles);
    }
    if (tracks.length === 0) {
      setTracks(mockData.tracks);
    }
    if (Object.keys(loudnessData).length === 0) {
      Object.entries(mockData.loudnessData).forEach(([id, data]) => {
        setLoudnessData(id, data);
      });
    }
    if (peakMarks.length === 0) {
      setPeakMarks(mockData.peakMarks);
    }
    if (protectedRegions.length === 0) {
      setProtectedRegions(mockData.protectedRegions);
    }
    if (historyRecords.length === 0) {
      setHistoryRecords(mockData.historyRecords);
    }
    if (reports.length === 0) {
      setReports(mockData.reports);
    }
  }, [
    audioFiles.length,
    tracks.length,
    Object.keys(loudnessData).length,
    peakMarks.length,
    protectedRegions.length,
    historyRecords.length,
    reports.length,
    setAudioFiles,
    setTracks,
    setLoudnessData,
    setPeakMarks,
    setProtectedRegions,
    setHistoryRecords,
    setReports,
  ]);

  const currentAudio = audioFiles.length > 0
    ? audioFiles.find((f) => f.id === currentAudioId)
    : null;

  const status = currentAudio?.status === 'processing'
    ? 'processing'
    : currentAudio?.status === 'completed'
    ? 'completed'
    : currentAudio?.status === 'error'
    ? 'error'
    : 'idle';

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            currentAudioName={currentAudio?.name}
            status={status}
          />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<List />} />
              <Route path="/audio/:id" element={<Detail />} />
              <Route path="/audio/:id/edit" element={<Edit />} />
              <Route path="/history" element={<History />} />
              <Route path="/export" element={<Export />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
