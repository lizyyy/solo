import { NavLink, useNavigate } from 'react-router-dom';
import { AlertTriangle, FileUp, FileDown, History, Home, User, Settings } from 'lucide-react';

interface HeaderProps {
  activePage?: string;
  onImportClick?: () => void;
}

export function Header({ onImportClick }: HeaderProps) {
  const navigate = useNavigate();

  const handleImportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onImportClick) {
      onImportClick();
    } else {
      navigate('/import');
    }
  };

  return (
    <header className="bg-[#1e3a5f] text-white shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <AlertTriangle className="w-6 h-6" />
              <h1 className="text-xl font-bold" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                股票质押预警管理系统
              </h1>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Home className="w-4 h-4" />
                预警名单
              </NavLink>
              {onImportClick ? (
                <button
                  onClick={handleImportClick}
                  className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <FileUp className="w-4 h-4" />
                  数据导入
                </button>
              ) : (
                <NavLink
                  to="/import"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <FileUp className="w-4 h-4" />
                  数据导入
                </NavLink>
              )}
              <NavLink
                to="/export"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <FileDown className="w-4 h-4" />
                报告导出
              </NavLink>
              <NavLink
                to="/history"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <History className="w-4 h-4" />
                历史记录
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <User className="w-4 h-4" />
              <span>风控人员</span>
            </div>
            <button
              className="p-2 rounded hover:bg-white/10 transition-colors"
              title="设置"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
