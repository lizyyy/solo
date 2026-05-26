import { useState } from 'react';
import type { InspectionReport } from '../game/types';

interface HistoryModalProps {
  reports: InspectionReport[];
  onClose: () => void;
  onViewReport: (report: InspectionReport) => void;
}

export function HistoryModal({ reports, onClose, onViewReport }: HistoryModalProps) {
  const [selectedReport, setSelectedReport] = useState<InspectionReport | null>(null);

  const gradeColors: Record<string, string> = {
    S: 'bg-purple-500',
    A: 'bg-green-500',
    B: 'bg-blue-500',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    F: 'bg-red-500'
  };

  const sortedReports = [...reports].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">历史记录</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">暂无历史记录</p>
              <p className="text-gray-500 text-sm mt-2">完成一局游戏后记录将显示在这里</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedReports.map((report, index) => (
                <div
                  key={index}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full ${gradeColors[report.grade]} flex items-center justify-center`}>
                        <span className="text-xl font-bold text-white">{report.grade}</span>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{report.levelName}</h3>
                        <p className="text-gray-400 text-sm">
                          {new Date(report.timestamp).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-400">{report.score}</p>
                      <p className="text-gray-400 text-sm">
                        发现 {report.foundHazards}/{report.totalHazards}
                      </p>
                    </div>
                  </div>

                  {selectedReport === report && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">{report.duration}s</p>
                          <p className="text-xs text-gray-400">用时</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-400">{report.foundHazards}</p>
                          <p className="text-xs text-gray-400">已发现</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-400">{report.missedHazards}</p>
                          <p className="text-xs text-gray-400">未发现</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-yellow-400">{report.wrongMarks}</p>
                          <p className="text-xs text-gray-400">误报</p>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-3 mb-4">
                        <h4 className="text-gray-300 text-sm mb-2">详细发现</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {report.findings.map((finding, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <span>{finding.found ? '✅' : '❌'}</span>
                              <span className={finding.found ? 'text-green-400' : 'text-red-400'}>
                                {finding.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewReport(report);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
                        >
                          查看完整报告
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
