import { Download, FileJson, FileSpreadsheet, Play, X } from 'lucide-react';
import type { GameRecord } from '@/types/game';
import { generateReport, exportReportAsJSON, exportReportAsCSV, downloadFile } from '@/utils/reportGenerator';

interface ReportPanelProps {
  record: GameRecord;
  onClose: () => void;
  onReplay: () => void;
}

export const ReportPanel = ({ record, onClose, onReplay }: ReportPanelProps) => {
  const report = generateReport(record);

  const handleExportJSON = () => {
    const content = exportReportAsJSON(record);
    const filename = `行李分拣报告_${record.levelName}_${new Date(record.startTime).toISOString().slice(0, 10)}.json`;
    downloadFile(content, filename, 'application/json');
  };

  const handleExportCSV = () => {
    const content = exportReportAsCSV(record);
    const filename = `行李分拣报告_${record.levelName}_${new Date(record.startTime).toISOString().slice(0, 10)}.csv`;
    downloadFile(content, filename, 'text/csv;charset=utf-8');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };

  const errorTypeLabels: Record<string, string> = {
    wrong_gate: '送错航班口',
    transfer_timeout: '转机超时',
    oversize_wrong_lane: '超规件走错线',
    flight_cancelled: '航班取消未转存',
    missed_flight: '漏过航班',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">分拣报告</h2>
            <p className="text-sm text-gray-400">{report.levelName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className={`p-6 rounded-xl mb-6 ${
            report.passed
              ? 'bg-green-900/20 border border-green-700/50'
              : 'bg-red-900/20 border border-red-700/50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-3xl font-bold mb-2 ${
                  report.passed ? 'text-green-400' : 'text-red-400'
                }`}>
                  {report.passed ? '🎉 通关成功！' : '💔 未能通关'}
                </div>
                <p className="text-gray-300">{report.summary}</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-yellow-400 font-mono">
                  {report.score.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">最终得分</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: '游戏时长', value: report.playTime },
              { label: '处理总数', value: report.totalBaggage },
              { label: '正确分拣', value: report.correctCount, color: 'text-green-400' },
              { label: '分拣错误', value: report.errorCount, color: 'text-red-400' },
              { label: '准确率', value: `${report.accuracy}%` },
              { label: '开始时间', value: report.startTime, className: 'col-span-2' },
            ].map((item, i) => (
              <div key={i} className={`bg-gray-800/50 rounded-lg p-3 border border-gray-700 ${item.className || ''}`}>
                <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                <div className={`text-lg font-bold font-mono ${item.color || 'text-white'}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
              <h3 className="font-bold text-white mb-4">按行李类型统计</h3>
              <div className="space-y-3">
                {Object.entries(report.byType).map(([type, data]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-gray-300 text-sm w-20">
                      {type === 'normal' ? '普通行李' : type === 'transfer' ? '转机行李' : '超规行李'}
                    </span>
                    <div className="flex-1 h-6 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${data.total > 0 ? (data.total / report.totalBaggage) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-gray-300 w-24 text-right">
                      {data.correct}/{data.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
              <h3 className="font-bold text-white mb-4">按航班口统计</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(report.byGate).map(([gate, data]) => (
                  <div key={gate} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 font-mono">{gate}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-mono">{data.correct}✓</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-red-400 font-mono">{data.error}✗</span>
                      <span className="text-gray-500 font-mono">({data.total})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {report.errors.length > 0 && (
            <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700 mb-6">
              <h3 className="font-bold text-red-400 mb-4">错误明细 ({report.errors.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {report.errors.map((err, i) => (
                  <div key={i} className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">游戏时间: {err.time}</span>
                      <span className="text-xs font-medium text-red-400">{err.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 text-sm">{err.flight}</span>
                      <span className="text-gray-300 text-sm">{err.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm"
            >
              <FileJson className="w-4 h-4" />
              导出 JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              导出 CSV
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReplay}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-white font-medium"
            >
              <Play className="w-4 h-4" />
              观看回放
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
