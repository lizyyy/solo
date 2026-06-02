import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ScheduleOverview from "@/pages/ScheduleOverview";
import Materials from "@/pages/Materials";
import BatchImport from "@/pages/BatchImport";
import AuditLog from "@/pages/AuditLog";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ScheduleOverview />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/import" element={<BatchImport />} />
          <Route path="/audit-log" element={<AuditLog />} />
        </Route>
      </Routes>
    </Router>
  );
}
