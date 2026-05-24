import { Store, Settings, HelpCircle, User } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export function TopBar() {
  const store = useAppStore((state) => state.store);
  const issues = useAppStore((state) => state.issues);

  const highPriorityIssues = issues.filter((i) => i.severity === 'high').length;

  return (
    <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-blue-400" />
          <h1 className="text-lg font-bold text-white">货架陈列体检系统</h1>
        </div>
        {store && (
          <div className="ml-4 flex items-center gap-2">
            <span className="text-slate-400 text-sm">当前门店:</span>
            <span className="text-white text-sm font-medium">{store.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {store && (
          <div className="flex items-center gap-4 mr-4">
            {highPriorityIssues > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-900/50 border border-red-700 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-sm font-medium">
                  {highPriorityIssues} 个严重问题
                </span>
              </div>
            )}
          </div>
        )}

        <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}
