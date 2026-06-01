import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Trash2, Eye, ArrowLeft, X } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { formatTimestamp, formatEnergy } from '../utils/formatters';

export function HistoryPage() {
  const navigate = useNavigate();
  const { analysisHistory, loadAnalysis, deleteFromHistory } = useAnalysisStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectedAnalyses = analysisHistory.filter((a) => selectedIds.includes(a.id));

  const handleLoad = (id: string) => {
    const analysis = analysisHistory.find((a) => a.id === id);
    if (analysis) {
      loadAnalysis(analysis);
      navigate('/');
    }
  };

  if (analysisHistory.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-24">
          <History className="h-16 w-16 text-slate-600" />
          <h2 className="mt-6 text-2xl font-bold text-white">暂无历史记录</h2>
          <p className="mt-2 text-slate-400">保存分析结果后将显示在这里</p>
          <button
            onClick={() => navigate('/import')}
            className="mt-8 flex items-center space-x-2 rounded-lg bg-cyan-600 px-6 py-3 text-white hover:bg-cyan-700"
          >
            <span>开始分析</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </button>
            <h1 className="text-2xl font-bold text-white">历史记录与对比</h1>
          </div>
          {selectedIds.length >= 2 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-400">
                已选择 {selectedIds.length} 项进行对比
              </span>
              <button
                onClick={() => setSelectedIds([])}
                className="flex items-center space-x-1 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
                <span>清除选择</span>
              </button>
            </div>
          )}
        </div>

        {selectedIds.length >= 2 && (
          <div className="mb-8 rounded-lg bg-slate-800/50 p-6">
            <h3 className="mb-4 text-lg font-medium text-white">对比分析</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left font-medium text-slate-400">
                      指标
                    </th>
                    {selectedAnalyses.map((analysis) => (
                      <th
                        key={analysis.id}
                        className="px-4 py-3 text-center font-medium text-white"
                      >
                        {analysis.batchName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <td className="px-4 py-3 text-slate-400">分析时间</td>
                    {selectedAnalyses.map((analysis) => (
                      <td key={analysis.id} className="px-4 py-3 text-center text-white">
                        {formatTimestamp(analysis.createdAt)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">样本数量</td>
                    {selectedAnalyses.map((analysis) => (
                      <td key={analysis.id} className="px-4 py-3 text-center text-white">
                        {analysis.summary.totalSamples}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">平均动能</td>
                    {selectedAnalyses.map((analysis) => (
                      <td
                        key={analysis.id}
                        className="px-4 py-3 text-center font-mono text-cyan-400"
                      >
                        {formatEnergy(analysis.summary.avgKineticEnergy)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">平均势能</td>
                    {selectedAnalyses.map((analysis) => (
                      <td
                        key={analysis.id}
                        className="px-4 py-3 text-center font-mono text-purple-400"
                      >
                        {formatEnergy(analysis.summary.avgPotentialEnergy)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">总能量损失</td>
                    {selectedAnalyses.map((analysis) => (
                      <td
                        key={analysis.id}
                        className="px-4 py-3 text-center font-mono text-orange-400"
                      >
                        {formatEnergy(analysis.summary.totalEnergyLoss)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">最高温度</td>
                    {selectedAnalyses.map((analysis) => (
                      <td key={analysis.id} className="px-4 py-3 text-center text-white">
                        {analysis.summary.maxTemperature.toFixed(1)} °C
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">异常数量</td>
                    {selectedAnalyses.map((analysis) => (
                      <td key={analysis.id} className="px-4 py-3 text-center font-bold">
                        {analysis.summary.anomalyCount}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">严重异常</td>
                    {selectedAnalyses.map((analysis) => (
                      <td
                        key={analysis.id}
                        className={`px-4 py-3 text-center ${
                          analysis.summary.criticalAnomalyCount > 0
                            ? 'text-red-400'
                            : 'text-green-400'}`}
                      >
                        {analysis.summary.criticalAnomalyCount}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">分析原因</td>
                    {selectedAnalyses.map((analysis) => (
                      <td key={analysis.id} className="px-4 py-3 text-center text-slate-300">
                        {analysis.analysisReason || '-'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {analysisHistory.map((analysis) => (
            <div
              key={analysis.id}
              className={`rounded-lg bg-slate-800/50 p-6 transition-all ${
                selectedIds.includes(analysis.id)
                  ? 'ring-2 ring-cyan-500'
                  : 'hover:bg-slate-800'}`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">
                    {analysis.batchName}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {formatTimestamp(analysis.createdAt)}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(analysis.id)}
                  onChange={() => toggleSelection(analysis.id)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-cyan-600 focus:ring-cyan-500"
                />
              </div>

              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded bg-slate-700/50 p-2">
                  <p className="text-xs text-slate-400">样本</p>
                  <p className="font-mono text-white">
                    {analysis.summary.totalSamples}
                  </p>
                </div>
                <div className="rounded bg-slate-700/50 p-2">
                  <p className="text-xs text-slate-400">异常</p>
                  <p
                    className={`font-mono ${
                      analysis.summary.anomalyCount > 0
                        ? 'text-orange-400'
                        : 'text-green-400'}`}
                  >
                    {analysis.summary.anomalyCount}
                  </p>
                </div>
                <div className="rounded bg-slate-700/50 p-2">
                  <p className="text-xs text-slate-400">动能</p>
                  <p className="font-mono text-cyan-400">
                    {formatEnergy(analysis.summary.avgKineticEnergy).split(' ')[0]}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => handleLoad(analysis.id)}
                  className="flex items-center space-x-1 rounded-md bg-cyan-600 px-3 py-1.5 text-sm text-white hover:bg-cyan-700"
                >
                  <Eye className="h-4 w-4" />
                  <span>查看</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要删除这条记录吗？')) {
                      deleteFromHistory(analysis.id);
                    }
                  }}
                  className="flex items-center space-x-1 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>删除</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
