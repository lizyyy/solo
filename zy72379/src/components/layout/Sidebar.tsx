import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  FlaskConical, 
  AlertTriangle, 
  Wrench, 
  BookOpen,
  Database,
  ChevronRight
} from 'lucide-react';
import { useCleaningStore } from '@/store/useCleaningStore';

const navItems = [
  { path: '/', label: '数据清洗工作台', icon: FlaskConical, description: '三步工作流主界面' },
  { path: '/conflicts', label: '冲突裁决中心', icon: AlertTriangle, description: '证据冲突人工裁决' },
  { path: '/review', label: '超阈值复核区', icon: Wrench, description: '维修师傅复核处理' },
  { path: '/samples', label: '样例展示区', icon: BookOpen, description: '三类处理结果演示' },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { records, conflicts, thresholdAlerts } = useCleaningStore();

  const pendingConflicts = conflicts.filter(c => c.resolutionStatus === 'pending').length;
  const pendingReviews = thresholdAlerts.filter(a => a.reviewStatus === 'pending_review').length;

  const getBadgeCount = (path: string) => {
    if (path === '/conflicts') return pendingConflicts;
    if (path === '/review') return pendingReviews;
    return 0;
  };

  return (
    <aside className="w-64 bg-primary-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-primary-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg font-mono">应变清洗</h1>
            <p className="text-xs text-primary-300">材料拉伸数据处理</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const badge = getBadgeCount(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                isActive
                  ? 'bg-primary-500 text-white'
                  : 'text-primary-200 hover:bg-primary-800 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-primary-400 group-hover:text-primary-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{item.label}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-warning-500 text-white rounded-full animate-pulse-slow">
                      {badge}
                    </span>
                  )}
                </div>
                <p className={`text-xs ${isActive ? 'text-primary-100' : 'text-primary-400'}`}>
                  {item.description}
                </p>
              </div>
              {isActive && <ChevronRight className="w-4 h-4" />}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary-800">
        <div className="bg-primary-800 rounded-lg p-4">
          <div className="text-xs text-primary-300 mb-2">当前数据统计</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-primary-100">{records.length}</div>
              <div className="text-xs text-primary-400">总记录数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-warning-400">
                {pendingConflicts + pendingReviews}
              </div>
              <div className="text-xs text-primary-400">待处理</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-primary-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">林</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">林老师</div>
            <div className="text-xs text-primary-400">实验负责人</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
