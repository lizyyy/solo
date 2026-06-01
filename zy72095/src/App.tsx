import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ImportPage from "@/pages/ImportPage";
import CalculatePage from "@/pages/CalculatePage";
import AdjustPage from "@/pages/AdjustPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/import" replace />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/calculate" element={<CalculatePage />} />
        <Route path="/adjust" element={<AdjustPage />} />
      </Routes>
    </Router>
  );
}
