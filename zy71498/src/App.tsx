import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import ImportPage from "@/pages/ImportPage";
import ComparePage from "@/pages/ComparePage";
import DetailPage from "@/pages/DetailPage";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gradient-to-br from-deep-blue-900 via-deep-blue-800 to-deep-blue-900">
        <Sidebar />
        <main className="flex-1 ml-64 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/detail/:id" element={<DetailPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
