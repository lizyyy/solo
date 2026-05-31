import { useState } from 'react';
import { Upload, Calendar, Trophy, Download, HelpCircle, Menu, X } from 'lucide-react';
import { useAppStore } from './store';
import ImportPage from './pages/ImportPage';
import SchedulePage from './pages/SchedulePage';
import RankingPage from './pages/RankingPage';
import ExportPage from './pages/ExportPage';
import GuidePage from './pages/GuidePage';

const navItems = [
  { id: 'import', label: '数据导入', icon: Upload },
  { id: 'schedule', label: '排班工作台', icon: Calendar },
  { id: 'ranking', label: '排行榜管理', icon: Trophy },
  { id: 'export', label: '导出中心', icon: Download },
  { id: 'guide', label: '操作指南', icon: HelpCircle },
];

export default function App() {
  const { activeTab, setActiveTab } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderPage = () => {
    switch (activeTab) {
      case 'import': return <ImportPage />;
      case 'schedule': return <SchedulePage />;
      case 'ranking': return <RankingPage />;
      case 'export': return <ExportPage />;
      case 'guide': return <GuidePage />;
      default: return <ImportPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <aside className="hidden md:flex w-56 bg-slate-800 border-r border-slate-700 flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="text-2xl">⛏️</span>
            太空矿场排班
          </h1>
          <p className="text-xs text-slate-500 mt-1">社群运营工具</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                  activeTab === item.id
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">数据本地存储</p>
          <p className="text-xs text-slate-600 mt-0.5">v1.0.0</p>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 z-50">
        <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <span className="text-xl">⛏️</span>
          太空矿场
        </h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-slate-200"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-slate-900/95 z-40">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm ${
                    activeTab === item.id
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        {renderPage()}
      </main>
    </div>
  );
}
