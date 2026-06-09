import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TopBar from "@/components/TopBar";
import HomePage from "@/pages/HomePage";
import AnomalyPage from "@/pages/AnomalyPage";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0E1521] text-slate-100">
        <TopBar />
        <div className="flex-1 min-h-0">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/anomaly" element={<AnomalyPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
