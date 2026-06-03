import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useClearingStore } from '@/store/useClearingStore';
import { Loader2 } from 'lucide-react';

export default function Layout() {
  const { fetchAllData, loading, error } = useClearingStore();

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-carbon-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-carbon-500 animate-spin mx-auto mb-4" />
          <p className="text-carbon-600">正在加载数据...</p>
          <p className="text-sm text-carbon-400 mt-2">小周正在整理清算记录，请稍候～</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-carbon-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-8 shadow-card max-w-md">
          <div className="w-16 h-16 bg-risk-red-light rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-carbon-800 mb-2">数据加载失败</h2>
          <p className="text-carbon-600 mb-4">{error}</p>
          <button
            onClick={() => fetchAllData()}
            className="px-6 py-2 bg-carbon-600 text-white rounded-lg hover:bg-carbon-700 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-carbon-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
