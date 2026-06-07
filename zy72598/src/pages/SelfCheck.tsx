import { useExperimentStore } from '@/store/useExperimentStore';
import { CheckItemCard } from '@/components/SelfCheck/CheckItemCard';
import { CheckSquare, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

export const SelfCheckPage = () => {
  const {
    experiments,
    currentExperimentId,
    setCurrentExperiment,
    runSelfCheckForExperiment,
    getCurrentSelfCheck,
    getCurrentExperiment,
  } = useExperimentStore();

  const selfCheckResult = getCurrentSelfCheck();
  const currentExperiment = getCurrentExperiment();

  const handleRunCheck = () => {
    if (currentExperimentId) {
      runSelfCheckForExperiment(currentExperimentId);
    }
  };

  const allPassed = selfCheckResult ? Object.values(selfCheckResult).every((r) => r.passed) : false;
  const passedCount = selfCheckResult ? Object.values(selfCheckResult).filter((r) => r.passed).length : 0;
  const totalCount = selfCheckResult ? Object.keys(selfCheckResult).length : 4;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            <CheckSquare className="w-7 h-7 text-blue-600" />
            自检中心
          </h1>
          <p className="text-gray-500">
            四项基本自检：重复导入检测、特征缺失检测、补录重算验证、导出一致性校验
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
            onClick={handleRunCheck}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            执行自检
          </button>
        </div>
      </div>

      {currentExperiment && (
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">{currentExperiment.name}</h3>
          <p className="text-sm text-gray-500">ID: {currentExperiment.id}</p>
        </div>
      )}

      {selfCheckResult ? (
        <>
          <div
            className={`rounded-xl p-6 mb-6 flex items-center gap-4 ${
              allPassed
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            {allPassed ? (
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            ) : (
              <AlertCircle className="w-10 h-10 text-amber-500" />
            )}
            <div>
              <h3
                className={`text-lg font-semibold ${allPassed ? 'text-green-900' : 'text-amber-900'}`}
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                {allPassed ? '所有自检项通过 ✓' : `自检发现问题 (${passedCount}/${totalCount} 通过)`}
              </h3>
              <p className={`text-sm ${allPassed ? 'text-green-700' : 'text-amber-700'}`}>
                {allPassed
                  ? '实验数据完整一致，可以导出结论'
                  : '请关注未通过的自检项，必要时请推荐负责人复核'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(selfCheckResult).map(([key, value]) => (
              <CheckItemCard key={key} checkKey={key} passed={value.passed} details={value.details} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">尚未执行自检</h3>
          <p className="text-gray-500 mb-4">点击右上角「执行自检」按钮开始检测</p>
          <button
            onClick={handleRunCheck}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            立即执行自检
          </button>
        </div>
      )}
    </div>
  );
};
