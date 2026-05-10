import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CoursesPage from './pages/CoursesPage';
import EnrollmentsPage from './pages/EnrollmentsPage';
import TransfersPage from './pages/TransfersPage';
import WaitlistPage from './pages/WaitlistPage';
import ClassSummaryPage from './pages/ClassSummaryPage';
import StudentSchedulePage from './pages/StudentSchedulePage';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

function App() {
  const location = useLocation();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const state = location.state as { toast?: Toast } | null;
    if (state?.toast) {
      addToast(state.toast.type, state.toast.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const navItems = [
    { path: '/', label: '课程列表', icon: '📚' },
    { path: '/enrollments', label: '报名管理', icon: '📝' },
    { path: '/transfers', label: '改选申请', icon: '🔄' },
    { path: '/waitlist', label: '候补转入', icon: '⏳' },
    { path: '/classes', label: '班级汇总', icon: '👥' },
    { path: '/schedule', label: '学生课表', icon: '🗓️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🏫 小学课后服务选课台</h1>
              <p className="text-blue-100 mt-1">管理课程、学生报名、改选和候补</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  location.pathname === item.path
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<CoursesPage onToast={addToast} />} />
          <Route path="/enrollments" element={<EnrollmentsPage onToast={addToast} />} />
          <Route path="/transfers" element={<TransfersPage onToast={addToast} />} />
          <Route path="/waitlist" element={<WaitlistPage onToast={addToast} />} />
          <Route path="/classes" element={<ClassSummaryPage onToast={addToast} />} />
          <Route path="/schedule" element={<StudentSchedulePage onToast={addToast} />} />
        </Routes>
      </main>

      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`max-w-sm p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
              toast.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="flex items-start">
              <span className="mr-2">
                {toast.type === 'success' ? '✅' :
                 toast.type === 'error' ? '❌' :
                 toast.type === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>

      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-gray-500 text-sm">
          © 2024 小学课后服务选课管理系统
        </div>
      </footer>
    </div>
  );
}

export default App;
