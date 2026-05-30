import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import RiskOverview from "@/pages/RiskOverview";
import Notifications from "@/pages/Notifications";
import DataImport from "@/pages/DataImport";
import Deposits from "@/pages/Deposits";
import Reports from "@/pages/Reports";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RiskOverview />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/deposits" element={<Deposits />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}
