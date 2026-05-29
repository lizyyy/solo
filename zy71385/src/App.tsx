import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { CodeScan } from "./pages/CodeScan";
import { EnvironmentPage } from "./pages/Environment";
import { RiskAssessment } from "./pages/RiskAssessment";
import { Cleanup } from "./pages/Cleanup";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<CodeScan />} />
            <Route path="/environment" element={<EnvironmentPage />} />
            <Route path="/risk" element={<RiskAssessment />} />
            <Route path="/cleanup" element={<Cleanup />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
