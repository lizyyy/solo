import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StartScreen } from './pages/StartScreen';
import { GameScreen } from './pages/GameScreen';
import { ResultScreen } from './pages/ResultScreen';
import { ReplayScreen } from './pages/ReplayScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/game" element={<GameScreen />} />
        <Route path="/result" element={<ResultScreen />} />
        <Route path="/replay" element={<ReplayScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
