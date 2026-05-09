import { useState } from 'react';
import { AppProvider } from './context';
import { Toasts } from './components/Toasts';
import { Dashboard } from './components/Dashboard';
import { CertificateList } from './components/CertificateList';
import { ImportExport } from './components/ImportExport';
import { History } from './components/History';

type Tab = 'dashboard' | 'list' | 'import' | 'history';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: '数据概览', icon: '📊' },
    { key: 'list', label: '证照管理', icon: '📋' },
    { key: 'import', label: '导入导出', icon: '📥' },
    { key: 'history', label: '操作历史', icon: '📜' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📄</span>
              <div>
                <h1 className="text-xl font-bold text-gray-800">本地证照到期审查工具</h1>
                <p className="text-sm text-gray-500">管理门店许可证、员工健康证和供应商资质</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              数据保存在本地浏览器
            </div>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  activeTab === tab.key
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'list' && <CertificateList />}
        {activeTab === 'import' && <ImportExport />}
        {activeTab === 'history' && <History />}
      </main>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">💡 使用提示</h4>
              <ul className="text-gray-500 space-y-1">
                <li>• 支持手动添加和批量导入证照</li>
                <li>• 系统自动计算到期状态（30天内为即将过期）</li>
                <li>• 支持人工复核并记录复核意见</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">🔒 数据安全</h4>
              <ul className="text-gray-500 space-y-1">
                <li>• 所有数据保存在浏览器本地</li>
                <li>• 不会上传到任何服务器</li>
                <li>• 建议定期导出备份数据</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">📝 证照类型</h4>
              <ul className="text-gray-500 space-y-1">
                <li>🏪 门店许可证：营业执照、经营许可证等</li>
                <li>💊 员工健康证：从业人员健康证明</li>
                <li>📋 供应商资质：供货商相关资质文件</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t text-center text-sm text-gray-400">
            本地证照到期审查工具 - 数据安全，操作便捷
          </div>
        </div>
      </footer>

      <Toasts />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
