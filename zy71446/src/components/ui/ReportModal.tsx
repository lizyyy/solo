import { useState, useMemo } from 'react';
import { X, Download, FileText, Share2, Printer } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useUILayoutStore } from '../../store/useUILayoutStore';
import { generateReport, generateReportMarkdown, exportReportAsJSON, downloadFile } from '../../utils/reportGenerator';
import { AnomalyDetector } from '../../engine/AnomalyDetector';

export function ReportModal() {
  const showReportModal = useUILayoutStore((state) => state.showReportModal);
  const toggleReportModal = useUILayoutStore((state) => state.toggleReportModal);
  const currentTime = useSimulationStore((state) => state.currentTime);
  const startTime = useSimulationStore((state) => state.startTime);
  const endTime = useSimulationStore((state) => state.endTime);
  const activeAnomalies = useSimulationStore((state) => state.activeAnomalies);
  const conflictLogs = useSimulationStore((state) => state.conflictLogs);
  const crowdDistribution = useSimulationStore((state) => state.crowdDistribution);
  const escalators = useSimulationStore((state) => state.escalators);
  const turnstiles = useSimulationStore((state) => state.turnstiles);

  const [exportFormat, setExportFormat] = useState<'markdown' | 'json'>('markdown');
  const [isGenerating, setIsGenerating] = useState(false);

  const report = useMemo(() => {
    return generateReport(
      currentTime,
      startTime,
      endTime,
      activeAnomalies,
      conflictLogs,
      crowdDistribution,
      escalators,
      turnstiles
    );
  }, [currentTime, startTime, endTime, activeAnomalies, conflictLogs, crowdDistribution, escalators, turnstiles]);

  const handleExport = async () => {
    setIsGenerating(true);
    try {
      if (exportFormat === 'markdown') {
        const markdown = generateReportMarkdown(report);
        downloadFile(markdown, `地铁换乘人流沙盘报告-${currentTime.replace(':', '')}.md`, 'text/markdown');
      } else {
        exportReportAsJSON(report, `地铁换乘人流沙盘报告-${currentTime.replace(':', '')}.json`);
      }
    } finally {
      setTimeout(() => setIsGenerating(false), 500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!showReportModal) return null;

  const highCount = report.summary.highRiskAnomalies;
  const mediumCount = report.summary.mediumRiskAnomalies;
  const conflictCount = report.summary.conflicts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={toggleReportModal}
      />

      <div className="relative w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-cyan-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <FileText className="text-cyan-400" size={22} />
            </div>
            <div>
              <h2 className="text-cyan-400 font-bold text-lg">运营分析报告</h2>
              <p className="text-slate-400 text-xs">生成时间: {report.metadata.generatedAt}</p>
            </div>
          </div>

          <button
            onClick={toggleReportModal}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">分析时段</div>
              <div className="text-white font-mono font-bold">{report.metadata.timeRange}</div>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
              <div className="text-red-400 text-xs mb-1">高风险异常</div>
              <div className="text-red-400 font-mono font-bold text-2xl">{highCount}</div>
            </div>
            <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
              <div className="text-yellow-400 text-xs mb-1">中风险异常</div>
              <div className="text-yellow-400 font-mono font-bold text-2xl">{mediumCount}</div>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
              <div className="text-purple-400 text-xs mb-1">数据冲突</div>
              <div className="text-purple-400 font-mono font-bold text-2xl">{conflictCount}</div>
            </div>
          </div>

          {report.anomalies.length > 0 && (
            <div className="mb-6">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-400 rounded-full" />
                异常时间线
              </h3>
              <div className="space-y-3">
                {report.anomalies.map((item) => {
                  const color = AnomalyDetector.getAnomalyColor(item.type);
                  const typeName = AnomalyDetector.getAnomalyTypeName(item.type);
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-800/50 rounded-lg p-4 border-l-4"
                      style={{ borderColor: color }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{ backgroundColor: `${color}30`, color }}
                          >
                            {typeName}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              item.severity === 'high'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {item.severity === 'high' ? '高风险' : '中风险'}
                          </span>
                        </div>
                        <span className="text-slate-400 text-xs font-mono">{item.time}</span>
                      </div>
                      <p className="text-slate-300 text-sm mb-2">{item.description}</p>

                      {item.evidenceChain && item.evidenceChain.length > 0 && (
                        <div className="bg-slate-900/50 rounded p-2">
                          <div className="text-xs text-slate-500 mb-1">证据链</div>
                          <div className="space-y-1">
                            {item.evidenceChain.map((ev, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <span className="text-cyan-400 font-mono">{ev.source}</span>
                                <span className="text-slate-500">→</span>
                                <span className="text-slate-300">{JSON.stringify(ev.data)}</span>
                                <span className="text-slate-500 font-mono ml-auto">
                                  {Math.round(ev.confidence * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.recommendation && (
                        <div className="mt-2 text-xs text-cyan-400 bg-cyan-500/10 rounded px-2 py-1">
                          💡 建议: {item.recommendation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {report.conflicts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-purple-400 rounded-full" />
                数据冲突记录
              </h3>
              <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-slate-400 text-xs">时间</th>
                      <th className="px-4 py-2 text-left text-slate-400 text-xs">冲突类型</th>
                      <th className="px-4 py-2 text-left text-slate-400 text-xs">数据源对比</th>
                      <th className="px-4 py-2 text-left text-slate-400 text-xs">解决状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {report.conflicts.map((conflict) => (
                      <tr key={conflict.id} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{conflict.timestamp}</td>
                        <td className="px-4 py-3 text-white text-xs">{conflict.conflictType}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs">
                            {Object.entries(conflict.sources)
                              .filter(([_, value]) => value !== undefined)
                              .map(([source, _], idx, arr) => {
                                const scores = Object.values(conflict.confidenceScores);
                                return (
                                  <span key={source} className="flex items-center gap-1">
                                    <span className="text-slate-300">{source}</span>
                                    <span className="text-cyan-400 font-mono">
                                      {Math.round(scores[idx] * 100)}%
                                    </span>
                                    {idx < arr.length - 1 && (
                                      <span className="text-slate-500">vs</span>
                                    )}
                                  </span>
                                );
                              })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              conflict.resolution !== 'pending'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {conflict.resolution !== 'pending' ? '已解决' : '待处理'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.recommendations.length > 0 && (
            <div>
              <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-green-400 rounded-full" />
                运营建议
              </h3>
              <div className="space-y-2">
                {report.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700"
                  >
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-slate-300 text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">导出格式:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                onClick={() => setExportFormat('markdown')}
                className={`px-3 py-1 text-xs transition-colors ${
                  exportFormat === 'markdown'
                    ? 'bg-cyan-500/30 text-cyan-400'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                Markdown
              </button>
              <button
                onClick={() => setExportFormat('json')}
                className={`px-3 py-1 text-xs transition-colors ${
                  exportFormat === 'json'
                    ? 'bg-cyan-500/30 text-cyan-400'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors text-sm"
            >
              <Printer size={16} />
              打印
            </button>
            <button
              onClick={handleExport}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition-colors text-sm disabled:opacity-50"
            >
              <Download size={16} />
              {isGenerating ? '生成中...' : '导出报告'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
