import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WarningList from "@/pages/WarningList";
import CustomerDetail from "@/pages/CustomerDetail";
import DataImport from "@/pages/DataImport";
import ExportCenter from "@/pages/ExportCenter";
import HistoryRecord from "@/pages/HistoryRecord";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WarningList />} />
        <Route path="/customer/:pledgeId" element={<CustomerDetail />} />
        <Route path="/import" element={<DataImport />} />
        <Route path="/export" element={<ExportCenter />} />
        <Route path="/history" element={<HistoryRecord />} />
      </Routes>
    </Router>
  );
}
