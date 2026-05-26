import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import PlayPage from "@/pages/PlayPage";
import HistoryPage from "@/pages/HistoryPage";
import ReplayPage from "@/pages/ReplayPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play/:levelId" element={<PlayPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/replay/:recordId" element={<ReplayPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Router>
  );
}
