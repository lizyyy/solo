import { NavLink, useNavigate } from 'react-router-dom';
import { Upload, GitMerge, CheckSquare, Download, Home, Database } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const NAV_ITEMS = [
  { path: '/', icon: Upload, label: '导入材料' },
  { path: '/merge', icon: GitMerge, label: '自动归并' },
  { path: '/review', icon: CheckSquare, label: '人工复核' },
  { path: '/export', icon: Download, label: '导出公示' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { stats, loading, loadSampleData, clearAll } = useAppStore();

  const handleLoadSample = async () => {
    if (confirm('加载样例数据将覆盖当前所有数据，是否继续？')) {
      try {
        await loadSampleData();
        alert('样例数据加载成功！包含顺利记录、待确认记录、旧口径记录，以及同名路口、重复投诉、坐标偏移、跨时段统计等脏数据场景。');
        navigate('/review');
      } catch (e) {
        alert(e instanceof Error ? e.message : '加载失败');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      try {
        await clearAll();
        alert('数据已清空');
      } catch (e) {
        alert(e instanceof Error ? e.message : '清空失败');
      }
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col shadow-lg">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center shadow-md">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-primary-900 leading-tight">
              轨道站口
            </h1>
            <h1 className="font-serif font-bold text-lg text-accent-600 leading-tight">
              共享单车疏导
            </h1>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 pl-13">
          交通工程师何工专用工具
        </p>
      </div>

      {stats && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-transparent">
          <div className="text-xs text-gray-500 mb-2">数据概览</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="text-xl font-bold text-primary-900">{stats.total}</div>
              <div className="text-xs text-gray-500">总记录</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-status-processed">{stats.processed}</div>
              <div className="text-xs text-gray-500">已处理</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-status-verify">{stats.verify}</div>
              <div className="text-xs text-gray-500">待核实</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-status-onsite">{stats.onsite}</div>
              <div className="text-xs text-gray-500">需复看</div>
            </div>
          </div>
          {stats.withConflicts > 0 && (
            <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded text-center">
              ⚠ {stats.withConflicts} 条含异常
            </div>
          )}
          {stats.oldCaliber > 0 && (
            <div className="mt-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded text-center">
              📜 {stats.oldCaliber} 条旧口径
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-2">
        <button
          onClick={handleLoadSample}
          disabled={loading}
          className="w-full btn-accent text-sm flex items-center justify-center gap-2"
        >
          <Database className="w-4 h-4" />
          {loading ? '加载中...' : '加载样例数据'}
        </button>
        <button
          onClick={handleClearAll}
          disabled={loading}
          className="w-full btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50"
        >
          清空所有数据
        </button>
      </div>
    </aside>
  );
}
