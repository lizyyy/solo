import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainMenu from '@/pages/MainMenu';
import Game from '@/pages/Game';
import Replay from '@/pages/Replay';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/game/:levelId" element={<Game />} />
        <Route path="/replay/:levelId" element={<Replay />} />
      </Routes>
    </Router>
  );
}
