import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import GamePage from "@/pages/GamePage";
import ReplayPage from "@/pages/ReplayPage";
import ReportPage from "@/pages/ReportPage";
import HistoryPage from "@/pages/HistoryPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:difficulty" element={<GamePage />} />
        <Route path="/replay" element={<ReplayPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/report/:gameId" element={<ReportPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </Router>
  );
}
