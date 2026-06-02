import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, HelpCircle, MapPin, FileSpreadsheet, Copy } from 'lucide-react';
import { getMatchResults } from '@/utils/mergeData';
import { MatchResult, ReviewStatus } from '@/types';
import { exportToExcel, exportByStatus, generateReport, getReviewStatusLabel, getReviewStatusColor } from '@/utils/export';

export default function Export() {
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [reportText, setReportText] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const results = await getMatchResults();
    setMatchResults(results);
    setReportText(generateReport(results));
  }

  const statusCounts: Record<ReviewStatus, number> = {
    pending: matchResults.filter(r => r.mergedRecord.review_status === 'pending').length,
    confirmed: matchResults.filter(r => r.mergedRecord.review_status === 'confirmed').length,
    need_verify: matchResults.filter(r => r.mergedRecord.review_status === 'need_verify').length,
    on_site: matchResults.filter(r => r.mergedRecord.review_status === 'on_site').length,
  };

  async function handleExportAll() {
    setExporting(true);
    try {
      const filename = `城市照明能耗巡检_全部_${new Date().toISOString().slice(0, 10)}`;
      exportToExcel(matchResults, filename, { format: 'xlsx', includeAnomalies: true });
    } catch (error) {
      console.error('导出失败', error);
    }
    setExporting(false);
  }

  async function handleExportByStatus() {
    setExporting(true);
    try {
      const filename = `城市照明能耗巡检_分类_${new Date().toISOString().slice(0, 10)}`;
      exportByStatus(matchResults, filename, true);
    } catch (error) {
      console.error('导出失败', error);
    }
    setExporting(false);
  }

  async function handleExportStatus(status: ReviewStatus) {
    setExporting(true);
    try {
      const statusNames: Record<ReviewStatus, string> = {
        pending: '待复核',
        confirmed: '已处理',
        need_verify: '待核实',
        on_site: '需现场复看'
      };
      const filename = `城市照明能耗巡检_${statusNames[status]}_${new Date().toISOString().slice(0, 10)}`;
      exportToExcel(matchResults, filename, { status, format: 'xlsx', includeAnomalies: true });
    } catch (error) {
      console.error('导出失败', error);
    }
    setExporting(false);
  }

  function copyReport() {
    navigator.clipboard.writeText(reportText);
    alert('报告已复制到剪贴板');
  }

  const exportCards = [
    { status: 'confirmed' as ReviewStatus, label: '已处理', icon: CheckCircle, color: 'bg-green-500 hover:bg-green-600', count: statusCounts.confirmed },
    { status: 'need_verify' as ReviewStatus, label: '待核实', icon: HelpCircle, color: 'bg-yellow-500 hover:bg-yellow-600', count: statusCounts.need_verify },
    { status: 'on_site' as ReviewStatus, label: '需现场复看', icon: MapPin, color: 'bg-red-500 hover:bg-red-600', count: statusCounts.on_site },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">公示导出</h2>
        <p className="text-sm text-gray-500">按处理状态分类导出Excel，生成巡检简报，月底复盘直接用</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm mb-1">总记录数</p>
          <p className="text-2xl font-bold text-gray-800">{matchResults.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
          <p className="text-gray-500 text-sm mb-1">已处理</p>
          <p className="text-2xl font-bold text-green-600">{statusCounts.confirmed}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-yellow-100">
          <p className="text-gray-500 text-sm mb-1">待核实</p>
          <p className="text-2xl font-bold text-yellow-600">{statusCounts.need_verify}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-red-100">
          <p className="text-gray-500 text-sm mb-1">需现场复看</p>
          <p className="text-2xl font-bold text-red-600">{statusCounts.on_site}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">一键导出</h3>
        <div className="flex space-x-4">
          <button
            onClick={handleExportAll}
            disabled={exporting || matchResults.length === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>{exporting ? '导出中...' : '导出全部数据'}</span>
          </button>
          <button
            onClick={handleExportByStatus}
            disabled={exporting || matchResults.length === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>{exporting ? '导出中...' : '分类导出（3个文件）'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">按状态单独导出</h3>
        <p className="text-sm text-gray-500 mb-4">社区公示时可单独导出对应状态的清单</p>
        <div className="grid grid-cols-3 gap-4">
          {exportCards.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.status}
                onClick={() => handleExportStatus(card.status)}
                disabled={exporting || card.count === 0}
                className={`flex flex-col items-center p-6 rounded-lg text-white transition-colors ${card.color} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Icon className="w-8 h-8 mb-2" />
                <span className="font-medium text-lg">{card.label}</span>
                <span className="text-3xl font-bold mt-2">{card.count}</span>
                <span className="text-sm opacity-80 mt-2">点击导出</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">巡检简报</h3>
            <p className="text-sm text-gray-500">月底复盘或汇报时直接使用</p>
          </div>
          <button
            onClick={copyReport}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>复制报告</span>
          </button>
        </div>
        <div className="p-6 bg-gray-50">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-white p-4 rounded-lg border border-gray-200 min-h-64">
            {reportText}
          </pre>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">导出预览</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">路灯编号</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">地址</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">匹配度</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">状态</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">异常数</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">数据源</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matchResults.slice(0, 10).map(result => (
                <tr key={result.mergedRecord.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{result.mergedRecord.lamp_id}</td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-xs">{result.mergedRecord.address}</td>
                  <td className="px-3 py-2 text-gray-600">{result.mergedRecord.match_score.toFixed(0)}%</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getReviewStatusColor(result.mergedRecord.review_status)}`}>
                      {getReviewStatusLabel(result.mergedRecord.review_status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {result.anomalies.length > 0 ? (
                      <span className="text-orange-600 font-medium">{result.anomalies.length}个</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {[
                      result.gisPoint && 'GIS',
                      result.feedback && '反馈',
                      result.inspection && '巡检'
                    ].filter(Boolean).join('/')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {matchResults.length > 10 && (
            <p className="text-center text-xs text-gray-400 mt-2">
              仅显示前10条，共{matchResults.length}条记录
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
