import { useState } from 'react';
import { useAppStore } from '@/store';
import { exportReportToExcel, exportReportToPDF } from '@/utils/exportUtils';
import type { ReportStatus } from '@/types';

export default function ReportCenter() {
  const { reports, bonds, curves, updateReportStatus, addHandoverRecord, deleteReport } = useAppStore();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: 'PENDING_CONFIRM' as ReportStatus, remark: '' });
  const [handoverForm, setHandoverForm] = useState({ fromUser: '', toUser: '', message: '' });

  const handleExportExcel = (reportId: string) => {
    const report = reports.find((r) => r.id === reportId);
    const bond = bonds.find((b) => b.id === report?.bondId);
    const curve = curves.find((c) => c.id === report?.curveId);
    if (report && bond && curve) {
      exportReportToExcel(report, bond, curve);
    }
  };

  const handleExportPDF = (reportId: string) => {
    const report = reports.find((r) => r.id === reportId);
    const bond = bonds.find((b) => b.id === report?.bondId);
    const curve = curves.find((c) => c.id === report?.curveId);
    if (report && bond && curve) {
      exportReportToPDF(report, bond, curve);
    }
  };

  const handleStatusSubmit = () => {
    if (selectedReport) {
      updateReportStatus(selectedReport, statusForm.status, statusForm.remark);
      setShowStatusModal(false);
    }
  };

  const handleHandoverSubmit = () => {
    if (selectedReport) {
      addHandoverRecord(selectedReport, handoverForm.fromUser, handoverForm.toUser, handoverForm.message);
      setShowHandoverModal(false);
      setHandoverForm({ fromUser: '', toUser: '', message: '' });
    }
  };

  const getStatusLabel = (status: ReportStatus) => {
    switch (status) {
      case 'PROCESSED': return '已处理';
      case 'PENDING_CONFIRM': return '待确认';
      case 'RETURNED': return '已退回';
    }
  };

  const getStatusClass = (status: ReportStatus) => {
    switch (status) {
      case 'PROCESSED': return 'status-processed';
      case 'PENDING_CONFIRM': return 'status-pending';
      case 'RETURNED': return 'status-returned';
    }
  };

  const selectedReportData = reports.find((r) => r.id === selectedReport);
  const selectedBondData = bonds.find((b) => b.id === selectedReportData?.bondId);
  const selectedCurveData = curves.find((c) => c.id === selectedReportData?.curveId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-navy-800">报告中心</h1>
          <p className="mt-1 text-navy-500 text-sm">管理分析报告，标记状态，导出和交接</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-navy-500 text-sm">已处理</p>
              <p className="mt-1 text-2xl font-bold text-green-600 font-serif">
                {reports.filter((r) => r.status === 'PROCESSED').length}
              </p>
            </div>
            <span className="text-2xl">✅</span>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-navy-500 text-sm">待确认</p>
              <p className="mt-1 text-2xl font-bold text-yellow-600 font-serif">
                {reports.filter((r) => r.status === 'PENDING_CONFIRM').length}
              </p>
            </div>
            <span className="text-2xl">⏳</span>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-navy-500 text-sm">已退回</p>
              <p className="mt-1 text-2xl font-bold text-red-600 font-serif">
                {reports.filter((r) => r.status === 'RETURNED').length}
              </p>
            </div>
            <span className="text-2xl">🔄</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="card col-span-1">
          <div className="card-header">
            <h3 className="font-serif font-semibold text-navy-800">报告列表</h3>
          </div>
          <div className="card-body p-0 max-h-[600px] overflow-auto">
            {reports.length === 0 ? (
              <div className="py-8 text-center text-navy-400 text-sm">
                暂无报告，请先进行计算分析
              </div>
            ) : (
              <div className="divide-y divide-navy-100">
                {reports.map((report) => {
                  const bond = bonds.find((b) => b.id === report.bondId);
                  return (
                    <div
                      key={report.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedReport === report.id ? 'bg-gold-50 border-l-2 border-gold-500' : 'hover:bg-navy-50'
                      }`}
                      onClick={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-navy-700 text-sm truncate">
                              {bond?.name || '未知债券'}
                            </p>
                            <span className={`status-badge ${getStatusClass(report.status)}`}>
                              {getStatusLabel(report.status)}
                            </span>
                          </div>
                          <p className="text-xs text-navy-500 mt-1">
                            估值日: {report.params.valuationDate}
                          </p>
                          <p className="text-xs text-navy-400 mt-1">
                            创建于: {report.createdAt.split('T')[0]}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card col-span-2">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-serif font-semibold text-navy-800">
              {selectedReportData ? '报告详情' : '选择报告查看详情'}
            </h3>
            {selectedReportData && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportExcel(selectedReportData.id)}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  导出Excel
                </button>
                <button
                  onClick={() => handleExportPDF(selectedReportData.id)}
                  className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  导出PDF
                </button>
                <button
                  onClick={() => {
                    setShowStatusModal(true);
                    setStatusForm({ status: selectedReportData.status, remark: selectedReportData.statusRemark || '' });
                  }}
                  className="text-xs px-3 py-1 bg-navy-600 text-white rounded hover:bg-navy-700"
                >
                  标记状态
                </button>
                <button
                  onClick={() => setShowHandoverModal(true)}
                  className="text-xs px-3 py-1 bg-gold-500 text-white rounded hover:bg-gold-600"
                >
                  交接
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要删除此报告吗？')) {
                      deleteReport(selectedReportData.id);
                      setSelectedReport(null);
                    }
                  }}
                  className="text-xs px-3 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            )}
          </div>
          <div className="card-body max-h-[550px] overflow-auto">
            {selectedReportData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-navy-700 mb-3 border-b pb-2">基本信息</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-navy-500">债券名称:</span>
                        <span className="text-navy-700">{selectedBondData?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">债券代码:</span>
                        <span className="text-navy-700 font-mono">{selectedBondData?.code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">收益率曲线:</span>
                        <span className="text-navy-700">{selectedCurveData?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">估值日:</span>
                        <span className="text-navy-700">{selectedReportData.params.valuationDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">债券版本:</span>
                        <span className="text-navy-700">v{selectedReportData.bondVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">曲线版本:</span>
                        <span className="text-navy-700">v{selectedReportData.curveVersion}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-navy-700 mb-3 border-b pb-2">计算结果摘要</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-navy-500">麦考利久期:</span>
                        <span className="text-navy-700 font-mono">{selectedReportData.duration.macaulayDuration.toFixed(4)} 年</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">修正久期:</span>
                        <span className="text-navy-700 font-mono">{selectedReportData.duration.modifiedDuration.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">凸性:</span>
                        <span className="text-navy-700 font-mono">{selectedReportData.convexity.convexity.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">DV01:</span>
                        <span className="text-navy-700 font-mono">{selectedReportData.duration.dv01.toFixed(4)} 元/bp</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">基准价格:</span>
                        <span className="text-navy-700 font-mono">{selectedReportData.sensitivity.basePrice.toFixed(4)} 元</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-500">现金流期数:</span>
                        <span className="text-navy-700">{selectedReportData.cashFlows.length} 期</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedReportData.handoverRecord.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-navy-700 mb-3 border-b pb-2">交接记录</h4>
                    <div className="space-y-3">
                      {selectedReportData.handoverRecord.map((record) => (
                        <div key={record.id} className="p-3 bg-navy-50 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-navy-600 font-medium">{record.fromUser}</span>
                              <span className="text-navy-400">→</span>
                              <span className="text-navy-600 font-medium">{record.toUser}</span>
                            </div>
                            <span className="text-xs text-navy-400">
                              {new Date(record.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-2 text-navy-600">{record.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gold-50 rounded border border-gold-200">
                  <h5 className="text-sm font-medium text-gold-700 mb-2">📝 差异解释说明</h5>
                  <p className="text-sm text-gold-600 whitespace-pre-line">
                    {selectedReportData.sensitivity.priceDiffExplanation}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-navy-400 text-sm">
                请从左侧选择一份报告
              </div>
            )}
          </div>
        </div>
      </div>

      {showStatusModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6 animate-fade-in">
            <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">标记报告状态</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-navy-600 mb-1">状态</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value as ReportStatus })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                >
                  <option value="PROCESSED">已处理</option>
                  <option value="PENDING_CONFIRM">待确认</option>
                  <option value="RETURNED">退回补材料</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-navy-600 mb-1">备注</label>
                <textarea
                  value={statusForm.remark}
                  onChange={(e) => setStatusForm({ ...statusForm, remark: e.target.value })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                  rows={3}
                  placeholder="请输入状态变更说明..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowStatusModal(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleStatusSubmit} className="btn-primary">
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showHandoverModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6 animate-fade-in">
            <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">工作交接</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-navy-600 mb-1">移交人</label>
                <input
                  type="text"
                  value={handoverForm.fromUser}
                  onChange={(e) => setHandoverForm({ ...handoverForm, fromUser: e.target.value })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                  placeholder="请输入移交人姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-navy-600 mb-1">接收人</label>
                <input
                  type="text"
                  value={handoverForm.toUser}
                  onChange={(e) => setHandoverForm({ ...handoverForm, toUser: e.target.value })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                  placeholder="请输入接收人姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-navy-600 mb-1">交接说明</label>
                <textarea
                  value={handoverForm.message}
                  onChange={(e) => setHandoverForm({ ...handoverForm, message: e.target.value })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                  rows={3}
                  placeholder="请输入交接说明..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowHandoverModal(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleHandoverSubmit} className="btn-gold">
                确认交接
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
