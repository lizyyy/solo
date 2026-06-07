import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ContractImport from "@/pages/ContractImport";
import AliasManagement from "@/pages/AliasManagement";
import Conflicts from "@/pages/Conflicts";
import SelfCheck from "@/pages/SelfCheck";
import WeeklyReport from "@/pages/WeeklyReport";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contract-import" element={<ContractImport />} />
          <Route path="/alias-management" element={<AliasManagement />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/self-check" element={<SelfCheck />} />
          <Route path="/weekly-report" element={<WeeklyReport />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  );
}
