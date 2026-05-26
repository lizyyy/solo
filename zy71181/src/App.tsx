import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainMenuPage } from './pages/MainMenuPage';
import { GamePage } from './pages/GamePage';
import { ResultPage } from './pages/ResultPage';
import { ReplayPage } from './pages/ReplayPage';
import { ReportPage } from './pages/ReportPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/game/:levelId" element={<GamePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/replay/:replayId" element={<ReplayPage />} />
        <Route path="/report/:gameId" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}
