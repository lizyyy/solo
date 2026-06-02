import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Samples from './pages/Samples';
import CheckupDetail from './pages/CheckupDetail';
import Compare from './pages/Compare';
import Conflicts from './pages/Conflicts';
import Settings from './pages/Settings';
import { useAppStore } from './store/appStore';
import { initMockData } from './db/mockData';
import { initializeDB } from './db';

function App() {
  const { isLoading, setLoading, setInitialized } = useAppStore();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await initializeDB();
        const initialized = localStorage.getItem('db_initialized');
        if (!initialized) {
          await initMockData();
          localStorage.setItem('db_initialized', 'true');
        }
        setInitialized(true);
      } catch (error) {
        console.error('初始化失败:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-serif font-bold text-slate-800 mb-2">
            RAG知识库引用体检
          </h2>
          <p className="text-slate-500">正在初始化数据...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/samples" element={<Samples />} />
        <Route path="/checkup/:runId" element={<CheckupDetail />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/conflicts" element={<Conflicts />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
