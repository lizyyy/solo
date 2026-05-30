import { Bell, Search, User, ChevronRight, RefreshCw } from 'lucide-react';
import { useBatchStore } from '@/store/useBatchStore';
import { useValidation } from '@/hooks/useValidation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; path?: string }[];
}

export const Header = ({ title, subtitle, breadcrumbs }: HeaderProps) => {
  const currentBatch = useBatchStore((state) => state.currentBatch);
  const validationErrors = useBatchStore((state) => state.validationErrors);
  const needsReanalysis = currentBatch?.needsReanalysis;
  const runFit = useBatchStore((state) => state.runFit);
  const loading = useBatchStore((state) => state.loading);

  const { hasErrors, hasWarnings, criticalErrors, warnings } =
    useValidation(validationErrors);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-1 text-sm mb-2">
                {breadcrumbs.map((crumb, index) => (
                  <span key={index} className="flex items-center gap-1">
                    {index > 0 && (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span
                      className={`${
                        index === breadcrumbs.length - 1
                          ? 'text-blue-600 font-medium'
                          : 'text-slate-500'
                      }`}
                    >
                      {crumb.label}
                    </span>
                  </span>
                ))}
              </nav>
            )}
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
                )}
              </div>

              {currentBatch && needsReanalysis && (
                <button
                  onClick={() => runFit()}
                  disabled={loading || hasErrors}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                  重新分析
                </button>
              )}

              {currentBatch && (hasErrors || hasWarnings) && (
                <div className="flex items-center gap-2">
                  {hasErrors && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {criticalErrors.length} 个错误
                      </span>
                    </div>
                  )}
                  {hasWarnings && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {warnings.length} 个警告
                      </span>
                    </div>
                  )}
                  {!hasErrors && !hasWarnings && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">校验通过</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索批次..."
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56 transition-all"
              />
            </div>

            <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              {validationErrors.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700">
                {currentBatch?.studentName || '访客用户'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
