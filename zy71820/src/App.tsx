import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Gamepad2, Database, History, Download, Menu, X } from 'lucide-react';
import { useState } from 'react';
import GamePage from './pages/GamePage';
import DataManagementPage from './pages/DataManagementPage';
import HistoryPage from './pages/HistoryPage';
import ExportPage from './pages/ExportPage';
import { Toast } from './components/common/Toast';
import { FriendlyModal } from './components/common/FriendlyModal';
import { useUIStore } from './store/useUIStore';
import { initDB } from './utils/idb';
import { getErrorMessage, FriendlyError } from './utils/errorMessages';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: '游戏', icon: Gamepad2 },
    { path: '/data', label: '数据管理', icon: Database },
    { path: '/history', label: '操作历史', icon: History },
    { path: '/export', label: '导出复盘', icon: Download },
  ];

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="sticky top-0 z-40 bg-deep-purple/95 backdrop-blur-lg border-b border-neon-purple/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌙</span>
            <span className="font-title text-xl text-neon-orange drop-shadow-[0_0_8px_rgba(255,107,53,0.5)]">
              夜市摊位经营赛
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all font-body ${
                    isActive
                      ? 'bg-neon-orange text-white shadow-neon-orange'
                      : 'text-gray-300 hover:text-white hover:bg-neon-purple/30'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </div>

          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-neon-purple/30">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all font-body ${
                    isActive
                      ? 'bg-neon-orange text-white'
                      : 'text-gray-300 hover:text-white hover:bg-neon-purple/30'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function AppContent() {
  const { toasts, showModal, modalContent, closeModal, showError } = useUIStore();

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
      } catch (error) {
        console.error('DB init failed:', error);
        if (error instanceof FriendlyError) {
          showError(getErrorMessage(error.code));
        } else {
          showError(getErrorMessage('IDB_NOT_INITIALIZED'));
        }
      }
    };
    init();

    const handleBeforeUnload = () => {
      // 页面卸载前的清理工作
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showError]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-deep-purple via-neon-purple/20 to-deep-purple">
      <Navbar />
      
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="/data" element={<DataManagementPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/export" element={<ExportPage />} />
      </Routes>

      <Toast toasts={toasts} />

      {showModal && modalContent && (
        <FriendlyModal
          isOpen={showModal}
          onClose={closeModal}
          title={modalContent.title}
          error={modalContent.error}
          onConfirm={modalContent.onConfirm}
          onCancel={modalContent.onCancel}
          confirmText={modalContent.confirmText}
          cancelText={modalContent.cancelText}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
