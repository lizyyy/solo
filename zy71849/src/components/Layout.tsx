import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import {
  LayoutDashboard,
  FileText,
  PenTool,
  Eye,
  ClipboardList,
  ChevronRight,
  User,
  AlertCircle,
  X,
} from 'lucide-react';

export default function Layout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentProject, error, clearError, currentUser, setCurrentUser } = useAppStore();

  const navLinks = id
    ? [
        { to: `/projects/${id}`, label: '项目总览', icon: LayoutDashboard },
        { to: `/projects/${id}/device-remarks`, label: '设备备注', icon: FileText },
        { to: `/projects/${id}/cad-points`, label: 'CAD点位', icon: PenTool },
        { to: `/projects/${id}/sight-analysis`, label: '视线分析', icon: Eye },
        { to: `/projects/${id}/inspection`, label: '巡检单', icon: ClipboardList },
      ]
    : [];

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <h1 className="font-serif text-xl font-semibold text-primary-800">剧院座席视线</h1>
          <p className="text-xs text-slate-500 mt-1">分析管理系统</p>
        </div>

        <div className="px-4 py-3 border-b border-slate-100">
          <button
            onClick={() => navigate('/projects')}
            className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>项目列表</span>
          </button>
        </div>

        {currentProject && (
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">当前项目</p>
            <p className="text-sm font-medium text-slate-700 line-clamp-2">{currentProject.name}</p>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <link.icon className="w-4 h-4" />
              <span>{link.label}</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <select
                value={currentUser}
                onChange={(e) => setCurrentUser(e.target.value)}
                className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none w-full cursor-pointer"
              >
                <option value="王经理">王经理</option>
                <option value="张工">张工（设备）</option>
                <option value="李设计师">李设计师（CAD）</option>
                <option value="王工程师">王工程师</option>
              </select>
              <p className="text-xs text-slate-500">项目经理</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button onClick={clearError} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
