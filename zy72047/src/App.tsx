import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import ConsolePage from "@/pages/ConsolePage";
import LevelsPage from "@/pages/LevelsPage";
import HistoryPage from "@/pages/HistoryPage";
import ConflictsPage from "@/pages/ConflictsPage";
import ReportsPage from "@/pages/ReportsPage";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ConsolePage />} />
          <Route path="/levels" element={<LevelsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </div>
    </Router>
  );
}
