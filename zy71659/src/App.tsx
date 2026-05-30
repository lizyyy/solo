import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Analysis from "@/pages/Analysis";
import Anomalies from "@/pages/Anomalies";
import Reports from "@/pages/Reports";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/anomalies" element={<Anomalies />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}
