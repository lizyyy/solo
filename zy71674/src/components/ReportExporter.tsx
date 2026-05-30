import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getDateString, exportReportToJSON, exportReportToText } from '../utils/core';
import { VOICE_PART_LABELS } from '../types';

export function ReportExporter() {
  const { state, dispatch } = useApp();
  const [selectedDate, setSelectedDate] = useState(getDateString());
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [previewReport, setPreviewReport] = useState<string | null>(null);

  const activeVersion = state.standingVersions.find((v) => v.isActive);

  const handleGenerateReport = () => {
    const versionId = selectedVersionId || activeVersion?.id;
    if (!versionId) return;
    dispatch({
      type: 'GENERATE_REPORT',
      payload: { date: selectedDate, standingVersionId: versionId },
    });
  };

  const handleExportJSON = (report: typeof state.reports[0]) => {
    const json = exportReportToJSON(report);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `排练报告_${report.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = (report: typeof state.reports[0]) => {
    const text = exportReportToText(report, state.members);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `排练报告_${report.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreviewText = (report: typeof state.reports[0]) => {
    const text = exportReportToText(report, state.members);
    setPreviewReport(text);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">报告导出</h2>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 border rounded-md"
          />
          <select
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            className="p-2 border rounded-md"
          >
            <option value="">选择站位版本</option>
            {state.standingVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateReport}
            disabled={!activeVersion && !selectedVersionId}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            生成报告
          </button>
        </div>
      </div>

      {state.reports.length === 0 ? (
        <p className="text-gray-500 text-center py-8">暂无已生成的报告，请先选择站位版本并点击"生成报告"</p>
      ) : (
        <div className="space-y-4">
          {state.reports.map((report) => {
            const hashMatch =
              report.dataHash ===
              (() => {
                const str = JSON.stringify({
                  members: state.members,
                  leaveRequests: state.leaveRequests,
                  recommendations: state.substituteRecommendations,
                  standingVersion: report.standingVersion,
                  date: report.date,
                });
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                  const char = str.charCodeAt(i);
                  hash = ((hash << 5) - hash) + char;
                  hash = hash & hash;
                }
                return hash.toString(16);
              })();

            return (
              <div
                key={report.id}
                className={`p-4 border rounded-lg ${hashMatch ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">报告日期: {report.date}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${hashMatch ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                        {hashMatch ? '数据一致 ✓' : '数据已变更 ⚠'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      导出时间: {new Date(report.exportedAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      校验码: {report.dataHash}
                    </p>

                    <div className="mt-3 grid grid-cols-4 gap-4">
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-2xl font-bold text-gray-800">{report.summary.totalMembers}</div>
                        <div className="text-xs text-gray-500">总人数</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-2xl font-bold text-red-600">{report.summary.absentMembers}</div>
                        <div className="text-xs text-gray-500">缺席</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-2xl font-bold text-green-600">{report.summary.presentMembers}</div>
                        <div className="text-xs text-gray-500">出勤</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-2xl font-bold text-blue-600">{report.summary.substitutesUsed}</div>
                        <div className="text-xs text-gray-500">替补</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700">声部平衡:</p>
                      <div className="mt-1 grid grid-cols-4 gap-2">
                        {Object.entries(report.summary.voicePartBalance).map(([part, stats]) => (
                          <div key={part} className="text-sm p-2 bg-white rounded">
                            <div className="font-medium">{VOICE_PART_LABELS[part as keyof typeof VOICE_PART_LABELS]}</div>
                            <div className="text-gray-600">
                              {stats.actual}/{stats.planned} 人
                            </div>
                            <div className="text-gray-500 text-xs">声部长: {stats.leaders}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {report.issues.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-600">
                          问题 ({report.issues.length}):
                        </p>
                        <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
                          {report.issues.slice(0, 3).map((issue) => (
                            <li key={issue.id}>{issue.description}</li>
                          ))}
                          {report.issues.length > 3 && <li>...还有 {report.issues.length - 3} 个问题</li>}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handlePreviewText(report)}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                    >
                      预览
                    </button>
                    <button
                      onClick={() => handleExportText(report)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                      导出TXT
                    </button>
                    <button
                      onClick={() => handleExportJSON(report)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      导出JSON
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">报告预览</h3>
              <button
                onClick={() => setPreviewReport(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                关闭
              </button>
            </div>
            <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded text-sm font-mono">
              {previewReport}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
