import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainMenu from "@/components/MainMenu";
import GamePage from "@/components/GamePage";
import ResultReport from "@/components/ResultReport";
import ReplayPlayer from "@/components/ReplayPlayer";
import TrainingMode from "@/components/TrainingMode";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/game/:levelId" element={<GamePage />} />
        <Route path="/result/:sessionId" element={<ResultReport />} />
        <Route path="/replay/:sessionId" element={<ReplayPlayer />} />
        <Route path="/training" element={<TrainingMode />} />
      </Routes>
    </Router>
  );
}