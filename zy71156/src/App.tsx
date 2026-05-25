import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LevelSelect from "@/pages/LevelSelect";
import GamePage from "@/pages/GamePage";
import ResultsPage from "@/pages/ResultsPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LevelSelect />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </Router>
  );
}
