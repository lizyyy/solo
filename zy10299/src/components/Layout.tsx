import React from 'react';
import { FileText, RefreshCw, History, Award } from 'lucide-react';
import { useStore } from '../store/useStore';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTab, setActiveTab, reissueRequests } = useStore();
  const pendingCount = reissueRequests.filter(r => r.status === 'pending').length;
  const blockedCount = reissueRequests.filter(r => r.status === 'blocked').length;

  const tabs = [
    { id: 'ledger' as const, label: '发放台账', icon: FileText },
    { id: 'reissue' as const, label: '补发审批', icon: RefreshCw, badge: pendingCount + blockedCount },
    { id: 'records' as const, label: '更正记录', icon: History }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">校园竞赛证书补发台</h1>
              <p className="text-sm text-gray-500">教务处 - 证书管理系统</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 right-0 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
