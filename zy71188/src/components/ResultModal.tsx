import type { InspectionReport, ScoreBreakdown } from '../game/types';

interface ResultModalProps {
  report: InspectionReport | null;
  onClose: () => void;
  onRestart: () => void;
  onExport: (format: 'json' | 'txt') => void;
}

export function ResultModal({ report, onClose, onRestart, onExport }: ResultModalProps) {
  if (!report) return null;

  const gradeColors: Record<string, string> = {
    S: 'text-purple-400 bg-purple-900/30 border-purple-500',
    A: 'text-green-400 bg-green-900/30 border-green-500',
    B: 'text-blue-400 bg-blue-900/30 border-blue-500',
    C: 'text-yellow-400 bg-yellow-900/30 border-yellow-500',
    D: 'text-orange-400 bg-orange-900/30 border-orange-500',
    F: 'text-red-400 bg-red-900/30 border-red-500'
  };

  const scoreItems: Array<{ label: string; value: number; color: string }> = [
    { label: '基础分数', value: report.scoreBreakdown.baseScore, color: 'text-gray-300' },
    { label: '正确标记', value: report.scoreBreakdown.correctMarks, color: 'text-green-400' },
    { label: '错误标记', value: report.scoreBreakdown.wrongMarks, color: 'text-red-400' },
    { label: '未发现扣分', value: report.scoreBreakdown.missedHazards, color: 'text-red-400' },
    { label: '时间奖励', value: report.scoreBreakdown.timeBonus, color: 'text-blue-400' }
  ];

  const failReasons: string[] = [];
  if (report.missedHazards > 0) {
    failReasons.push(`未发现 ${report.missedHazards} 个隐患`);
  }
  if (report.wrongMarks > 0) {
    failReasons.push(`误报 ${report.wrongMarks} 次`);
  }
  if (report.score < 600) {
    failReasons.push('总分低于及格线');
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">巡检报告</h2>
            <p className="text-gray-400">{report.levelName}</p>
          </div>

          <div className={`inline-block w-full text-center py-4 rounded-xl border-2 mb-6 ${gradeColors[report.grade]}`}>
            <div className="text-6xl font-bold mb-2">{report.grade}</div>
            <div className="text-2xl font-bold">{report.score} 分</div>
          </div>

          {failReasons.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
              <h3 className="text-red-400 font-semibold mb-2">失败原因</h3>
              <ul className="text-red-300 text-sm space-y-1">
                {failReasons.map((reason, index) => (
                  <li key={index}>• {reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{report.totalHazards}</p>
              <p className="text-xs text-gray-400">隐患总数</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{report.foundHazards}</p>
              <p className="text-xs text-gray-400">已发现</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{report.missedHazards}</p>
              <p className="text-xs text-gray-400">未发现</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{report.wrongMarks}</p>
              <p className="text-xs text-gray-400">误报</p>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">分数明细</h3>
            <div className="space-y-2">
              {scoreItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-400">{item.label}</span>
                  <span className={`font-mono font-bold ${item.color}`}>
                    {item.value > 0 ? `+${item.value}` : item.value}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-600 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">最终得分</span>
                  <span className="text-2xl font-bold text-amber-400">{report.scoreBreakdown.totalScore}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">发现记录</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {report.findings.map((finding, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span>{finding.found ? '✅' : '❌'}</span>
                  <span className={finding.found ? 'text-green-400' : 'text-red-400'}>
                    {finding.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={onRestart}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              再来一局
            </button>
            <button
              onClick={() => onExport('txt')}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              导出报告
            </button>
            <button
              onClick={() => onExport('json')}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              导出JSON
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
