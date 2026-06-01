import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc3, LayoutDashboard, Layers, History, AlertTriangle, FileBarChart, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', label: '比赛控制台', icon: LayoutDashboard },
  { path: '/levels', label: '关卡管理', icon: Layers },
  { path: '/history', label: '历史记录', icon: History },
  { path: '/conflicts', label: '冲突处理', icon: AlertTriangle },
  { path: '/reports', label: '报告生成', icon: FileBarChart },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-vinyl-900/95 backdrop-blur-md border-b border-gold-500/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <Disc3 className="w-8 h-8 text-gold-500" />
            </motion.div>
            <span className="font-serif text-xl font-bold text-gold-400 text-shadow-gold">
              黑胶节拍修复赛
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'bg-gold-500/20 text-gold-400 shadow-gold'
                      : 'text-vinyl-300 hover:text-gold-400 hover:bg-vinyl-800/50'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>

          <button
            className="md:hidden p-2 text-vinyl-300 hover:text-gold-400 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden overflow-hidden border-t border-gold-500/10"
          >
            <div className="px-4 py-3 space-y-1 bg-vinyl-900/98">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'bg-gold-500/20 text-gold-400'
                        : 'text-vinyl-300 hover:text-gold-400 hover:bg-vinyl-800/50'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
