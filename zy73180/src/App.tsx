import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import ImportPage from "@/pages/Import";
import ConfigPage from "@/pages/Config";
import ComparePage from "@/pages/Compare";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Route>
      </Routes>
    </Router>
  );
}
