import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Mountain, Database, AlertTriangle, Download, History, Camera, View } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/terrain', icon: Mountain, label: '风险地形' },
  { to: '/data', icon: Database, label: '数据做账' },
  { to: '/anomaly', icon: AlertTriangle, label: '异常检测' },
  { to: '/export', icon: Download, label: '报告导出' },
  { to: '/audit', icon: History, label: '审计追踪' },
];

export function Navbar() {
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const createSnapshot = useAppStore((state) => state.createSnapshot);
  const loans = useAppStore((state) => state.loans);
  const filters = useAppStore((state) => state.filters);
  const anomalies = useAppStore((state) => state.anomalies);
  const getFilteredLoans = useAppStore((state) => state.getFilteredLoans);

  const filteredLoans = useMemo(() => {
    return getFilteredLoans();
  }, [loans, filters, getFilteredLoans]);

  const unresolvedAnomalies = useMemo(() => {
    return anomalies.filter((a) => !a.resolved).length;
  }, [anomalies]);

  const totalPrincipal = useMemo(() => {
    return filteredLoans.reduce((sum, l) => sum + l.principal, 0);
  }, [filteredLoans]);

  const handleCreateSnapshot = () => {
    const defaultName = `手动快照 ${new Date().toLocaleString()}`;
    let name = defaultName;
    if (typeof window !== 'undefined' && window.prompt) {
      try {
        const result = window.prompt('请输入快照名称:', defaultName);
        if (result !== null) {
          name = result;
        } else {
          return;
        }
      } catch {
        name = defaultName;
      }
    }
    createSnapshot(name);
  };

  return (
    <nav className="h-14 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Mountain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">贷款组合风险地形</h1>
            <p className="text-[10px] text-slate-400 font-mono">RISK TERRAIN ANALYZER</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.to === '/anomaly' && unresolvedAnomalies > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  {unresolvedAnomalies}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-6 text-xs">
          <div className="text-center">
            <div className="text-slate-400">监控敞口</div>
            <div className="text-cyan-400 font-mono font-bold">
              {(totalPrincipal / 100000000).toFixed(2)}亿
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400">贷款笔数</div>
            <div className="text-white font-mono font-bold">{filteredLoans.length}</div>
          </div>
          <div className="text-center">
            <div className="text-slate-400">待处理异常</div>
            <div className={`font-mono font-bold ${unresolvedAnomalies > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {unresolvedAnomalies}
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('terrain')}
            className={cn(
              'p-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs',
              viewMode === 'terrain'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <View className="w-4 h-4" />
            地形
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={cn(
              'p-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs',
              viewMode === 'heatmap'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <View className="w-4 h-4" />
            热力
          </button>
          <button
            onClick={() => setViewMode('bar3d')}
            className={cn(
              'p-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs',
              viewMode === 'bar3d'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <View className="w-4 h-4" />
            柱状
          </button>
        </div>

        <button
          onClick={handleCreateSnapshot}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm rounded-lg transition-all shadow-lg shadow-cyan-500/20"
        >
          <Camera className="w-4 h-4" />
          保存快照
        </button>
      </div>
    </nav>
  );
}
