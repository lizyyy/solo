import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainMenu from '@/pages/MainMenu';
import GamePage from '@/pages/GamePage';
import ResultPage from '@/pages/ResultPage';
import ReplayPage from '@/pages/ReplayPage';
import TutorialPage from '@/pages/TutorialPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/game/:levelId" element={<GamePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/replay/:gameId" element={<ReplayPage />} />
        <Route path="/tutorial" element={<TutorialPage />} />
      </Routes>
    </Router>
  );
}
