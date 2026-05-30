import { Database, BarChart3, History, FileText, AlertTriangle, XCircle } from 'lucide-react';
import { useBatchStore } from '@/store/useBatchStore';
import { useValidation } from '@/hooks/useValidation';
import { cn } from '@/lib/utils';

interface BatchTabsProps {
  batchId: string;
}

const tabs = [
  { key: 'data', label: '数据录入', icon: Database },
  { key: 'analysis', label: '数据分析', icon: BarChart3 },
  { key: 'history', label: '历史记录', icon: History },
  { key: 'report', label: '报告导出', icon: FileText },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export const BatchTabs = ({ batchId }: BatchTabsProps) => {
  const activeTab = useBatchStore((state) => state.activeTab);
  const setActiveTab = useBatchStore((state) => state.setActiveTab);
  const validationErrors = useBatchStore((state) => state.validationErrors);
  const samplePoints = useBatchStore((state) => state.samplePoints);
  const fitResult = useBatchStore((state) => state.fitResult);
  const historyRecords = useBatchStore((state) => state.historyRecords);

  const { criticalErrors, warnings } = useValidation(validationErrors);

  const getTabBadge = (tab: TabKey) => {
    switch (tab) {
      case 'data': {
        const errorCount = criticalErrors.length;
        const warningCount = warnings.length;
        if (errorCount > 0) return { count: errorCount, type: 'error' as const };
        if (warningCount > 0) return { count: warningCount, type: 'warning' as const };
        return null;
      }
      case 'analysis': {
        const hasData = samplePoints.length >= 3;
        const needsAnalysis = samplePoints.length >= 3 && !fitResult;
        if (needsAnalysis) return { count: 1, type: 'warning' as const };
        if (!hasData) return { count: 1, type: 'warning' as const };
        return null;
      }
      case 'history': {
        if (historyRecords.length > 0) return { count: historyRecords.length, type: 'info' as const };
        return null;
      }
      default:
        return null;
    }
  };

  const Badge = ({ type, count }: { type: 'error' | 'warning' | 'info'; count: number }) => {
    const badgeClass = cn(
      'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium',
      'transition-all duration-200',
      type === 'error' && 'bg-red-500 text-white',
      type === 'warning' && 'bg-amber-500 text-white',
      type === 'info' && 'bg-blue-500 text-white'
    );

    return (
      <span className={badgeClass}>
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      <nav className="flex space-x-1 px-4" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const badge = getTabBadge(tab.key);

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'group relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2',
                isActive
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  isActive && 'scale-110'
                )}
              />
              <span className="relative">
                {tab.label}
                {badge && (
                  <span className="absolute -right-6 top-0">
                    <Badge type={badge.type} count={badge.count} />
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-slideUp" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-4 px-6 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs">
        {criticalErrors.length > 0 && (
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            <span>{criticalErrors.length} 个错误需要处理</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{warnings.length} 个警告</span>
          </div>
        )}
        {criticalErrors.length === 0 && warnings.length === 0 && (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>数据校验通过</span>
          </div>
        )}
      </div>
    </div>
  );
};
