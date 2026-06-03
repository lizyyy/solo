import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import HomePage from './pages/HomePage';
import RecordDetailPage from './pages/RecordDetailPage';
import ImportPage from './pages/ImportPage';
import AdjustmentPage from './pages/AdjustmentPage';
import DemoPage from './pages/DemoPage';
import {
  HomeIcon,
  DocumentArrowUpIcon,
  AdjustmentsHorizontalIcon,
  PlayCircleIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

function Navigation() {
  const location = useLocation();
  const { state } = useApp();

  const navItems = [
    { path: '/', label: '对账核查', icon: HomeIcon },
    { path: '/import', label: '数据导入', icon: DocumentArrowUpIcon },
    { path: '/adjustment', label: '尾差调整', icon: AdjustmentsHorizontalIcon },
    { path: '/demo', label: '演示模式', icon: PlayCircleIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-finance-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <span className="text-finance-600 font-bold text-sm">期</span>
            </div>
            <h1 className="font-serif-sc text-xl font-semibold">期货交割仓单核查系统</h1>
          </div>
          
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-3">
            {state.demoMode && (
              <span className="px-3 py-1 bg-amber-500 text-white text-xs rounded-full animate-pulse-slow">
                演示模式 Step {state.demoStep}
              </span>
            )}
            <div className="flex items-center space-x-2">
              <UserCircleIcon className="w-6 h-6 text-white/80" />
              <span className="text-sm">{state.currentUser.name}</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function LoadingOverlay() {
  const { state } = useApp();
  
  if (!state.loading) return null;
  
  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-lg p-6 shadow-xl flex items-center space-x-4">
        <div className="w-8 h-8 border-4 border-finance-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-700 font-medium">处理中...</span>
      </div>
    </div>
  );
}

function ErrorToast() {
  const { state, dispatch } = useApp();
  
  if (!state.error) return null;
  
  return (
    <div className="fixed top-20 right-4 z-50 animate-slide-up">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 font-medium">{state.error}</span>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
            className="text-red-400 hover:text-red-600 ml-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <LoadingOverlay />
      <ErrorToast />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/record/:id" element={<RecordDetailPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/adjustment" element={<AdjustmentPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/demo/step/:step" element={<DemoPage />} />
        </Routes>
      </main>
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
