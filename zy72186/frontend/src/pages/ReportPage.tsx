import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ReviewReport, ReviewStatus } from '../types';
import { reportApi } from '../api/client';
import { formatDate, getStatusLabel, getDecisionLabel, getDecisionColor } from '../utils/format';

export default function ReportPage() {
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await reportApi.getReport();
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await reportApi.exportReport();
    } catch (error) {
      console.error('Failed to export:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 mb-4">加载报告失败</p>
        <button onClick={loadReport} className="btn-primary">
          重试
        </button>
      </div>
    );
  }

  const statusColors: Record<ReviewStatus, string> = {
    pending: 'bg-blue-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    conflict: 'bg-orange-500',
    need_review: 'bg-yellow-500',
  };

  const maxStatusCount = Math.max(...report.samplesByStatus.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">复核报告</h2>
          <p className="text-gray-600 mt-1">
            报告生成时间: {formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex space-x-3">
          <Link to="/" className="btn-secondary">
            返回列表
          </Link>
          <button onClick={handleExport} className="btn-primary" disabled={exporting}>
            {exporting ? '导出中...' : '导出报告'}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-primary-100 text-sm">样本总数</p>
            <p className="text-4xl font-bold mt-1">{report.totalSamples}</p>
          </div>
          <div>
            <p className="text-primary-100 text-sm">已完成复核</p>
            <p className="text-4xl font-bold mt-1">{report.approvedCount + report.rejectedCount}</p>
          </div>
          <div>
            <p className="text-primary-100 text-sm">待处理</p>
            <p className="text-4xl font-bold mt-1">
              {report.pendingCount + report.conflictCount + report.needReviewCount}
            </p>
          </div>
          <div>
            <p className="text-primary-100 text-sm">完成率</p>
            <p className="text-4xl font-bold mt-1">
              {report.totalSamples > 0 
                ? Math.round(((report.approvedCount + report.rejectedCount) / report.totalSamples) * 100) 
                : 0}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">按状态分布</h3>
          <div className="space-y-3">
            {report.samplesByStatus.map(item => (
              <div key={item.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{getStatusLabel(item.status)}</span>
                  <span className="text-gray-500">{item.count} 条 ({Math.round(item.count / maxStatusCount * 100)}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${statusColors[item.status]} transition-all`}
                    style={{ width: `${(item.count / maxStatusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">按条款类型分布</h3>
          <div className="space-y-3">
            {report.samplesByClauseType.map(item => (
              <div key={item.clauseType} className="flex justify-between items-center">
                <span className="text-gray-700">{item.clauseType}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500"
                      style={{ width: `${(item.count / report.totalSamples) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">{item.count} 条</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">重复样本</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{report.duplicateCount}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">缺少引用</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{report.missingRefCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">人工改判</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{report.manualOverrideCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">模型导入冲突</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{report.modelImportConflictCount}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">分类明细</h3>
          
          <div className="mb-6">
            <h4 className="font-medium text-green-700 mb-2 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2" />
              模型判断通过 ({report.approvedCount})
            </h4>
            <p className="text-sm text-gray-600">
              模型抽取结果与导入数据一致，且置信度达标，无需人工干预。
            </p>
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-red-700 mb-2 flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2" />
              人工修正 ({report.rejectedCount})
            </h4>
            <p className="text-sm text-gray-600">
              模型抽取结果有误，经人工复核后驳回。包含人工改判记录。
            </p>
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-orange-700 mb-2 flex items-center">
              <span className="w-3 h-3 bg-orange-500 rounded-full mr-2" />
              存在冲突 ({report.conflictCount})
            </h4>
            <p className="text-sm text-gray-600">
              模型输出与导入数据不一致，需要核对原始合同确认正确值。
            </p>
          </div>

          <div>
            <h4 className="font-medium text-yellow-700 mb-2 flex items-center">
              <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
              仍需复核 ({report.needReviewCount})
            </h4>
            <p className="text-sm text-gray-600">
              缺少引用数据、置信度不足或其他问题，需要人工阅读合同后确认。
            </p>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">复核人员统计</h3>
          {report.reviewerStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无复核记录</p>
          ) : (
            <div className="space-y-3">
              {report.reviewerStats.map(stat => (
                <div key={stat.reviewer} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-medium">
                        {stat.reviewer.charAt(0)}
                      </span>
                    </div>
                    <span className="text-gray-900 font-medium">{stat.reviewer}</span>
                  </div>
                  <span className="text-gray-500">{stat.count} 次复核</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">最近复核记录</h3>
        {report.recentReviews.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无复核记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    时间
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    复核人
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    样本ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    结论
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    证据
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report.recentReviews.map(record => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(record.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {record.reviewer}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/sample/${record.sampleId}`}
                        className="text-sm text-primary-600 hover:text-primary-800 font-mono"
                      >
                        {record.sampleId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${getDecisionColor(record.decision)}`}>
                        {getDecisionLabel(record.decision)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {record.evidence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 复核建议</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="flex items-start space-x-2">
            <span className="text-blue-500">•</span>
            <p>建议优先处理 <strong>存在冲突</strong> 的样本，核对原始合同确认正确值</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-500">•</span>
            <p><strong>重复样本</strong> 可一键去重，避免重复复核浪费人力</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-500">•</span>
            <p><strong>缺少引用</strong> 的样本需要人工阅读合同后补充标注</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-500">•</span>
            <p><strong>人工改判</strong> 记录可用于算法团队优化模型表现</p>
          </div>
        </div>
      </div>
    </div>
  );
}
