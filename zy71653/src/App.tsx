import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DataManagement from "@/pages/DataManagement";
import Allocation from "@/pages/Allocation";
import Exceptions from "@/pages/Exceptions";
import Reports from "@/pages/Reports";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/data" element={<DataManagement />} />
          <Route path="/allocation" element={<Allocation />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}
