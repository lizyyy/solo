import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { GamePage } from "@/pages/GamePage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ExportPage } from "@/pages/ExportPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}
