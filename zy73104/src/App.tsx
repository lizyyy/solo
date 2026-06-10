import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChecklistListPage from "@/pages/ChecklistListPage";
import ChecklistEditPage from "@/pages/ChecklistEditPage";
import ChecklistDetailPage from "@/pages/ChecklistDetailPage";
import MonthlyReviewPage from "@/pages/MonthlyReviewPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChecklistListPage />} />
        <Route path="/checklist/new" element={<ChecklistEditPage />} />
        <Route path="/checklist/:id" element={<ChecklistDetailPage />} />
        <Route path="/checklist/:id/edit" element={<ChecklistEditPage />} />
        <Route path="/review" element={<MonthlyReviewPage />} />
      </Routes>
    </Router>
  );
}
