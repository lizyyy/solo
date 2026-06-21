import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Wheat, History as HistoryIcon, FileEdit, PlayCircle, Menu, X } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { FarmList } from './pages/FarmList';
import { History as HistoryPage } from './pages/History';
import { Supplement } from './pages/Supplement';
import { Replay } from './pages/Replay';
import { ControlBar } from './components/ControlBar';
import { useGameStore } from './store/useGameStore';
import { cn } from './lib/utils';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';

const navItems = [
  { path: '/', label: '主控台', icon: LayoutDashboard },
  { path: '/farms', label: '农场交易', icon: Wheat },
  { path: '/history', label: '历史记录', icon: HistoryIcon },
  { path: '/supplement', label: '数据补录', icon: FileEdit },
  { path: '/replay', label: '历史回放', icon: PlayCircle },
];

function Navbar() {
  const { game, isReplaying } = useGameStore();
  const { toasts, removeToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showNav = game !== null && game.status !== 'idle' && game.status !== null;

  if (!showNav) {
    return (
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {isReplaying && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <p className="text-sm text-blue-700 text-center">
              <PlayCircle className="w-4 h-4 inline mr-2" />
              回放模式：正在查看历史数据，所有操作已禁用
            </p>
          </div>
        </div>
      )}
      
      <ControlBar />
      
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all',
                        isActive
                          ? 'bg-forest-50 text-forest-700 border-b-2 border-forest-500'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      )
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="px-2 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                        isActive
                          ? 'bg-forest-50 text-forest-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      )
                    }
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  const { initGame, game } = useGameStore();

  useEffect(() => {
    if (!game) {
      initGame();
    }
  }, [game, initGame]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/farms" element={<FarmList />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/supplement" element={<Supplement />} />
          <Route path="/replay" element={<Replay />} />
        </Routes>
      </div>
    </Router>
  );
}
