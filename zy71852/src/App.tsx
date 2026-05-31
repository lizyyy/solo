import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ExperimentList } from './pages/ExperimentList';
import { ExperimentDetail } from './pages/ExperimentDetail';
import { TimelineCompare } from './pages/TimelineCompare';
import { AnomalyExplain, AnomaliesOverview } from './pages/AnomalyExplain';
import { HistoryReview, HistoryOverview } from './pages/HistoryReview';
import { ExportCenter } from './pages/ExportCenter';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/experiments" replace />} />
      <Route element={<Layout />}>
        <Route path="/experiments" element={<ExperimentList />} />
        <Route path="/experiments/:id" element={<ExperimentDetail />} />
        <Route path="/experiments/:id/timeline" element={<TimelineCompare />} />
        <Route path="/experiments/:id/anomalies" element={<AnomalyExplain />} />
        <Route path="/experiments/:id/history" element={<HistoryReview />} />
        <Route path="/anomalies" element={<AnomaliesOverview />} />
        <Route path="/history" element={<HistoryOverview />} />
        <Route path="/export" element={<ExportCenter />} />
      </Route>
    </Routes>
  );
}

export default App;
