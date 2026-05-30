import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText, AlertTriangle, AlertCircle, Info, Calendar } from 'lucide-react';
import { useHallStore } from '@/store/useHallStore';

export default function ReportPage() {
  const hall = useHallStore((s) => s.hall);
  const anomalies = useHallStore((s) => s.anomalies);
  const frequencyCoverages = useHallStore((s) => s.frequencyCoverages);
  const impacts = useHallStore((s) => s.impacts);
  const generateReport = useHallStore((s) => s.generateReport);
  const loadData = useHallStore((s) => s.loadData);
  const useErrorProneData = useHallStore((s) => s.useErrorProneData);

  useEffect(() => {
    loadData(useErrorProneData);
  }, []);

  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;
  const infoCount = anomalies.filter((a) => a.severity === 'info').length;

  const zoneIds = [...new Set(frequencyCoverages.map((c) => c.zoneId))];
  const frequencies = [...new Set(frequencyCoverages.map((c) => c.frequency))].sort((a, b) => a - b);

  if (!hall) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              返回概览
            </Link>
            <div className="h-6 w-px bg-gray-600" />
            <h1 className="text-white text-xl font-semibold">声学分析报告</h1>
          </div>
          <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{hall.name}</h2>
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>{new Date().toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
            <div className="bg-amber-500/20 text-amber-400 px-4 py-2 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">异常总数</div>
              <div className="text-3xl font-bold text-white">{anomalies.length}</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
              <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                <AlertCircle className="w-4 h-4" />
                严重
              </div>
              <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
                <AlertTriangle className="w-4 h-4" />
                警告
              </div>
              <div className="text-3xl font-bold text-amber-400">{warningCount}</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                <Info className="w-4 h-4" />
                信息
              </div>
              <div className="text-3xl font-bold text-blue-400">{infoCount}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold text-lg mb-4">异常时间线</h3>
          <div className="space-y-4">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className={`p-4 rounded-lg border ${
                  anomaly.severity === 'critical'
                    ? 'bg-red-500/10 border-red-500/30'
                    : anomaly.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                        anomaly.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : anomaly.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {anomaly.severity}
                    </span>
                    <span className="text-gray-400 text-sm">{anomaly.type}</span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      anomaly.status === 'confirmed'
                        ? 'bg-green-500/20 text-green-400'
                        : anomaly.status === 'dismissed'
                        ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {anomaly.status === 'confirmed' ? '已确认' : anomaly.status === 'dismissed' ? '已忽略' : '待处理'}
                  </span>
                </div>
                <p className="text-white mb-2">{anomaly.description}</p>
                <div className="text-sm text-gray-400">
                  来源: {anomaly.sourceType} - {anomaly.sourceId}
                </div>
                {anomaly.traceChain.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-500 mb-2">追踪链路:</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {anomaly.traceChain.map((link, idx) => (
                        <span key={link.id} className="flex items-center gap-1">
                          <span className="text-amber-400 text-sm">{link.label}</span>
                          {idx < anomaly.traceChain.length - 1 && (
                            <span className="text-gray-600">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold text-lg mb-4">频率覆盖概览</h3>
          <div className="space-y-4">
            {zoneIds.map((zoneId) => {
              const zoneCoverages = frequencyCoverages.filter((c) => c.zoneId === zoneId);
              const zoneName = zoneId;
              return (
                <div key={zoneId} className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-white font-medium mb-3">{zoneName}</div>
                  <div className="flex gap-2">
                    {frequencies.map((freq) => {
                      const coverage = zoneCoverages.find((c) => c.frequency === freq);
                      const percent = coverage?.coveragePercent ?? 0;
                      const barColor =
                        percent >= 80 ? 'bg-green-500' : percent >= 60 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={freq} className="flex-1 text-center">
                          <div className="h-24 flex items-end justify-center">
                            <div
                              className={`w-8 ${barColor} rounded-t`}
                              style={{ height: `${percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-400 mt-2">{freq}Hz</div>
                          <div className="text-xs text-white font-medium">{percent}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {impacts.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold text-lg mb-4">影响评估汇总</h3>
            <div className="space-y-4">
              {impacts.map((impact) => {
                const anomaly = anomalies.find((a) => a.id === impact.anomalyId);
                return (
                  <div key={impact.id} className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-white font-medium mb-2">
                      {anomaly?.description || `异常 ${impact.anomalyId}`}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">预算影响: </span>
                        <span
                          className={
                            impact.budgetImpact === 'high'
                              ? 'text-red-400'
                              : impact.budgetImpact === 'medium'
                              ? 'text-amber-400'
                              : impact.budgetImpact === 'low'
                              ? 'text-blue-400'
                              : 'text-green-400'
                          }
                        >
                          {impact.budgetImpact}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">进度影响: </span>
                        <span
                          className={
                            impact.scheduleImpact === 'high'
                              ? 'text-red-400'
                              : impact.scheduleImpact === 'medium'
                              ? 'text-amber-400'
                              : impact.scheduleImpact === 'low'
                              ? 'text-blue-400'
                              : 'text-green-400'
                          }
                        >
                          {impact.scheduleImpact}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">人员影响: </span>
                        <span
                          className={
                            impact.rosterImpact === 'high'
                              ? 'text-red-400'
                              : impact.rosterImpact === 'medium'
                              ? 'text-amber-400'
                              : impact.rosterImpact === 'low'
                              ? 'text-blue-400'
                              : 'text-green-400'
                          }
                        >
                          {impact.rosterImpact}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-gray-400 text-sm">{impact.detail}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={generateReport}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            <FileText className="w-5 h-5" />
            生成正式报告
          </button>
        </div>
      </div>
    </div>
  );
}
