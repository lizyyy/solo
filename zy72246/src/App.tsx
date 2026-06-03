import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import ImportPage from "@/pages/ImportPage";
import HistoryPage from "@/pages/HistoryPage";
import ReviewPage from "@/pages/ReviewPage";
import RulesPage from "@/pages/RulesPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/history/:id" element={<HistoryPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/rules" element={<RulesPage />} />
      </Routes>
    </Router>
  );
}
