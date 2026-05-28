import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Image, LayoutGrid, Gavel, FileText, BarChart3 } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/artworks', icon: Image, label: '作品' },
  { path: '/curation', icon: LayoutGrid, label: '策展' },
  { path: '/auction', icon: Gavel, label: '拍卖' },
  { path: '/settlement', icon: FileText, label: '结算' },
  { path: '/report', icon: BarChart3, label: '报告' }
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameState } = useGameStore();

  const isHome = location.pathname === '/';

  if (isHome) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Gavel className="text-amber-400" size={24} />
              <span className="font-serif text-xl text-amber-100">NFT策展拍卖局</span>
            </div>

            <div className="flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${location.pathname === item.path
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                    }
                  `}
                >
                  <item.icon size={18} />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="text-slate-400">
                回合 <span className="text-amber-400 font-mono">{gameState.currentRound}</span>
                <span className="text-slate-600">/{gameState.totalRounds}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="text-slate-400">
                收益 <span className="text-emerald-400 font-mono">¥{gameState.totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-8">
        <Outlet />
      </main>
    </div>
  );
}
