import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { generatePointReport, generateBatchReport, downloadReport } from '../utils/reportGen';
import { SignalPoint } from '../types';

export default function ReportView() {
  const { data, addReport } = useAppContext();
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [reportType, setReportType] = useState<'single' | 'batch'>('batch');

  const handleGenerateSingle = () => {
    if (!selectedPointId) return;
    const point = data.points.find(p => p.id === selectedPointId);
    if (!point) return;

    const feedbacks = data.feedbacks.filter(f => f.pointId === selectedPointId);
    const versions = data.planVersions.filter(v => v.pointId === selectedPointId);
    
    const report = generatePointReport(point, feedbacks, versions, data.points);
    addReport(report);
    setGeneratedReport(report.summary + '\n\n' + report.exceptionNote);
  };

  const handleGenerateBatch = () => {
    const report = generateBatchReport(data.points);
    setGeneratedReport(report);
  };

  const handleDownload = () => {
    const filename = `公交优先信号复核报告_${new Date().toISOString().slice(0, 10)}.txt`;
    downloadReport(generatedReport, filename);
  };

  const conflictPoints = data.points.filter(p => p.hasConflict);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">报告中心</h2>
        {generatedReport && (
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          >
            ⬇ 下载报告
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => { setReportType('single'); setGeneratedReport(''); }}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            reportType === 'single'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          单个点位报告
        </button>
        <button
          onClick={() => { setReportType('batch'); setGeneratedReport(''); }}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            reportType === 'batch'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          批量汇总报告
        </button>
      </div>

      {reportType === 'single' ? (
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">选择点位</h3>
          <div className="flex gap-3">
            <select
              value={selectedPointId}
              onChange={(e) => setSelectedPointId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择点位...</option>
              {data.points.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.hasConflict && '(有冲突)'}
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerateSingle}
              disabled={!selectedPointId}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              生成报告
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">汇总报告</h3>
              <p className="text-sm text-slate-500 mt-1">
                包含全部 {data.points.length} 个点位的复核情况
              </p>
            </div>
            <button
              onClick={handleGenerateBatch}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            >
              生成汇总报告
            </button>
          </div>
        </div>
      )}

      {conflictPoints.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 mb-3">
            ⚠️ 例外情况清单（{conflictPoints.length} 项）
          </h3>
          <div className="space-y-2">
            {conflictPoints.map(p => (
              <div
                key={p.id}
                className="p-3 bg-white rounded border border-red-100"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{p.name}</div>
                    <div className="text-sm text-red-600 mt-1">
                      {p.conflictNote || '存在未说明的冲突'}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    p.manualNote ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.manualNote ? '已备注' : '待确认'}
                  </span>
                </div>
                {p.manualNote && (
                  <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                    📝 {p.manualNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {generatedReport && (
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">报告预览</h3>
          <pre className="p-4 bg-slate-50 rounded border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {generatedReport}
          </pre>
        </div>
      )}
    </div>
  );
}
