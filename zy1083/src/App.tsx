import React, { useState } from 'react';
import { AppProvider, useApp, useShortlist } from './context/AppContext';
import DataImport from './components/DataImport';
import ScoreComparison from './components/ScoreComparison';
import WeightPanel from './components/WeightPanel';
import ChecklistPanel from './components/ChecklistPanel';
import ExportPanel from './components/ExportPanel';
import './App.css';

type TabType = 'import' | 'comparison' | 'weights' | 'checklist' | 'export';

const Navigation: React.FC<{
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}> = ({ activeTab, setActiveTab }) => {
  const { state } = useApp();
  const { shortlist } = useShortlist();

  const tabs = [
    { id: 'import' as TabType, label: '数据导入', icon: '📥' },
    { id: 'comparison' as TabType, label: '房源对比', icon: '📊', badge: state.scoredHouses.length > 0 ? state.scoredHouses.length : undefined },
    { id: 'weights' as TabType, label: '权重设置', icon: '⚖️' },
    { id: 'checklist' as TabType, label: '签约核对', icon: '✅', badge: shortlist.length > 0 ? shortlist.length : undefined },
    { id: 'export' as TabType, label: '数据导出', icon: '📤' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <span className="text-xl font-bold text-gray-900">租房看房复盘台</span>
          </div>
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-500 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('import');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'import' && <DataImport />}
        {activeTab === 'comparison' && <ScoreComparison />}
        {activeTab === 'weights' && <WeightPanel />}
        {activeTab === 'checklist' && <ChecklistPanel />}
        {activeTab === 'export' && <ExportPanel />}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>🏠 租房看房复盘台 - 帮助您系统性地整理看房记录，避免签约踩坑</p>
            <p className="mt-1">数据仅保存在本地浏览器中，不会上传到任何服务器</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
