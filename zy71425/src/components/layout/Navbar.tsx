import { Link, useLocation } from 'react-router-dom';
import { Atom, Home, Edit3, Play, BarChart3, History, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavbarProps {
  onReset?: () => void;
}

export function Navbar({ onReset }: NavbarProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '样例库', icon: Home },
    { path: '/editor', label: '轨道编辑', icon: Edit3 },
    { path: '/simulation', label: '模拟运行', icon: Play },
    { path: '/analysis', label: '结果分析', icon: BarChart3 },
    { path: '/history', label: '历史记录', icon: History },
  ];

  return (
    <nav className="bg-space-dark/90 backdrop-blur-md border-b border-tech-gray/30 px-6 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <Atom className="w-8 h-8 text-plasma-blue" />
          </motion.div>
          <div>
            <h1 className="font-display font-bold text-xl text-white tracking-wide">
              粒子加速器拼轨
            </h1>
            <p className="text-xs text-tech-light font-mono">
              Particle Accelerator Track Builder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <motion.button
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all duration-300 ${
                    isActive
                      ? 'bg-plasma-blue/20 text-plasma-blue border border-plasma-blue/50'
                      : 'text-tech-light hover:text-white hover:bg-space-medium'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </motion.button>
              </Link>
            );
          })}

          {onReset && (
            <motion.button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm text-energy-red hover:bg-energy-red/10 transition-all ml-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="重置画布"
            >
              <RotateCcw className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </nav>
  );
}
