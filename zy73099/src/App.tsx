import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChecklistHome from "@/pages/ChecklistHome";
import ImportPage from "@/pages/ImportPage";
import ItemDetailPage from "@/pages/ItemDetailPage";
import MonthlyReviewPage from "@/pages/MonthlyReviewPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChecklistHome />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/item/:id" element={<ItemDetailPage />} />
        <Route path="/review" element={<MonthlyReviewPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}
