import { useExperimentStore } from '@/store/useExperimentStore';
import { SummaryView } from '@/components/Summary/SummaryView';
import { FileText, RefreshCw } from 'lucide-react';

export const SummaryPage = () => {
  const {
    experiments,
    currentExperimentId,
    setCurrentExperiment,
    getCurrentSummaries,
    regenerateSummary,
    getCurrentExperiment,
  } = useExperimentStore();

  const summaries = getCurrentSummaries();
  const currentExperiment = getCurrentExperiment();

  const handleRegenerate = () => {
    if (currentExperimentId) {
      regenerateSummary(currentExperimentId);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            可解释摘要
          </h1>
          <p className="text-gray-500">
            {currentExperiment ? currentExperiment.name : '请选择实验查看摘要'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={currentExperimentId || ''}
            onChange={(e) => setCurrentExperiment(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新生成摘要
          </button>
        </div>
      </div>

      {summaries.length > 0 ? (
        <div className="space-y-6">
          {[...summaries].reverse().map((summary, index) => (
            <SummaryView key={summary.id} summary={summary} isLatest={index === 0} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无摘要</h3>
          <p className="text-gray-500 mb-4">请先导入训练日志和录入调参笔记</p>
        </div>
      )}
    </div>
  );
};
