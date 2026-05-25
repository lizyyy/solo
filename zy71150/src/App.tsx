import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MainMenu } from "@/pages/MainMenu";
import { GameScreen } from "@/pages/GameScreen";
import { ResultScreen } from "@/pages/ResultScreen";
import { ReplayScreen } from "@/pages/ReplayScreen";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/game/:levelId" element={<GameScreen />} />
        <Route path="/result/:gameId" element={<ResultScreen />} />
        <Route path="/replay/:gameId" element={<ReplayScreen />} />
      </Routes>
    </Router>
  );
}
