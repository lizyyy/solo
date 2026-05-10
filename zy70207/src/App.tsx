import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { StallGrid } from './components/StallGrid';
import { StallDetail } from './components/StallDetail';
import { RectificationManagement } from './components/RectificationManagement';
import { RectificationBoard } from './components/RectificationBoard';
import { Dashboard } from './components/Dashboard';
import type { Stall } from './types';

type TabType = 'grid' | 'rectification' | 'board' | 'dashboard';

const AppContent = () => {
  const [activeTab, setActiveTab] = useState<TabType>('grid');
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);
  const { resetToSampleData } = useApp();

  const handleStallClick = (stall: Stall) => {
    setSelectedStall(stall);
  };

  const handleResetData = () => {
    if (window.confirm('确定要重置为样例数据吗？当前修改将丢失。')) {
      resetToSampleData();
      setSelectedStall(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">夜市摊位油污巡查系统</h1>
            <button
              onClick={handleResetData}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              重置为样例数据
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('grid')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'grid'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              摊位网格
            </button>
            <button
              onClick={() => setActiveTab('rectification')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'rectification'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              整改管理
            </button>
            <button
              onClick={() => setActiveTab('board')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'board'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              整改公示
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'dashboard'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              统计导出
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'grid' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <StallGrid
                onStallClick={handleStallClick}
                selectedStallId={selectedStall?.id}
              />
            </div>
            <div className="lg:col-span-1">
              {selectedStall ? (
                <StallDetail stall={selectedStall} />
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  <p>请从左侧网格中选择一个摊位</p>
                  <p className="text-sm mt-2">查看详情、标记问题</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rectification' && (
          <RectificationManagement />
        )}

        {activeTab === 'board' && (
          <RectificationBoard />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard />
        )}
      </main>

      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          夜市摊位油污巡查系统 - 可运行原型
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
