import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Workbench } from "@/pages/Workbench";
import { DataManagement } from "@/pages/DataManagement";
import { SchemeManager } from "@/pages/SchemeManager";
import { ReportCenter } from "@/pages/ReportCenter";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workbench />} />
        <Route path="/data" element={<DataManagement />} />
        <Route path="/schemes" element={<SchemeManager />} />
        <Route path="/reports" element={<ReportCenter />} />
      </Routes>
    </Router>
  );
}
