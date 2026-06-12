import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { Database, RefreshCw, AlertCircle, CheckCircle, Layers, Link2, Link2Off, Hash } from 'lucide-react';

export const Header = () => {
  const { records, selfCheckResults, runSelfCheck, loadSampleData, consistencyCheckResult, getUnifiedView, runConsistencyCheck } =
    useEmotionLabelStore();

  const totalIssues = selfCheckResults.reduce((sum, r) => sum + r.issues.filter((i) => !i.resolved).length, 0);
  const allPassed = selfCheckResults.length > 0 && selfCheckResults.every((r) => r.passed);

  const pendingReviewCount = records.filter((r) => r.status === 'reviewing').length;

  const view = getUnifiedView('page');
  const dataHash = view.dataHash.slice(0, 8);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            音频样本情绪标签管理工作台
          </h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>当前共 {records.length} 条记录</span>
            <span className={pendingReviewCount > 0 ? 'text-amber-600 font-medium' : ''}>
              {pendingReviewCount} 条待复核
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-400">
              <Hash className="w-3 h-3" />
              数据哈希: {dataHash}...
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {consistencyCheckResult.checkedAt && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded ${
              consistencyCheckResult.passed ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {consistencyCheckResult.passed ? (
                <>
                  <Link2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium">页面/导出/报告 同源</span>
                </>
              ) : (
                <>
                  <Link2Off className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-red-700 font-medium">数据不一致!</span>
                </>
              )}
            </div>
          )}

          {selfCheckResults.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-gray-50">
              {allPassed ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-xs text-gray-600">
                {allPassed ? '自检通过' : `${totalIssues} 问题`}
              </span>
            </div>
          )}

          <button
            onClick={() => {
              runSelfCheck();
              runConsistencyCheck();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            全量校验
          </button>

          <button
            onClick={loadSampleData}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#1e3a5f] bg-[#ebf4ff] rounded hover:bg-[#dbeafe] transition-colors"
          >
            <Database className="w-4 h-4" />
            加载样例
          </button>
        </div>
      </div>
    </header>
  );
};
