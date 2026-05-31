import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, User, Activity } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { useAppStore } from '@/store/useAppStore';
import type { Activity as ActivityType } from '@/types';
import Sidebar from './Sidebar';

export default function Layout() {
  const location = useLocation();
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);
  const { currentActivity, activities, setCurrentActivity, currentOperator } =
    useAppStore();

  const handleActivityChange = async (activity: ActivityType) => {
    await setCurrentActivity(activity.id);
    setActivityDropdownOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <div className="ml-60">
        <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setActivityDropdownOpen(!activityDropdownOpen)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors',
                  activityDropdownOpen && 'ring-2 ring-sky-500 ring-offset-2'
                )}
              >
                <Activity className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {currentActivity?.name || '选择活动'}
                </span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 transition-transform duration-200',
                    activityDropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              <AnimatePresence>
                {activityDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50"
                  >
                    {activities.map((activity) => (
                      <button
                        key={activity.id}
                        onClick={() => handleActivityChange(activity)}
                        className={cn(
                          'w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between',
                          currentActivity?.id === activity.id && 'bg-sky-50'
                        )}
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {activity.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {activity.startDate} ~ {activity.endDate}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs rounded-full',
                            activity.status === 'active' &&
                              'bg-green-100 text-green-700',
                            activity.status === 'completed' &&
                              'bg-slate-100 text-slate-600',
                            activity.status === 'draft' &&
                              'bg-yellow-100 text-yellow-700'
                          )}
                        >
                          {activity.status === 'active'
                            ? '进行中'
                            : activity.status === 'completed'
                              ? '已结束'
                              : '草稿'}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700">
                {currentOperator}
              </span>
            </div>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-4rem)] p-6">
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-50 pointer-events-none" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative z-10"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
