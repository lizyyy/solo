import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileUp, History, Hand, Shield, User, ChevronDown, Download, Zap } from 'lucide-react';
import { useWorkOrderStore, useStatistics } from '../store/workOrderStore';
import { useState } from 'react';

const SHIFT_NAME = { morning: '早班', afternoon: '中班', night: '夜班' };

function getShift() {
  const h = new Date().getHours();
  if (h < 14 && h >= 6) return 'morning';
  if (h < 22 && h >= 14) return 'afternoon';
  return 'night';
}

export function TopNav() {
  const statistics = useStatistics();
  const { currentUser, currentRole, setRole, toggleHandoverGuide, exportFilteredCSV } = useWorkOrderStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItemCls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-all ${
      isActive
        ? 'bg-white/15 text-white shadow-inner-lifted'
        : 'text-white/75 hover:text-white hover:bg-white/10'
    }`;

  const handleExport = () => {
    const csv = exportFilteredCSV();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `电梯故障工单回放_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-700 text-white border-b border-brand-800/60 shadow-md sticky top-0 z-40">
      <div className="max-w-[1800px] mx-auto px-4 md:px-6 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2.5 pr-4 border-r border-white/20">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              ELEVATOR · REPLAY
            </div>
            <div className="text-[10px] text-white/70">电梯故障工单回放系统</div>
          </div>
        </div>

        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          <NavLink to="/" end className={navItemCls}>
            <LayoutDashboard className="w-4 h-4" />回放主页
          </NavLink>
          <NavLink to="/import" className={navItemCls}>
            <FileUp className="w-4 h-4" />数据导入
          </NavLink>
          <NavLink to="/history" className={navItemCls}>
            <History className="w-4 h-4" />判断历史
          </NavLink>
          <NavLink to="/handover" className={navItemCls}>
            <Hand className="w-4 h-4" />接班指引
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-emerald-500/90 hover:bg-emerald-500 text-white font-medium transition-colors shadow-sm"
            title={`导出当前 ${statistics.total} 条`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">导出结果</span>
            <span className="lg:hidden">导出</span>
          </button>

          <button
            onClick={() => toggleHandoverGuide(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-white/10 hover:bg-white/20 text-white font-medium transition-colors border border-white/20"
          >
            <Hand className="w-3.5 h-3.5" />快速指引
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-brand-800 font-bold text-sm shadow-inner-lifted">
                {currentUser.includes('阿敏') ? '敏' : '审'}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-xs font-semibold">{currentUser}</div>
                <div className="text-[10px] text-white/70 flex items-center gap-1">
                  {SHIFT_NAME[getShift()]} · {currentRole === 'supervisor' ? '维保主管' : '审核员'}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-white/70" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white text-slate-700 rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 overflow-hidden animate-fadeInUp">
                  <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <div className="text-xs text-slate-500 mb-0.5">切换身份（测试用）</div>
                    <div className="text-[11px] text-slate-400">用于验证主管/审核员权限差异</div>
                  </div>
                  {([
                    { r: 'supervisor' as const, label: '维保主管 · 阿敏', desc: '修改判断需填写原因', icon: <Shield className="w-4 h-4" /> },
                    { r: 'reviewer' as const, label: '审核员 · 王审核', desc: '常规工单审核判断', icon: <User className="w-4 h-4" /> },
                  ]).map(opt => (
                    <button
                      key={opt.r}
                      onClick={() => { setRole(opt.r); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                        currentRole === opt.r ? 'bg-indigo-50 text-indigo-700' : ''
                      }`}
                    >
                      <div className={`p-1.5 rounded-md ${currentRole === opt.r ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {opt.icon}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-[10px] text-slate-500">{opt.desc}</div>
                      </div>
                      {currentRole === opt.r && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
