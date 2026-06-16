import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileJson, FileSpreadsheet, FileText, ArrowLeft,
  AlertTriangle, CheckCircle, Download, Info
} from 'lucide-react';
import { useAnalysisStore, calculateStatistics } from '../store/analysisStore';
import { exportToJSON, exportToCSV, exportToHTML, downloadHTMLReport, ExportReport } from '../utils/export';

const ExportPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAnalysisStore();
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const dataPoints = useMemo(() => session?.dataPoints ?? [], [session?.dataPoints]);
  const stats = useMemo(() => calculateStatistics(dataPoints), [dataPoints]);

  const report: ExportReport = useMemo(() => ({
    title: session?.name ?? '',
    exportedAt: Date.now(),
    metadata: session?.metadata ?? { source: '', processedAt: 0, processor: '', remarks: '' },
    anomalyConfig: session?.anomalyConfig ?? { method: 'iqr' as const, iqrMultiplier: 1.5, zscoreThreshold: 3.0 },
    statistics: stats,
    dataPoints,
    supplementaryNote: session?.metadata?.supplementaryNote,
    hasSupplementaryNote: session?.hasSupplementaryNote ?? false,
    dataBeforeSupplementary: session?.dataBeforeSupplementary
  }), [session, stats, dataPoints]);

  if (!session || session.dataPoints.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">暂无数据</h2>
        <p className="text-slate-600 mb-6">请先导入数据后再导出报告</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回导入页面
        </button>
      </div>
    );
  }

  const handleExportJSON = () => {
    setExportingFormat('json');
    setTimeout(() => {
      exportToJSON(report);
      setExportingFormat(null);
    }, 500);
  };

  const handleExportCSV = () => {
    setExportingFormat('csv');
    setTimeout(() => {
      exportToCSV(session.dataPoints);
      setExportingFormat(null);
    }, 500);
  };

  const handleExportHTML = () => {
    setExportingFormat('html');
    setTimeout(() => {
      const html = exportToHTML(report);
      downloadHTMLReport(html);
      setExportingFormat(null);
    }, 500);
  };

  const formatDateTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN');
  };

  const beforeAnomalyCount = session.dataBeforeSupplementary?.filter(p => p.isAnomaly).length || 0;
  const afterAnomalyCount = stats.anomalyCount;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/analysis')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📦 导出报告</h1>
          <p className="text-sm text-slate-500">{session.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              报告预览
            </h2>

            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="font-medium text-slate-800 mb-2">📋 基本信息</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">数据来源：</span>
                    <span className="text-slate-800">{session.metadata.source}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">处理人：</span>
                    <span className="text-slate-800">{session.metadata.processor}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">处理时间：</span>
                    <span className="text-slate-800">{formatDateTime(session.metadata.processedAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">导出时间：</span>
                    <span className="text-slate-800">{formatDateTime(Date.now())}</span>
                  </div>
                </div>
                {session.metadata.remarks && (
                  <div className="mt-2">
                    <span className="text-slate-500 text-sm">备注：</span>
                    <span className="text-slate-800 text-sm">{session.metadata.remarks}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats.totalCount}</p>
                  <p className="text-xs text-slate-500">数据总数</p>
                </div>
                <div className={`text-center p-4 rounded-lg ${stats.anomalyCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className={`text-2xl font-bold ${stats.anomalyCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.anomalyCount}
                  </p>
                  <p className="text-xs text-slate-500">异常数量</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-600">{stats.maxValue.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">最大值 (N)</p>
                </div>
              </div>

              {stats.anomalyPoints.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-800 mb-3">⚠️ 异常点详情</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="px-3 py-2 text-left">时间</th>
                          <th className="px-3 py-2 text-left">离心力(N)</th>
                          <th className="px-3 py-2 text-left">异常原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.anomalyPoints.slice(0, 5).map((point) => (
                          <tr key={point.id} className="border-t border-slate-100 bg-red-50">
                            <td className="px-3 py-2">{point.timeLabel}</td>
                            <td className="px-3 py-2 font-bold text-red-600">{point.centrifugalForce}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{point.anomalyReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {stats.anomalyPoints.length > 5 && (
                    <p className="text-xs text-slate-500 mt-2">还有 {stats.anomalyPoints.length - 5} 个异常点未显示...</p>
                  )}
                </div>
              )}

              {session.hasSupplementaryNote && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h3 className="font-medium text-amber-800 mb-2">📝 补录备注</h3>
                  <p className="text-sm text-amber-700">{session.metadata.supplementaryNote}</p>
                  {session.dataBeforeSupplementary && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <p className="text-sm text-amber-800">
                        <strong>补录前后对比：</strong>
                        补录前 {beforeAnomalyCount} 个异常 → 补录后 {afterAnomalyCount} 个异常
                        {beforeAnomalyCount === afterAnomalyCount && (
                          <span className="block text-xs mt-1">
                            （注：补录备注仅用于记录说明，不影响异常检测算法结果）
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">🔧 检测配置</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>
                    <strong>检测方法：</strong>
                    {session.anomalyConfig.method === 'iqr' ? 'IQR 四分位距法' : 
                     session.anomalyConfig.method === 'zscore' ? 'Z-Score 法' : '手动阈值'}
                  </p>
                  {session.anomalyConfig.method === 'iqr' && (
                    <p><strong>IQR 乘数：</strong>{session.anomalyConfig.iqrMultiplier}</p>
                  )}
                  {session.anomalyConfig.method === 'zscore' && (
                    <p><strong>Z-Score 阈值：</strong>{session.anomalyConfig.zscoreThreshold}</p>
                  )}
                  {session.anomalyConfig.method === 'threshold' && session.anomalyConfig.manualThreshold && (
                    <p>
                      <strong>阈值范围：</strong>
                      {session.anomalyConfig.manualThreshold.min} - {session.anomalyConfig.manualThreshold.max} N
                    </p>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  <Info className="w-3 h-3 inline mr-1" />
                  导出的报告将包含完整的判定依据，便于后续复核
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">选择导出格式</h2>
            
            <div className="space-y-3">
              <button
                onClick={handleExportHTML}
                disabled={exportingFormat !== null}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {exportingFormat === 'html' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                <div className="text-left">
                  <p className="font-medium">HTML 报告</p>
                  <p className="text-xs text-blue-100">完整报告，可打印</p>
                </div>
                <Download className="w-4 h-4 ml-auto" />
              </button>

              <button
                onClick={handleExportCSV}
                disabled={exportingFormat !== null}
                className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                {exportingFormat === 'csv' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                )}
                <div className="text-left">
                  <p className="font-medium text-slate-800">CSV 数据</p>
                  <p className="text-xs text-slate-500">数据表，Excel兼容</p>
                </div>
              </button>

              <button
                onClick={handleExportJSON}
                disabled={exportingFormat !== null}
                className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                {exportingFormat === 'json' ? (
                  <CheckCircle className="w-5 h-5 text-purple-500" />
                ) : (
                  <FileJson className="w-5 h-5 text-slate-400" />
                )}
                <div className="text-left">
                  <p className="font-medium text-slate-800">JSON 原始数据</p>
                  <p className="text-xs text-slate-500">完整数据，便于程序处理</p>
                </div>
              </button>
            </div>

            <div className="mt-6 p-4 bg-amber-50 rounded-lg">
              <h4 className="font-medium text-amber-800 text-sm mb-2">💡 交接提示</h4>
              <p className="text-xs text-amber-700">
                导出的 HTML 报告包含完整的原始数据、检测配置和异常原因。
                接手人员无需再问"这条为什么这么判"，所有信息都在报告中。
              </p>
            </div>

            {exportingFormat && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                <p className="text-sm text-green-700">导出成功！</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
