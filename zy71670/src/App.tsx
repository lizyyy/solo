import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Workbench } from "@/pages/Workbench";
import { Report } from "@/pages/Report";
import { History } from "@/pages/History";
import { Music, FileText, Clock } from "lucide-react";

function Navbar() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <div className="bg-primary-900 text-white px-4 py-2 flex items-center gap-1">
      <Link
        to="/"
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
          isActive('/') ? 'bg-primary-700' : 'hover:bg-primary-800'
        }`}
      >
        <Music size={18} />
        <span>工作台</span>
      </Link>
      <Link
        to="/history"
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
          isActive('/history') ? 'bg-primary-700' : 'hover:bg-primary-800'
        }`}
      >
        <Clock size={18} />
        <span>历史记录</span>
      </Link>
      <Link
        to="/report"
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
          isActive('/report') ? 'bg-primary-700' : 'hover:bg-primary-800'
        }`}
      >
        <FileText size={18} />
        <span>报告导出</span>
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Workbench />} />
            <Route path="/history" element={<History />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
