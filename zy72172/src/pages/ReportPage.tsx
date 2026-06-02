import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Dashboard from '../components/Dashboard';
import ReportView from '../components/ReportView';

export default function ReportPage() {
  const { data, resetData } = useAppContext();
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'report'>('dashboard');

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-municipal-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white hover:text-blue-200 transition-colors">
              ← 返回地图
            </Link>
            <div>
              <h1 className="text-xl font-bold">数据中心</h1>
              <p className="text-sm text-blue-200 mt-1">统计看板 · 报告生成</p>
            </div>
          </div>
          <button
            onClick={resetData}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            重置数据
          </button>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="px-6 flex gap-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'dashboard'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            数据看板
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'report'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            报告生成
          </button>
        </div>
      </div>

      <main>
        {activeTab === 'dashboard' ? (
          <Dashboard points={data.points} />
        ) : (
          <ReportView />
        )}
      </main>
    </div>
  );
}
