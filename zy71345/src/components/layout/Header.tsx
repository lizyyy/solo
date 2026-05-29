import { Clock, Download, Database, RefreshCw } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function Header() {
  const { currentVersionId, versions, currentData, isChecked } = useDataStore();
  const currentVersion = versions.find((v) => v.id === currentVersionId);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-xl font-serif font-semibold text-gray-800">
              管弦乐谱缺页检查系统
            </h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}</span>
            </div>
          </div>

          {currentVersion && (
            <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-xs text-blue-600 font-medium">当前版本</div>
              <div className="text-sm text-blue-800 font-semibold">
                {currentVersion.name}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {currentVersionId && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Database className="w-4 h-4" />
              <span>
                声部: {currentData.parts.length} | 乐手: {currentData.musicians.length} | 
                修订页: {currentData.revisions.length} | 发放记录: {currentData.distributions.length}
              </span>
            </div>
          )}

          {isChecked && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm">
              <RefreshCw className="w-4 h-4" />
              <span>已检查</span>
            </div>
          )}

          <button
            onClick={() => {
              const dataStr = JSON.stringify(currentData, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `乐谱数据_${format(new Date(), 'yyyyMMdd')}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">导出数据</span>
          </button>
        </div>
      </div>
    </header>
  );
}
