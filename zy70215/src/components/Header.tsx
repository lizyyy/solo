import { useApp } from '../context/AppContext';
import type { TabType } from '../types';

const tabs: { id: TabType; label: string }[] = [
  { id: 'dashboard', label: '工作台' },
  { id: 'screenings', label: '排片管理' },
  { id: 'cleaning', label: '清洁任务' },
  { id: 'lostItems', label: '遗失物' },
  { id: 'equipment', label: '设备异常' },
  { id: 'history', label: '历史查询' },
];

export function Header() {
  const { activeTab, setActiveTab, data, canExport, exportData } = useApp();

  const totalCount = data.screenings.length + data.cleaningTasks.length + 
                      data.lostItems.length + data.equipmentIssues.length;

  return (
    <header className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 border-b border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-8 9 8v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20v-8h6v8" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold">影院影厅清洁交接台</h1>
                <p className="text-xs text-slate-400">排片→清洁→遗失物/设备异常 全流程</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-400">
              数据总量: <span className="text-cyan-400 font-medium">{totalCount}</span>
            </span>
            <button
              onClick={exportData}
              disabled={!canExport}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                canExport
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              导出 Excel
            </button>
          </div>
        </div>
        <nav className="flex space-x-1 py-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-cyan-400 shadow-inner'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
