import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { Database, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export const Header = () => {
  const { records, selfCheckResults, lastSelfCheckAt, runSelfCheck, loadSampleData } =
    useEmotionLabelStore();

  const totalIssues = selfCheckResults.reduce((sum, r) => sum + r.issues.filter((i) => !i.resolved).length, 0);
  const allPassed = selfCheckResults.length > 0 && selfCheckResults.every((r) => r.passed);

  const pendingReviewCount = records.filter((r) => r.status === 'reviewing').length;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            音频样本情绪标签管理工作台
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            当前共 {records.length} 条记录 | {pendingReviewCount} 条待复核
          </p>
        </div>

        <div className="flex items-center gap-4">
          {selfCheckResults.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-gray-50">
              {allPassed ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
              <span className="text-sm text-gray-600">
                {allPassed ? '自检全部通过' : `${totalIssues} 个待处理问题`}
              </span>
            </div>
          )}

          <button
            onClick={runSelfCheck}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            运行自检
          </button>

          <button
            onClick={loadSampleData}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#1e3a5f] bg-[#ebf4ff] rounded hover:bg-[#dbeafe] transition-colors"
          >
            <Database className="w-4 h-4" />
            加载样例数据
          </button>
        </div>
      </div>
    </header>
  );
};
