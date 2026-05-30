import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { GamePage } from './pages/GamePage';
import { AnalysisPage } from './pages/AnalysisPage';
import { TimelinePage } from './pages/TimelinePage';
import { ReportPage } from './pages/ReportPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}
