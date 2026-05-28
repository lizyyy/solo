import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { Database, Calculator, AlertTriangle, FileText, Gavel } from "lucide-react";
import DataImport from "@/pages/DataImport";
import Calculate from "@/pages/Calculate";
import Anomalies from "@/pages/Anomalies";
import Report from "@/pages/Report";
import { useAuctionStore } from "@/store/useAuctionStore";

function Navigation() {
  const { anomalies, items } = useAuctionStore();
  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const hasData = items.length > 0;

  const navItems = [
    { path: '/data', label: '数据导入', icon: Database, badge: null },
    { path: '/calculate', label: '计算分析', icon: Calculator, badge: null, disabled: !hasData },
    { path: '/anomalies', label: '异常检测', icon: AlertTriangle, badge: criticalCount > 0 ? criticalCount : null, disabled: !hasData },
    { path: '/report', label: '报告导出', icon: FileText, badge: null, disabled: !hasData },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-auction-navy rounded-lg flex items-center justify-center">
              <Gavel className="w-5 h-5 text-auction-gold" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-auction-navy leading-tight">
                拍卖保留价优化系统
              </h1>
              <p className="text-xs text-gray-500">Auction Reserve Price Optimizer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => [
                    'nav-link flex items-center gap-2 relative',
                    item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
                    isActive ? 'active' : ''
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-auction-paper">
        <Navigation />
        <main className="container py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/data" replace />} />
            <Route path="/data" element={<DataImport />} />
            <Route path="/calculate" element={<Calculate />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/report" element={<Report />} />
            <Route path="*" element={<Navigate to="/data" replace />} />
          </Routes>
        </main>
        <footer className="border-t border-gray-200 bg-white mt-12">
          <div className="container py-6">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <p>© 2025 拍卖保留价优化系统 · 基于历史数据与买家活跃度的智能定价</p>
              <p className="font-mono text-xs">v1.0.0</p>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
