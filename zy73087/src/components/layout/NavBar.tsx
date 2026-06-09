import { Link, useLocation } from 'react-router-dom';
import { HardHat, History, FileSpreadsheet, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/api/client';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '材料追踪', icon: <HardHat className="w-4 h-4" /> },
  { to: '/history', label: '操作历史', icon: <History className="w-4 h-4" /> },
];

function NavBar() {
  const loc = useLocation();

  const handleExport = async () => {
    try {
      const blob = await api.csvExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      a.download = `结构加固材料追踪明细_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('导出失败：' + e.message);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#1e3a5f] via-[#1a3355] to-[#152a47] text-white shadow-lg">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur border border-white/15">
                <FileSpreadsheet className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="text-base font-semibold tracking-wide" style={{ fontFamily: '"Source Han Serif SC", "Noto Serif SC", serif' }}>
                  结构加固材料追踪
                </div>
                <div className="text-[10px] text-white/60 tracking-[0.2em]">STRUCTURAL REINFORCEMENT TRACKER</div>
              </div>
            </Link>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(item => {
                const active = item.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={clsx(
                      'inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-all',
                      active
                        ? 'bg-white/15 text-white shadow-inner'
                        : 'text-white/80 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-[#1e3a5f] text-sm font-semibold transition-colors shadow"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
            <div className="h-6 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow">
                宁
              </div>
              <div className="text-xs">
                <div className="text-white font-medium">设计院助理</div>
                <div className="text-white/60">阿宁</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-amber-300 to-teal-400" />
    </header>
  );
}

export default NavBar;
