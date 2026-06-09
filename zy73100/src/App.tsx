import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import MaterialReview from "@/pages/MaterialReview";
import DrawingReview from "@/pages/DrawingReview";
import ExportCenter from "@/pages/ExportCenter";
import ReviewLog from "@/pages/ReviewLog";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/material-review" element={<MaterialReview />} />
          <Route path="/drawing-review" element={<DrawingReview />} />
          <Route path="/export-center" element={<ExportCenter />} />
          <Route path="/review-log" element={<ReviewLog />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
