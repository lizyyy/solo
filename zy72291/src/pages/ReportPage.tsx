import React, { useState } from 'react';
import { FileBarChart, Download, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Info, User, ChevronRight } from 'lucide-react';
import { useWindStore } from '../store/useWindStore';
import { StatusBadge } from '../components/StatusBadge';
import { ComparisonChart } from '../components/ComparisonChart';
import { WindRoseChart } from '../components/WindRoseChart';
import { formatDateTime, directionToLabel } from '../utils/windUtils';
import type { ReportResult } from '../../shared/types';
import { RECORD_TYPE_LABELS, WIND_SPEED_LABELS } from '../../shared/types';

export const ReportPage: React.FC = () => {
  const { report, generateReport, radiusTable, updateLogStatus, currentRole, setCurrentRole } = useWindStore();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewResult, setReviewResult] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [selectedResult, setSelectedResult] = useState<ReportResult | null>(null);

  const handleGenerateReport = () => {
    generateReport();
  };

  const handleReview = (result: ReportResult) => {
    if (currentRole !== 'manager') {
      setCurrentRole('manager');
    }
    setSelectedResult(result);
    setShowReviewModal(true);
  };

  const confirmReview = () => {
    if (selectedResult) {
      if (reviewResult === 'approved') {
        updateLogStatus(selectedResult.recordId, 'success', reviewNote || '施工经理复核通过');
      } else {
        updateLogStatus(selectedResult.recordId, 'blocked', reviewNote || '施工经理复核不通过');
      }
      generateReport();
      setShowReviewModal(false);
      setSelectedResult(null);
      setReviewNote('');
    }
  };

  const getResultColor = (result: ReportResult) => {
    if (result.recordType === 'success') return 'border-l-emerald-500';
    if (result.recordType === 'blocked') return 'border-l-amber-500';
    return 'border-l-blue-500';
  };

  const getResultBg = (result: ReportResult) => {
    if (result.recordType === 'success') return 'bg-emerald-50/50';
    if (result.recordType === 'blocked') return 'bg-amber-50/50';
    return 'bg-blue-50/50';
  };

  const exportReport = () => {
    if (!report) return;
    const content = `
滑翔伞起降区安全距离评估报告
============================
报告编号: ${report.id}
生成时间: ${formatDateTime(report.generatedAt)}
口径版本: ${report.radiusVersion === 'mixed' ? '新旧混合' : report.radiusVersion === 'new' ? '2024新口径' : '2023旧口径'}
报告状态: ${report.status === 'pending_review' ? '待施工经理复核' : report.status}

${report.notes}

三条记录评估结果:
${report.results.map(r => `
  [${RECORD_TYPE_LABELS[r.recordType]}] ${r.recordId}
  风向: ${directionToLabel(r.windDirection)} (${r.windDirection}°) | 风速: ${WIND_SPEED_LABELS[r.windSpeed]}
  实测距离: ${r.safetyDistance}米 | 要求距离: ${r.requiredDistance}米
  合规性: ${r.compliance ? '合规' : '不合规'}
  说明: ${r.note}
`).join('')}

---
设备工程师: 许工
施工经理: ${currentRole === 'manager' ? '已确认' : '待确认'}
    `.trim();
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `安全距离报告-${report.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <FileBarChart size={64} className="text-industrial-300" />
        <p className="text-industrial-500">暂无安全距离报告</p>
        <button onClick={handleGenerateReport} className="btn-primary">
          <RefreshCw size={16} className="mr-2" />
          生成报告
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-industrial-800 font-mono">安全距离报告</h2>
          <p className="text-sm text-industrial-500 mt-1">根据点云抽稀日志和安全半径表生成的滑翔伞起降区安全距离评估报告</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateReport}
            className="btn-industrial text-sm flex items-center gap-2"
          >
            <RefreshCw size={16} />
            更新报告
          </button>
          <button
            onClick={exportReport}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Download size={16} />
            导出报告
          </button>
        </div>
      </div>

      {/* 报告概览卡片 */}
      <div className="card-industrial rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-industrial-500 mb-1">报告编号</p>
            <p className="font-mono text-lg font-semibold text-industrial-800">{report.id}</p>
          </div>
          <div>
            <p className="text-xs text-industrial-500 mb-1">生成时间</p>
            <p className="text-sm text-industrial-800">{formatDateTime(report.generatedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-industrial-500 mb-1">口径版本</p>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              report.radiusVersion === 'mixed' ? 'bg-purple-100 text-purple-700' :
              report.radiusVersion === 'new' ? 'bg-industrial-100 text-industrial-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {report.radiusVersion === 'mixed' ? '新旧混合' : report.radiusVersion === 'new' ? '2024新口径' : '2023旧口径'}
            </span>
          </div>
          <div>
            <p className="text-xs text-industrial-500 mb-1">报告状态</p>
            <StatusBadge 
              status={report.status === 'pending_review' ? 'pending_review' : 'success'} 
              size="md" 
            />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-industrial-100">
          <p className="text-sm text-industrial-600">
            <span className="font-medium">备注:</span> {report.notes}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 - 三种结果对比 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 对比图 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <FileBarChart size={18} />
                三种处理结果安全距离对比
              </h3>
              <p className="text-xs text-industrial-500 mt-1">
                绿色=顺利通过 | 橙色=截图遮挡待复核 | 蓝色=旧口径补录
              </p>
            </div>
            <div className="p-4">
              <ComparisonChart results={report.results} height={320} />
            </div>
          </div>

          {/* 详细结果列表 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800">详细评估结果</h3>
            </div>
            <div className="divide-y divide-industrial-100">
              {report.results.map((result) => (
                <div 
                  key={result.id} 
                  className={`p-5 border-l-4 ${getResultColor(result)} ${getResultBg(result)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={result.recordType} size="md" />
                      <span className="font-mono text-sm text-industrial-500">{result.recordId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.compliance ? (
                        <span className="flex items-center gap-1 text-sm text-emerald-600">
                          <CheckCircle size={16} /> 合规
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-red-600">
                          <XCircle size={16} /> 不合规
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-industrial-500">风向</p>
                      <p className="text-sm font-medium text-industrial-800">
                        {directionToLabel(result.windDirection)} ({result.windDirection}°)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-industrial-500">风速</p>
                      <p className="text-sm font-medium text-industrial-800">
                        {WIND_SPEED_LABELS[result.windSpeed]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-industrial-500">实测距离</p>
                      <p className="font-mono text-lg font-semibold text-industrial-800">
                        {result.safetyDistance}m
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-industrial-500">要求距离</p>
                      <p className="font-mono text-lg font-semibold text-industrial-600">
                        {result.requiredDistance}m
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded border border-industrial-200">
                    <p className="text-sm text-industrial-700">{result.note}</p>
                  </div>

                  {result.recordType === 'blocked' && (
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={14} />
                        <span className="text-sm">此条记录待施工经理复核</span>
                      </div>
                      <button
                        onClick={() => handleReview(result)}
                        className="text-sm px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded flex items-center gap-1 transition-colors"
                      >
                        <User size={12} />
                        {currentRole === 'manager' ? '施工经理复核' : '切换至施工经理复核'}
                      </button>
                    </div>
                  )}

                  {result.recordType === 'legacy' && (
                    <div className="mt-3 flex items-center gap-2 text-blue-700">
                      <Info size={14} />
                      <span className="text-sm">此条记录使用2023旧口径数据补录，注意与新口径的差异</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧 - 风向图和统计 */}
        <div className="space-y-6">
          {/* 风向玫瑰图 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L12 22M2 12L22 12" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                安全半径风向图
              </h3>
            </div>
            <div className="p-2">
              <WindRoseChart radiusTable={radiusTable} height={280} />
            </div>
          </div>

          {/* 合规统计 */}
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800">合规统计</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-industrial-600">总记录数</span>
                <span className="font-mono text-lg font-semibold text-industrial-800">{report.results.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-industrial-600 flex items-center gap-1">
                  <CheckCircle size={14} className="text-emerald-500" /> 合规
                </span>
                <span className="font-mono text-lg font-semibold text-emerald-600">
                  {report.results.filter(r => r.compliance).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-industrial-600 flex items-center gap-1">
                  <XCircle size={14} className="text-red-500" /> 不合规
                </span>
                <span className="font-mono text-lg font-semibold text-red-600">
                  {report.results.filter(r => !r.compliance).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-industrial-600 flex items-center gap-1">
                  <Clock size={14} className="text-amber-500" /> 待复核
                </span>
                <span className="font-mono text-lg font-semibold text-amber-600">
                  {report.results.filter(r => r.recordType === 'blocked').length}
                </span>
              </div>
              <div className="pt-3 border-t border-industrial-100">
                <div className="w-full bg-industrial-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full" 
                    style={{ width: `${(report.results.filter(r => r.compliance).length / report.results.length) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-industrial-500 mt-2 text-center">
                  合规率 {((report.results.filter(r => r.compliance).length / report.results.length) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {/* 交接说明 */}
          <div className="bg-industrial-800 rounded-lg p-5 text-white">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Info size={18} />
              许工给施工经理的说明
            </h3>
            <div className="text-sm space-y-2 text-industrial-200">
              <p>1. <span className="text-emerald-400">LOG-001</span> 是顺利记录，数据完整可直接用</p>
              <p>2. <span className="text-amber-400">LOG-002</span> 告警标签被移动端截图挡住了，我标黄了，请您复核原始热成像数据后再确认</p>
              <p>3. <span className="text-blue-400">LOG-003</span> 是从2023旧口径安全半径表补的历史数据，新旧标准差了20%，我都标清楚了</p>
              <p className="pt-2 border-t border-industrial-700 text-industrial-400 text-xs">
                结论：除LOG-002待您复核外，其余两条处理结果不同，LOG-001合规，LOG-003按旧口径合规按新口径不合规
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 施工经理复核弹窗 */}
      {showReviewModal && selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <User size={18} className="text-amber-500" />
                施工经理复核 - {selectedResult.recordId}
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1 hover:bg-industrial-100 rounded transition-colors"
              >
                <XCircle size={20} className="text-industrial-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="text-sm text-amber-800">
                  <AlertTriangle size={14} className="inline mr-1" />
                  此条记录的告警标签被移动端截图遮挡，请仔细复核原始数据后给出结论
                </p>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-industrial-600 mb-2">记录摘要:</p>
                <div className="text-sm space-y-1">
                  <p>• 类型: {RECORD_TYPE_LABELS[selectedResult.recordType]}</p>
                  <p>• 实测距离: <span className="font-mono">{selectedResult.safetyDistance}米</span></p>
                  <p>• 要求距离: <span className="font-mono">{selectedResult.requiredDistance}米</span></p>
                  <p>• 说明: {selectedResult.note}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-industrial-700 mb-2">复核结论</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReviewResult('approved')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                      reviewResult === 'approved'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-industrial-200 text-industrial-600 hover:border-industrial-300'
                    }`}
                  >
                    <CheckCircle size={18} />
                    通过
                  </button>
                  <button
                    onClick={() => setReviewResult('rejected')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                      reviewResult === 'rejected'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-industrial-200 text-industrial-600 hover:border-industrial-300'
                    }`}
                  >
                    <XCircle size={18} />
                    驳回
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-industrial-700 mb-2">复核意见</label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="请填写复核意见..."
                  className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-4 border-t border-industrial-200 flex justify-end gap-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="btn-industrial text-sm"
              >
                取消
              </button>
              <button
                onClick={confirmReview}
                className={reviewResult === 'approved' ? 'btn-success text-sm' : 'btn-warning text-sm'}
              >
                <CheckCircle size={14} className="mr-1" />
                确认{reviewResult === 'approved' ? '通过' : '驳回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
