import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { LeaveRequestList } from './components/LeaveRequestList';
import { SubstituteRecommendations } from './components/SubstituteRecommendations';
import { StandingManager } from './components/StandingManager';
import { ReportExporter } from './components/ReportExporter';

type TabType = 'leave' | 'substitute' | 'standing' | 'report';

const tabLabels: Record<TabType, string> = {
  leave: '请假归集',
  substitute: '替补推荐',
  standing: '站位管理',
  report: '报告导出',
};

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>('leave');

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">合唱团临演安排系统</h1>
              <p className="text-sm text-gray-600 mt-1">声部长请假时的排练安排与站位管理</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-gray-500">系统运行中</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow mb-6">
          <nav className="flex border-b">
            {(Object.keys(tabLabels) as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>
        </div>

        <main>
          {activeTab === 'leave' && <LeaveRequestList />}
          {activeTab === 'substitute' && <SubstituteRecommendations />}
          {activeTab === 'standing' && <StandingManager />}
          {activeTab === 'report' && <ReportExporter />}
        </main>

        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>合唱团临演安排系统 · 数据一致性保障 · 冲突自动检测</p>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
