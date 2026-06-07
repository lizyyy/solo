import { Link, Outlet, useLocation } from 'react-router-dom';
import { 
  ClipboardList, 
  FileUp, 
  FileText, 
  BookOpen, 
  Download,
  Building2
} from 'lucide-react';

const navItems = [
  { path: '/', label: '审批工作台', icon: ClipboardList },
  { path: '/import', label: '数据导入', icon: FileUp },
  { path: '/export', label: '摘要导出', icon: Download },
  { path: '/rules', label: '边界规则', icon: BookOpen },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Source Han Serif SC, serif' }}>
                商业街外摆
              </h1>
              <p className="text-xs text-gray-500">时段审批系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 text-sm font-medium">宁</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">阿宁</p>
              <p className="text-xs text-gray-500">城更项目经理</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
