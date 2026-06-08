import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppNav from "@/components/AppNav";
import RegistrationPage from "@/pages/RegistrationPage";
import ReportsPage from "@/pages/ReportsPage";

export default function App() {
  return (
    <Router>
      <div className="min-h-full flex flex-col">
        <AppNav />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<RegistrationPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/:id" element={<ReportsPage />} />
            <Route path="*" element={<ReportsPage />} />
          </Routes>
        </main>
        <footer className="border-t border-brand-100/60 mt-10 py-4 text-center text-xs text-brand-400 bg-white/60 backdrop-blur-sm">
          宠物医院寄养登记系统 · 犬只疫苗报告导出 · 彩排复盘版 v1.0
        </footer>
      </div>
    </Router>
  );
}
