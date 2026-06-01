import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GamePage from '@/pages/GamePage';
import HistoryList from '@/pages/HistoryList';
import HistoryDetail from '@/pages/HistoryDetail';
import ReportPage from '@/pages/ReportPage';
import ConfigPage from '@/pages/ConfigPage';
import HelpPage from '@/pages/HelpPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="/history" element={<HistoryList />} />
        <Route path="/history/:id" element={<HistoryDetail />} />
        <Route path="/report/:id" element={<ReportPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<GamePage />} />
      </Routes>
    </Router>
  );
}
