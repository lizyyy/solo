import { useState, useEffect } from 'react';
import { LayoutDashboard, AlertTriangle, History, Wind } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import Workspace from '@/components/Workspace';
import RiskList from '@/components/RiskList';
import HistoryPanel from '@/components/HistoryPanel';
import type { TabType } from '@/types';

export default function App() {
  const activeTab = useAppStore((state) => state.activeTab);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const calculationResult = useAppStore((state) => state.calculationResult);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'workspace', label: '工作台', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'report', label: '风险报告', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'history', label: '历史记录', icon: <History className="w-4 h-4" /> },
  ];

  const criticalRiskCount = calculationResult?.risks.filter(
    (r) => r.level === 'critical'
  ).length || 0;

  const renderContent = () => {
    switch (activeTab) {
      case 'workspace':
        return <Workspace />;
      case 'report':
        return <RiskList />;
      case 'history':
        return <HistoryPanel />;
      default:
        return <Workspace />;
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-6 h-6 border-2 border-aviation-500 border-t-transparent rounded-full animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-aviation-400 to-aviation-600 flex items-center justify-center">
              <Wind className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">无人机续航风阻估算</h1>
              <p className="text-xs text-slate-500">保守估算 · 风险预警 · 版本追溯</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-aviation-500 text-white shadow-lg shadow-aviation-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'report' && criticalRiskCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-danger-500 text-white text-xs rounded-full min-w-[20px] text-center">
                    {criticalRiskCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            本地运行 · 数据安全
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 py-6">
        <div className="animate-fade-in">{renderContent()}</div>
      </main>

      <footer className="bg-slate-900/50 border-t border-slate-800 py-4">
        <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between text-xs text-slate-500">
          <span>无人机续航风阻估算工具 v1.0</span>
          <span>保守系数: 风速×载重×返航余量 = 安全飞行</span>
        </div>
      </footer>
    </div>
  );
}
