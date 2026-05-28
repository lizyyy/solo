import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Lobby } from "@/pages/Lobby";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game/:gameId" element={<GamePage />} />
        <Route path="/result/:gameId" element={<ResultPage />} />
        <Route path="/replay/:gameId" element={<ResultPage />} />
      </Routes>
    </Router>
  );
}
