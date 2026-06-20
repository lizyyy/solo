import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppShell from "@/components/AppShell";
import MaterialsDesk from "@/pages/MaterialsDesk";
import ReviewReport from "@/pages/ReviewReport";
import AuditHistory from "@/pages/AuditHistory";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<MaterialsDesk />} />
          <Route path="/report" element={<ReviewReport />} />
          <Route path="/audit" element={<AuditHistory />} />
        </Route>
      </Routes>
    </Router>
  );
}
