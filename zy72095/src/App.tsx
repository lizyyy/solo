import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ImportPage from "@/pages/ImportPage";
import CalculatePage from "@/pages/CalculatePage";
import AdjustPage from "@/pages/AdjustPage";
import AnnotationPage from "@/pages/AnnotationPage";
import SupplementPage from "@/pages/SupplementPage";
import DiffPage from "@/pages/DiffPage";
import ReportPage from "@/pages/ReportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/import" replace />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/calculate" element={<CalculatePage />} />
        <Route path="/adjust" element={<AdjustPage />} />
        <Route path="/annotation" element={<AnnotationPage />} />
        <Route path="/supplement" element={<SupplementPage />} />
        <Route path="/diff" element={<DiffPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}
