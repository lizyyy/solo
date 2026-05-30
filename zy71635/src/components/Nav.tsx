import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, GitCompare } from 'lucide-react';
import { useHallStore } from '@/store/useHallStore';

export default function Nav() {
  const location = useLocation();
  const useErrorProneData = useHallStore((s) => s.useErrorProneData);
  const setUseErrorProneData = useHallStore((s) => s.setUseErrorProneData);

  const navItems = [
    { path: '/', label: '概览', icon: Home },
    { path: '/report', label: '报告', icon: FileText },
    { path: '/compare', label: '对比', icon: GitCompare },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">HA</span>
            </div>
            <span className="text-white font-semibold text-lg">Hall Acoustics</span>
          </div>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">数据源:</span>
            <button
              onClick={() => setUseErrorProneData(!useErrorProneData)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                useErrorProneData ? 'bg-red-500' : 'bg-green-500'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  useErrorProneData ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${
              useErrorProneData ? 'text-red-400' : 'text-green-400'
            }`}>
              {useErrorProneData ? '异常数据' : '正常数据'}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
