import { Link, useLocation } from 'react-router-dom';
import { Play, History, Upload, Home, RotateCcw } from 'lucide-react';
import { allTestRecords, smoothRecord, reworkRecord } from '@/data/mockRecords';
import { useImportStore } from '@/stores/useImportStore';
import { useState } from 'react';

export function Navbar() {
  const location = useLocation();
  const { processRecord } = useImportStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const navItems = [
    { path: '/', label: '游戏', icon: Home },
    { path: '/history', label: '历史记录', icon: History },
    { path: '/import', label: '数据导入', icon: Upload },
  ];

  const handleDemoSmooth = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await processRecord(smoothRecord);
    } catch (e) {
        console.error('Failed to process smooth record:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemoRework = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await processRecord(reworkRecord);
    } catch (e) {
        console.error('Failed to process rework record:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemoAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      for (const record of allTestRecords) {
        await processRecord(record);
      }
    } catch (e) {
        console.error('Failed to process records:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <nav className="glass-panel-dark sticky top-0 z-50 px-6 py-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
            <Play className="w-6 h-6 text-primary-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-glow">央行利率迷宫</h1>
            <p className="text-xs text-white/60">科普馆金融教育互动系统</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={handleDemoSmooth}
              disabled={isProcessing}
              className="px-3 py-1.5 text-sm bg-success-600/30 hover:bg-success-600/50 text-success-200 rounded-md transition-colors disabled:opacity-50"
            >
              演示：顺利通关
            </button>
            <button
              onClick={handleDemoRework}
              className="px-3 py-1.5 text-sm bg-warning-600/30 hover:bg-warning-600/50 text-warning-200 rounded-md transition-colors disabled:opacity-50"
              disabled={isProcessing}
            >
              演示：返工处理
            </button>
            <button
              onClick={handleDemoAll}
              className="px-3 py-1.5 text-sm bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 rounded-md transition-colors disabled:opacity-50"
              disabled={isProcessing}
            >
              <div className="flex items-center gap-1">
                <RotateCcw className="w-4 h-4" />
                <span>导入全部测试</span>
              </div>
            </button>
          </div>
          <div className="hidden md:flex items-center gap-1 ml-4 border-l border-white/20 pl-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-accent-500/30 text-accent-400'
                      : 'hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="md:hidden flex items-center gap-2 mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-accent-500/30 text-accent-400'
                  : 'bg-white/5 text-white/70'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
