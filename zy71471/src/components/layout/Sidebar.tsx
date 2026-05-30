import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  Settings,
  Zap,
} from 'lucide-react';
import { useBatchStore } from '@/store/useBatchStore';
import dayjs from 'dayjs';

export const Sidebar = () => {
  const navigate = useNavigate();
  const createBatch = useBatchStore((state) => state.createBatch);

  const handleNewBatch = () => {
    const newBatch = createBatch({});
    navigate(`/batches/${newBatch.id}/data`);
  };

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">RC电路实验</h1>
            <p className="text-xs text-slate-400">充放电记录系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <NavLink
              to="/batches"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">批次管理</span>
            </NavLink>
          </li>
          <li>
            <button
              onClick={handleNewBatch}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200 group"
            >
              <div className="w-5 h-5 rounded border-2 border-dashed border-slate-500 group-hover:border-blue-400 flex items-center justify-center">
                <PlusCircle className="w-4 h-4" />
              </div>
              <span className="font-medium">新建实验</span>
            </button>
          </li>
        </ul>

        <div className="mt-8">
          <h3 className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            快捷操作
          </h3>
          <ul className="space-y-1">
            <li>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors text-sm">
                <FileText className="w-4 h-4" />
                <span>导出所有报告</span>
              </button>
            </li>
            <li>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors text-sm">
                <Settings className="w-4 h-4" />
                <span>系统设置</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-1">今日</p>
          <p className="text-lg font-semibold text-white">
            {dayjs().format('YYYY年MM月DD日')}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            系统版本 v1.0.0
          </p>
        </div>
      </div>
    </aside>
  );
};
