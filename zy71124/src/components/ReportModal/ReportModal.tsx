import { X, Download, Printer, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { ConflictDetector } from '../../engine/ConflictDetector';

export default function ReportModal() {
  const {
    buses,
    conflicts,
    totalDuration,
    showReport,
    setShowReport,
  } = useScheduleStore();

  if (!showReport) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sortedBuses = [...buses].sort((a, b) => a.departureTime - b.departureTime);
  const resolvedConflicts = conflicts.filter(c => c.resolved);
  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  const criticalCount = unresolvedConflicts.filter(c => c.severity === 'critical').length;
  const warningCount = unresolvedConflicts.filter(c => c.severity === 'warning').length;

  const efficiencyScore = Math.max(0, 100 - criticalCount * 20 - warningCount * 10);

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalDuration,
      totalBuses: buses.length,
      efficiencyScore,
      conflicts: {
        total: conflicts.length,
        critical: criticalCount,
        warning: warningCount,
        resolved: resolvedConflicts.length,
      },
      busSchedule: sortedBuses.map(bus => ({
        number: bus.number,
        route: bus.route,
        departureTime: formatTime(bus.departureTime),
        capacity: bus.capacity,
        status: bus.status,
      })),
      conflictDetails: conflicts.map(c => ({
        type: ConflictDetector.getInstance().getConflictTypeLabel(c.type),
        severity: ConflictDetector.getInstance().getSeverityLabel(c.severity),
        time: formatTime(c.time),
        description: c.description,
        involvedBuses: c.involvedBuses.map(id => buses.find(b => b.id === id)?.number).join(', '),
        resolved: c.resolved,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `调度报告_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTextReport = () => {
    const text = `
═══════════════════════════════════════════════
           校车停车场发车调度报告
═══════════════════════════════════════════════

生成时间: ${new Date().toLocaleString('zh-CN')}
总调度时长: ${formatTime(totalDuration)}
车辆数量: ${buses.length} 辆
调度效率评分: ${efficiencyScore}/100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    概览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

冲突总数: ${conflicts.length} 个
  ├─ 严重冲突: ${criticalCount} 个
  ├─ 警告冲突: ${warningCount} 个
  └─ 已解决: ${resolvedConflicts.length} 个

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 发车时间表
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

序号  车号    线路        发车时间  载客量
${sortedBuses.map((bus, i) => 
  `${(i + 1).toString().padStart(2, '0')}   ${bus.number.padEnd(6)} ${bus.route.padEnd(12)} ${formatTime(bus.departureTime).padEnd(8)} ${bus.capacity}人`
).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 冲突详情
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${unresolvedConflicts.length === 0 ? '无未解决冲突' : unresolvedConflicts.map((c, i) => `
${i + 1}. [${ConflictDetector.getInstance().getSeverityLabel(c.severity)}] ${ConflictDetector.getInstance().getConflictTypeLabel(c.type)}
   时间: ${formatTime(c.time)}
   涉及车辆: ${c.involvedBuses.map(id => buses.find(b => b.id === id)?.number).join(', ')}
   说明: ${c.description}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  优化建议
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${criticalCount > 0 ? '⚠️  存在严重冲突，建议立即调整发车顺序' : '✅  无严重冲突'}
${warningCount > 0 ? '⚠️  存在警告冲突，建议优化发车间隔' : '✅  无警告冲突'}
${efficiencyScore >= 80 ? '👍  整体调度效率优秀' : efficiencyScore >= 60 ? '👌  调度效率一般，有优化空间' : '⚠️  调度效率较低，建议调整'}

═══════════════════════════════════════════════
    `.trim();

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `调度报告_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">调度报告</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportReport}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={exportTextReport}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <Download className="w-4 h-4" />
              TXT
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <Printer className="w-4 h-4" />
              打印
            </button>
            <button
              onClick={() => setShowReport(false)}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{buses.length}</div>
              <div className="text-sm text-gray-400">车辆总数</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{formatTime(totalDuration)}</div>
              <div className="text-sm text-gray-400">总调度时长</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className={`text-3xl font-bold ${efficiencyScore >= 80 ? 'text-green-400' : efficiencyScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {efficiencyScore}
              </div>
              <div className="text-sm text-gray-400">效率评分</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-400">{unresolvedConflicts.length}</div>
              <div className="text-sm text-gray-400">待解决冲突</div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              {unresolvedConflicts.length === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              )}
              冲突分析
            </h3>
            
            {unresolvedConflicts.length === 0 ? (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <div className="text-green-400 font-medium">调度方案无冲突</div>
                <div className="text-sm text-gray-400">所有车辆发车顺序合理</div>
              </div>
            ) : (
              <div className="space-y-3">
                {unresolvedConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className={`p-4 rounded-lg border ${
                      conflict.severity === 'critical'
                        ? 'bg-red-900/20 border-red-500/30'
                        : 'bg-yellow-900/20 border-yellow-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${conflict.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
                        <span className={`font-medium text-sm ${conflict.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {ConflictDetector.getInstance().getSeverityLabel(conflict.severity)} - {ConflictDetector.getInstance().getConflictTypeLabel(conflict.type)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {formatTime(conflict.time)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{conflict.description}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      涉及车辆: {conflict.involvedBuses.map(id => buses.find(b => b.id === id)?.number).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-3">发车时间表</h3>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="text-left text-gray-300 font-medium px-4 py-2">序号</th>
                    <th className="text-left text-gray-300 font-medium px-4 py-2">车号</th>
                    <th className="text-left text-gray-300 font-medium px-4 py-2">线路</th>
                    <th className="text-left text-gray-300 font-medium px-4 py-2">发车时间</th>
                    <th className="text-left text-gray-300 font-medium px-4 py-2">载客量</th>
                    <th className="text-left text-gray-300 font-medium px-4 py-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBuses.map((bus, index) => (
                    <tr key={bus.id} className="border-t border-gray-700">
                      <td className="px-4 py-2 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: bus.color }}
                          />
                          <span className="text-white font-medium">{bus.number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-300">{bus.route}</td>
                      <td className="px-4 py-2 font-mono text-gray-300">{formatTime(bus.departureTime)}</td>
                      <td className="px-4 py-2 text-gray-300">{bus.capacity}人</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          bus.status === 'departed' ? 'bg-green-500/20 text-green-400' :
                          bus.status === 'departing' ? 'bg-orange-500/20 text-orange-400' :
                          bus.status === 'boarding' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {bus.status === 'departed' ? '已发车' :
                           bus.status === 'departing' ? '发车中' :
                           bus.status === 'boarding' ? '上车中' : '待命'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-2">优化建议</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              {criticalCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  存在严重冲突，建议立即调整发车顺序，确保前方车辆先于后方车辆发车
                </li>
              )}
              {warningCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  存在警告冲突，建议优化同一通道内车辆发车间隔（至少15秒）
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                建议将高优先级线路安排在外侧车位，减少通道占用时间
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                学生上车时间建议预留至少10秒，确保完全登车后再发车
              </li>
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={() => setShowReport(false)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            关闭报告
          </button>
        </div>
      </div>
    </div>
  );
}
