import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { GameBoard } from "@/pages/GameBoard";
import { LedgerPage } from "@/pages/LedgerPage";
import { ReportPage } from "@/pages/ReportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GameBoard />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}
