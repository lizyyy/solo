import { Link, useLocation } from 'react-router-dom';
import { Drum, History } from 'lucide-react';

export default function NavBar() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isHistory = location.pathname === '/history';

  return (
    <nav className="sticky top-0 z-50 bg-drum-bg/90 backdrop-blur-md border-b border-drum-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 group">
            <Drum className="w-6 h-6 text-drum-copper group-hover:text-drum-copperLight transition-colors" />
            <span className="font-display text-lg text-drum-text group-hover:text-drum-copperLight transition-colors">
              鼓皮换算
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                isHome
                  ? 'bg-drum-copper/15 text-drum-copper'
                  : 'text-drum-textMuted hover:text-drum-text hover:bg-drum-card'
              }`}
            >
              <Drum className="w-4 h-4" />
              换算工作台
            </Link>
            <Link
              to="/history"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                isHistory
                  ? 'bg-drum-copper/15 text-drum-copper'
                  : 'text-drum-textMuted hover:text-drum-text hover:bg-drum-card'
              }`}
            >
              <History className="w-4 h-4" />
              历史与报告
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
