import { useState, useEffect } from 'react';
import StoreManagement from './components/StoreManagement';
import InspectionManagement from './components/InspectionManagement';
import ProblemTracking from './components/ProblemTracking';
import Dashboard from './components/Dashboard';
import ValidationDemo from './components/ValidationDemo';
import HistoryViewer from './components/HistoryViewer';

const API_BASE = '';

const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  submitted: { label: '已提交', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  rectified: { label: '已整改', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800 border-green-300' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800 border-red-300' },
  active: { label: '激活', color: 'bg-green-100 text-green-800' },
  inactive: { label: '停用', color: 'bg-gray-100 text-gray-800' }
};

export { API_BASE, STATUS_CONFIG };

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedEntity, setSelectedEntity] = useState(null);

  const tabs = [
    { id: 'dashboard', label: '总览', icon: '📊' },
    { id: 'stores', label: '门店档案', icon: '🏪' },
    { id: 'inspections', label: '巡店记录', icon: '🔍' },
    { id: 'problems', label: '问题追踪', icon: '⚠️' },
    { id: 'validation', label: '验证演示', icon: '✅' },
    { id: 'history', label: '历史追踪', icon: '📜' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🏪</span>
              <div>
                <h1 className="text-2xl font-bold">连锁门店巡店问题台</h1>
                <p className="text-blue-200 text-sm">追踪巡店问题 · 整改复查 · 总部评分</p>
              </div>
            </div>
            <div className="text-sm text-blue-200">
              解决"问题散落在群里，总部难追踪"的业务痛点
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'stores' && <StoreManagement />}
        {activeTab === 'inspections' && <InspectionManagement onSelect={(e) => setSelectedEntity({ type: 'inspection', id: e.id })} />}
        {activeTab === 'problems' && <ProblemTracking onSelect={(p) => setSelectedEntity({ type: 'problem', id: p.id })} />}
        {activeTab === 'validation' && <ValidationDemo />}
        {activeTab === 'history' && <HistoryViewer initialEntity={selectedEntity} />}
      </main>

      <footer className="bg-white border-t mt-12 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>巡店问题台 - 前后端围绕同一套业务状态协作</p>
          <p className="mt-1">正常处理 ✓ | 失败原因 ❌ | 修正后重跑 🔄</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
