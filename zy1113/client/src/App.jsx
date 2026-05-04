import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CallDetail from './pages/CallDetail';
import CallList from './pages/CallList';
import ImportPage from './pages/ImportPage';
import CommitmentList from './pages/CommitmentList';

function App() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '归因看板', icon: '📊' },
    { path: '/calls', label: '通话列表', icon: '📞' },
    { path: '/commitments', label: '承诺跟进', icon: '✅' },
    { path: '/import', label: '数据导入', icon: '📥' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">
                🎧 售后语音纪要归因系统
              </h1>
            </div>
            <div className="flex space-x-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link flex items-center space-x-1 ${
                    location.pathname === item.path ? 'nav-link-active' : ''
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calls" element={<CallList />} />
          <Route path="/calls/:callId" element={<CallDetail />} />
          <Route path="/commitments" element={<CommitmentList />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </main>

      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            售后语音纪要归因和跟进建议台 · 本地版本 · 数据全部存储在本地
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
