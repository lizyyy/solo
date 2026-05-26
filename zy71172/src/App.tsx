import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { RulesPage } from "@/pages/RulesPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:levelId" element={<GamePage />} />
        <Route path="/result/:recordId" element={<ResultPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/rules" element={<RulesPage />} />
      </Routes>
    </Router>
  );
}
