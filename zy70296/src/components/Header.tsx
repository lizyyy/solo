import { StoreType } from '../store/useStore';
import { Film, Home, RefreshCw, Settings, History, BarChart3 } from 'lucide-react';

interface HeaderProps {
  store: StoreType;
}

const Header = ({ store }: HeaderProps) => {
  const { state, navigate } = store;

  const navItems = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'pickup', label: '取片服务', icon: Film },
    { id: 'reprint', label: '补打申请', icon: RefreshCw },
    { id: 'admin', label: '管理中心', icon: Settings },
    { id: 'history', label: '历史记录', icon: History },
    { id: 'statistics', label: '统计分析', icon: BarChart3 },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Film className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">影像科胶片自助取片台</h1>
              <p className="text-xs text-gray-500">Film Self-Service Station</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = state.currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="md:hidden pb-4 overflow-x-auto">
          <div className="flex space-x-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = state.currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id as any)}
                  className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4 mb-1" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
