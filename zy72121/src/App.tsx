import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/common/Sidebar";
import MainPanel from "@/pages/MainPanel";
import HistoryCompare from "@/pages/HistoryCompare";
import ReportExport from "@/pages/ReportExport";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-100">
        <Sidebar />
        <main className="ml-60">
          <Routes>
            <Route path="/" element={<MainPanel />} />
            <Route path="/history" element={<HistoryCompare />} />
            <Route path="/report" element={<ReportExport />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
