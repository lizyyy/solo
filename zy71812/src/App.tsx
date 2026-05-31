import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ReviewWorkbench } from "@/pages/ReviewWorkbench";
import { AnomalyCenter } from "@/pages/AnomalyCenter";
import { AuditLog } from "@/pages/AuditLog";
import { ExportCenter } from "@/pages/ExportCenter";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ReviewWorkbench />} />
          <Route path="anomalies" element={<AnomalyCenter />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="export" element={<ExportCenter />} />
        </Route>
      </Routes>
    </Router>
  );
}
