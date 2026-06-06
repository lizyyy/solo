import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "@/pages/Home";
import DataImport from "@/pages/DataImport";
import InspectionNote from "@/pages/InspectionNote";
import ConflictHandling from "@/pages/ConflictHandling";
import HandoverReport from "@/pages/HandoverReport";
import SelfCheck from "@/pages/SelfCheck";
import { StepForward, Upload, FileText, AlertTriangle, FileCheck, ShieldCheck } from "lucide-react";

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "首页", icon: StepForward },
    { path: "/import", label: "数据导入", icon: Upload },
    { path: "/inspection", label: "巡检备注", icon: FileText },
    { path: "/conflict", label: "冲突处理", icon: AlertTriangle },
    { path: "/report", label: "交接报告", icon: FileCheck },
    { path: "/self-check", label: "自检中心", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0F4C81] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold tracking-wide">鱼池溶氧扩散处理系统</h1>
        </div>
      </header>
      
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-[#0F4C81] border-b-2 border-[#0F4C81] bg-slate-50"
                      : "text-slate-600 hover:text-[#0F4C81] hover:bg-slate-50"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
      
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          证据链完整 · 流程可追溯 · 关键节点不自动拍板
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/inspection" element={<InspectionNote />} />
          <Route path="/conflict" element={<ConflictHandling />} />
          <Route path="/report" element={<HandoverReport />} />
          <Route path="/self-check" element={<SelfCheck />} />
        </Routes>
      </Layout>
    </Router>
  );
}
