import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Home } from "@/pages/Home";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";
import { SupplementPage } from "@/pages/SupplementPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:materialId" element={<GamePage />} />
        <Route path="/result/:gameId" element={<ResultPage />} />
        <Route path="/supplement/:gameId" element={<SupplementPage />} />
      </Routes>
    </Router>
  );
}
