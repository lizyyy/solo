import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { runSelfCheck } from '../utils/business';
import type { SelfCheckResult } from '../types';

const SelfCheckPage: React.FC = () => {
  const { state, dispatch } = useApp();
  const [checkResults, setCheckResults] = useState<SelfCheckResult[] | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunCheck = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = runSelfCheck(state.reviewRecords);
      setCheckResults(results);
      setIsRunning(false);
    }, 800);
  };

  const handleExport = () => {
    const exportData = {
      exportTime: new Date().toISOString(),
      exportedBy: state.currentUser,
      records: state.reviewRecords.map(r => ({
        recordId: r.recordId,
        sampleId: r.sampleId,
        candidateName: r.interview.candidateName,
        position: r.interview.position,
        modelVersion: r.interview.modelVersion,
        aiScore: r.interview.aiScore,
        humanScore: r.correction?.humanScore,
        finalScore: r.finalScore,
        promptVersion: r.promptVersion?.versionNumber,
        finalConclusion: r.finalConclusion,
        status: r.status,
        hasUnresolvedConflicts: r.conflicts.some(c => !c.resolved),
      })),
      selfCheckResults: checkResults,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-interview-bias-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      dispatch({ type: 'RESET_STATE' });
      setCheckResults(null);
    }
  };

  const passedCount = checkResults ? checkResults.filter(r => r.passed).length : 0;
  const totalCount = checkResults ? checkResults.length : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">系统自检</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRunCheck}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {isRunning ? '检测中...' : '运行自检'}
          </button>
          <button
            onClick={handleExport}
            disabled={!checkResults}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            导出数据
          </button>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            清空数据
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">自检范围说明</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>重复导入检测</strong>：检查同样本编号是否被多次导入</li>
          <li>• <strong>模型版本一致性检测</strong>：检查样本编号相同但模型版本不同的情况</li>
          <li>• <strong>补录后重算一致性</strong>：检查补录提示词版本后最终分数是否正确</li>
          <li>• <strong>导出数据一致性</strong>：检查最终分数与结论是否匹配</li>
        </ul>
      </div>

      {checkResults && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-4xl font-bold ${passedCount === totalCount ? 'text-green-600' : 'text-yellow-600'}`}>
              {passedCount}/{totalCount}
            </div>
            <div>
              <p className="font-medium">
                {passedCount === totalCount ? '所有检查通过' : `有 ${totalCount - passedCount} 项检查未通过`}
              </p>
              <p className="text-sm text-gray-500">
                检测时间：{checkResults[0]?.checkedAt}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {checkResults.map(result => (
              <div key={result.checkId} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedCheck(expandedCheck === result.checkId ? null : result.checkId)}
                  className={`w-full flex items-center justify-between p-4 text-left ${
                    result.passed ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      result.passed ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {result.passed ? '✓' : '✗'}
                    </span>
                    <div>
                      <p className="font-medium">{result.checkName}</p>
                      <p className="text-sm text-gray-600">{result.message}</p>
                    </div>
                  </div>
                  {result.details && result.details.length > 0 && (
                    <span className="text-gray-400">
                      {expandedCheck === result.checkId ? '▲' : '▼'}
                    </span>
                  )}
                </button>
                {expandedCheck === result.checkId && result.details && result.details.length > 0 && (
                  <div className="p-4 bg-white border-t">
                    <ul className="text-sm space-y-1">
                      {result.details.map((detail, idx) => (
                        <li key={idx} className="font-mono text-gray-700 bg-gray-50 p-2 rounded">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!checkResults && !isRunning && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">点击「运行自检」开始检测</p>
          <p className="text-sm mt-2">系统将自动检测数据中的常见问题</p>
        </div>
      )}

      {isRunning && (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">正在执行自检...</p>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">设计原则</h4>
        <p className="text-sm text-blue-700">
          界面保持简单，但核心数据流转严格校验。宁可结论少，不可证据链断。
          每一步操作均记入历史，可在产品复盘页追溯完整证据链。
        </p>
      </div>
    </div>
  );
};

export default SelfCheckPage;
