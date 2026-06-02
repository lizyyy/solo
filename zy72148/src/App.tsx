import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AllocationList } from "@/pages/AllocationList";
import { VersionManage } from "@/pages/VersionManage";
import { Link, useLocation } from "react-router-dom";
import { GitBranch } from "lucide-react";

function NavLink() {
  const location = useLocation();
  const isVersionPage = location.pathname === '/versions';
  
  if (isVersionPage) return null;
  
  return (
    <Link
      to="/versions"
      className="fixed bottom-6 right-6 flex items-center gap-2 bg-primary-900 text-white px-4 py-3 rounded-xl shadow-lg hover:bg-primary-800 transition-all hover:shadow-xl z-40"
    >
      <GitBranch className="w-5 h-5" />
      <span className="font-medium">版本管理</span>
    </Link>
  );
}

export default function App() {
  return (
    <Router>
      <NavLink />
      <Routes>
        <Route path="/" element={<AllocationList />} />
        <Route path="/versions" element={<VersionManage />} />
      </Routes>
    </Router>
  );
}
