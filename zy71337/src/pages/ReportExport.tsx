import React, { useState } from 'react';
import { FileText, Download, Copy, Check, FileJson, File as FilePdf } from 'lucide-react';
import { useAppStore } from '@/store';
import ScoreDisplay from '@/components/ScoreDisplay';

const ReportExport: React.FC = () => {
  const { results, params } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'pdf'>('json');

  const generateReportData = () => {
    return {
      title: '旋律相似度检索报告',
      generatedAt: new Date().toISOString(),
      parameters: params,
      summary: {
        totalComparisons: results.length,
        matchesFound: results.filter((r) => r.matched).length,
        averageScore:
          results.length > 0
            ? results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length
            : 0,
        highestScore: results.length > 0 ? Math.max(...results.map((r) => r.scores.overall)) : 0,
      },
      results: results.map((r) => ({
        id: r.id,
        targetWork: {
          title: r.targetWork.title,
          studentName: r.targetWork.studentName,
          keySignature: r.targetWork.keySignature,
          tags: r.targetWork.tags,
          remarks: r.targetWork.remarks,
        },
        scores: {
          overall: r.scores.overall,
          contour: r.scores.contour.normalized,
          rhythm: r.scores.rhythm.normalized,
        },
        calculationDetails: {
          contourEncoding: r.calculationDetails.contourEncoding,
          dtwDistance: r.calculationDetails.similarityCalc.contourDTW.distance,
          editDistance: r.calculationDetails.similarityCalc.rhythmEdit.distance,
          timeStretch: r.timeStretch,
        },
      })),
    };
  };

  const handleExportJSON = () => {
    const reportData = generateReportData();
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `melody-similarity-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    const reportData = generateReportData();
    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="font-display text-xl font-bold text-white mb-1">报告导出</h2>
        <p className="text-sm text-slate-400">生成并导出旋律相似度检索报告，保留完整计算过程</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                报告摘要
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExportFormat('json')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-all ${
                    exportFormat === 'json'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  <FileJson className="w-3 h-3" />
                  JSON
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-all ${
                    exportFormat === 'pdf'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  <FilePdf className="w-3 h-3" />
                  PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-white">{results.length}</div>
                <div className="text-xs text-slate-500">总比较数</div>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-amber-400">
                  {results.filter((r) => r.matched).length}
                </div>
                <div className="text-xs text-slate-500">匹配数</div>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {results.length > 0
                    ? (
                        (results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length) *
                        100
                      ).toFixed(1) + '%'
                    : '-'}
                </div>
                <div className="text-xs text-slate-500">平均得分</div>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-rose-400">
                  {results.length > 0
                    ? (Math.max(...results.map((r) => r.scores.overall)) * 100).toFixed(1) + '%'
                    : '-'}
                </div>
                <div className="text-xs text-slate-500">最高得分</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">检索参数</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-slate-500">轮廓权重:</span>{' '}
                <span className="text-slate-300">{(params.contourWeight * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-500">节奏权重:</span>{' '}
                <span className="text-slate-300">{(params.rhythmWeight * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-500">最低分数:</span>{' '}
                <span className="text-slate-300">{(params.minMatchScore * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-500">移调容错:</span>{' '}
                <span className="text-slate-300">±{params.transpositionTolerance} 半音</span>
              </div>
              <div>
                <span className="text-slate-500">拉伸阈值:</span>{' '}
                <span className="text-slate-300">±{(params.stretchThreshold * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-500">返回结果:</span>{' '}
                <span className="text-slate-300">最多 {params.maxResults} 条</span>
              </div>
            </div>
          </div>

          {results.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200">匹配结果明细</h3>
              </div>
              <div className="divide-y divide-slate-700">
                {results.slice(0, 5).map((result, index) => (
                  <div key={result.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          result.scores.overall >= 0.9
                            ? 'bg-rose-500/20 text-rose-400'
                            : result.scores.overall >= 0.75
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-600 text-slate-400'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-200">
                          {result.targetWork.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {result.targetWork.studentName} · {result.targetWork.keySignature}
                        </div>
                        <div className="mt-3">
                          <ScoreDisplay scores={result.scores} />
                        </div>
                        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                          <div className="text-xs text-slate-500 mb-2">计算过程留存</div>
                          <code className="text-xs text-slate-400 block space-y-1">
                            <div>
                              轮廓编码: {result.calculationDetails.contourEncoding.output}
                            </div>
                            <div>
                              DTW距离: {result.calculationDetails.similarityCalc.contourDTW.distance.toFixed(2)} →
                              归一化: {(result.scores.contour.normalized * 100).toFixed(1)}%
                            </div>
                            <div>
                              编辑距离: {result.calculationDetails.similarityCalc.rhythmEdit.distance} →
                              归一化: {(result.scores.rhythm.normalized * 100).toFixed(1)}%
                            </div>
                            <div className="text-amber-400 mt-1">
                              综合得分 = {(result.scores.contour.normalized).toFixed(3)} × {result.scores.contour.weight.toFixed(2)} +{' '}
                              {(result.scores.rhythm.normalized).toFixed(3)} × {result.scores.rhythm.weight.toFixed(2)} = {result.scores.overall.toFixed(3)}
                            </div>
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={handleCopyJSON}
              disabled={results.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  复制 JSON
                </>
              )}
            </button>
            <button
              onClick={handleExportJSON}
              disabled={results.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportExport;
