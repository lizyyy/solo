import { BrowserRouter, Routes, Route, NavLink, Outlet } from "react-router-dom";
import {
  Home,
  TrendingUp,
  AlertTriangle,
  History,
  MessageSquare,
  Layers,
  User,
  CalendarClock,
} from "lucide-react";
import HomePage from "@/pages/Home";
import ImpactAnalysis from "@/pages/ImpactAnalysis";
import AnomalyHandling from "@/pages/AnomalyHandling";
import RunHistory from "@/pages/RunHistory";
import CommunicationView from "@/pages/CommunicationView";
import { Navigate } from "react-router-dom";

function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue text-white">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <h1 className="font-serif text-lg font-bold text-slate-900 leading-tight">
                  日照体量交底清单分析
                </h1>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    批次：RZ-TL-2026-0421
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    2026-04-21 14:30
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3" />
                    张工
                  </span>
                </div>
              </div>
            </div>

            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <Home className="w-4 h-4" />
                <span>首页</span>
              </NavLink>
              <NavLink
                to="/impact"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <TrendingUp className="w-4 h-4" />
                <span>影响分析</span>
              </NavLink>
              <NavLink
                to="/anomaly"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <AlertTriangle className="w-4 h-4" />
                <span>异常处理</span>
              </NavLink>
              <NavLink
                to="/history"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <History className="w-4 h-4" />
                <span>重跑历史</span>
              </NavLink>
              <NavLink
                to="/communication"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <MessageSquare className="w-4 h-4" />
                <span>沟通视图</span>
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <p className="text-center text-xs text-slate-400">
            日照体量交底清单分析系统 · v1.0.0
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="impact" element={<ImpactAnalysis />} />
          <Route path="analysis/:id" element={<ImpactAnalysis />} />
          <Route path="anomaly" element={<AnomalyHandling />} />
          <Route path="history" element={<RunHistory />} />
          <Route path="communication" element={<CommunicationView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
