import { Music, Plus, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';

export default function Header() {
  const location = useLocation();
  const { clearAllData, initializeWithSamples, notifications } = useStore();

  const showActions = location.pathname === '/';

  const handleReset = () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      clearAllData();
    }
  };

  const handleLoadSamples = () => {
    if (notifications.length > 0) {
      if (!confirm('加载样例数据将合并到现有数据中，确定继续吗？')) {
        return;
      }
    }
    initializeWithSamples();
  };

  return (
    <header className="bg-burgundy-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="bg-gold-500 p-2 rounded">
              <Music className="w-6 h-6 text-burgundy-900" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-gold-500">乐团替补排练通知</h1>
              <p className="text-xs text-burgundy-200">管理系统 - 有迹可循，有据可查</p>
            </div>
          </Link>

          {showActions && (
            <div className="flex items-center space-x-3">
              <button
                onClick={handleLoadSamples}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-burgundy-800 hover:bg-burgundy-700 rounded transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>加载样例</span>
              </button>
              <button
                onClick={handleReset}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-burgundy-800 hover:bg-red-700 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>清空数据</span>
              </button>
              <Link
                to="/new"
                className="flex items-center space-x-2 bg-gold-500 text-burgundy-900 px-4 py-2 rounded font-medium hover:bg-gold-400 transition-colors shadow-md"
              >
                <Plus className="w-5 h-5" />
                <span>新建通知</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
