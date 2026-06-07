import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { getRoleName } from './utils/storage';
import type { Role } from './types';
import ImportPage from './components/ImportPage';
import ReviewList from './components/ReviewList';
import ReplayPage from './components/ReplayPage';
import SelfCheckPage from './components/SelfCheckPage';

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
      active
        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

const RoleSelector: React.FC = () => {
  const { state, dispatch } = useApp();

  const roles: { role: Role; name: string; user: string }[] = [
    { role: 'product_manager', name: 'AI产品经理', user: '阿宁' },
    { role: 'operation_reviewer', name: '运营复核人', user: '张运营' },
    { role: 'admin', name: '管理员', user: '系统' },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">当前身份：</span>
      <div className="flex gap-1">
        {roles.map(r => (
          <button
            key={r.role}
            onClick={() => dispatch({ type: 'SET_ROLE', payload: { role: r.role, user: r.user } })}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              state.currentRole === r.role
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>
      <span className="text-sm text-gray-400 ml-2">（{state.currentUser}）</span>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { state, dispatch } = useApp();

  const tabs = [
    { key: 'import' as const, label: '数据导入' },
    { key: 'review' as const, label: '审核列表' },
    { key: 'replay' as const, label: '产品复盘' },
    { key: 'selfcheck' as const, label: '系统自检' },
  ];

  const renderPage = () => {
    switch (state.activeTab) {
      case 'import':
        return <ImportPage />;
      case 'review':
        return <ReviewList />;
      case 'replay':
        return <ReplayPage />;
      case 'selfcheck':
        return <SelfCheckPage />;
      default:
        return <ImportPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-800">AI 面试评分偏差系统</h1>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                v1.0
              </span>
            </div>
            <RoleSelector />
          </div>
          <div className="flex gap-1">
            {tabs.map(tab => (
              <TabButton
                key={tab.key}
                active={state.activeTab === tab.key}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.key })}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>
        </div>
      </header>

      <main>
        {renderPage()}
      </main>

      <footer className="border-t bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>
              设计原则：结论可追溯 · 证据链完整 · 不自动拍板 · 界面简单
            </p>
            <p>
              当前角色：{getRoleName(state.currentRole)} ({state.currentUser})
            </p>
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
