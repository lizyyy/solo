import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import ImportPage from "@/pages/ImportPage";
import ReviewPage from "@/pages/ReviewPage";
import AbnormalPage from "@/pages/AbnormalPage";
import HistoryPage from "@/pages/HistoryPage";
import BoundaryRulesPage from "@/pages/BoundaryRulesPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/import" replace />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="abnormal" element={<AbnormalPage />} />
          <Route path="boundary-rules" element={<BoundaryRulesPage />} />
          <Route path="history/:id" element={<HistoryPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
