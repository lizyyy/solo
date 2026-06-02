import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Upload, 
  GitMerge, 
  FileCheck, 
  AlertTriangle, 
  Download,
  Database
} from 'lucide-react';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/merge', label: '数据归并', icon: GitMerge },
  { path: '/review', label: '人工复核', icon: FileCheck },
  { path: '/anomalies', label: '异常检测', icon: AlertTriangle },
  { path: '/export', label: '公示导出', icon: Download },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="w-8 h-8 text-orange-400" />
              <div>
                <h1 className="text-xl font-bold">城市照明能耗巡检</h1>
                <p className="text-xs text-gray-300">给交通工程师何工的小工具</p>
              </div>
            </div>
            <div className="text-sm text-gray-300">
              {new Date().toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <nav className="w-48 bg-white shadow-sm min-h-screen py-4">
          <ul className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 text-sm transition-colors ${
                      isActive 
                        ? 'bg-orange-50 text-orange-600 border-r-2 border-orange-500 font-medium' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
