import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlayCircle, FileBarChart, Box } from 'lucide-react';

export function NavBar() {
  return (
    <div className="absolute top-0 left-0 w-14 h-full bg-slate-900/95 border-r border-slate-700 flex flex-col items-center py-4 z-30">
      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-6">
        <Box className="w-6 h-6 text-white" />
      </div>

      <nav className="flex flex-col gap-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="sr-only">3D堆场</span>
        </NavLink>

        <NavLink
          to="/replay"
          className={({ isActive }) =>
            `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          <PlayCircle className="w-5 h-5" />
          <span className="sr-only">任务回放</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) =>
            `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          <FileBarChart className="w-5 h-5" />
          <span className="sr-only">报告管理</span>
        </NavLink>
      </nav>
    </div>
  );
}
