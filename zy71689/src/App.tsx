import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import GamePage from "@/pages/GamePage";
import ReviewPage from "@/pages/ReviewPage";
import ReportPage from "@/pages/ReportPage";
import SampleFlowPage from "@/pages/SampleFlowPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:mode" element={<GamePage />} />
        <Route path="/review/:gameId" element={<ReviewPage />} />
        <Route path="/report/:gameId" element={<ReportPage />} />
        <Route path="/game/sample" element={<SampleFlowPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}
