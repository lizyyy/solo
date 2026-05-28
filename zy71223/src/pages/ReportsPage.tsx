import { useEffect, useState } from 'react';
import { useVoucherStore } from '../store/voucherStore';
import { formatMoney, formatDate, formatDateTime } from '../components/Layout';
import { FileBarChart, Plus, Download, AlertTriangle, CheckCircle, Clock, FileText, Link2 } from 'lucide-react';

export default function ReportsPage() {
  const { reports, vouchers, fetchReports, fetchVouchers, generateReport, exportReport, loading, error, clearError } = useVoucherStore();
  const [period, setPeriod] = useState('2026-05');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
    fetchVouchers();
  }, [fetchReports, fetchVouchers]);

  const handleGenerate = async () => {
    await generateReport(period, '张会计');
  };

  const handleExport = async (reportId: string, format: 'csv' | 'xlsx') => {
    await exportReport(reportId, format, '张会计');
  };

  const exceptionCount = vouchers.filter(v => v.status === 'exception').length;
  const completedCount = vouchers.filter(v => v.status === 'completed').length;
  const reviewingCount = vouchers.filter(v => v.status === 'reviewing').length;

  const selectedReportData = reports.find(r => r.id === selectedReport);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">整理报告</h2>
          <p className="text-gray-500 text-sm mt-1">生成期间整理报告，导出可追溯凭证数据</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            生成报告
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
          <button onClick={clearError} className="text-sm hover:underline">关闭</button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">凭证总数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{vouchers.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <FileText size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">已完成</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{completedCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <CheckCircle size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">待审核</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{reviewingCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
              <Clock size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">异常凭证</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{exceptionCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 text-red-600">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <FileBarChart size={18} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900">报告列表</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-400">加载中...</div>
              ) : reports.length === 0 ? (
                <div className="p-8 text-center text-gray-400">暂无报告，点击上方按钮生成</div>
              ) : (
                reports.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReport(r.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedReport === r.id ? 'bg-primary-50 border-l-4 border-l-primary-600' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{r.period} 整理报告</p>
                        <p className="text-xs text-gray-500 mt-1">{r.totalVouchers} 张凭证 · {r.totalAmount ? formatMoney(r.totalAmount) : '-'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleExport(r.id, 'csv'); }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                          title="导出CSV"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-green-600">{r.completedVouchers} 已完成</span>
                      {r.exceptionVouchers > 0 && (
                        <span className="text-xs text-red-600">{r.exceptionVouchers} 异常</span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          {!selectedReportData ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <FileBarChart size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">选择左侧报告查看详情</p>
              <p className="text-gray-400 text-sm mt-1">或点击上方按钮生成新报告</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedReportData.period} 现金凭证整理报告
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    生成时间：{formatDateTime(selectedReportData.createdAt)} · 操作员：{selectedReportData.generatedBy}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport(selectedReportData.id, 'csv')}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Download size={14} />
                    导出 CSV
                  </button>
                  <button
                    onClick={() => handleExport(selectedReportData.id, 'xlsx')}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Download size={14} />
                    导出 Excel
                  </button>
                </div>
              </div>

              <div className="p-5 border-b border-gray-100">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{selectedReportData.totalVouchers}</p>
                    <p className="text-xs text-gray-500 mt-1">凭证总数</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{selectedReportData.completedVouchers}</p>
                    <p className="text-xs text-gray-500 mt-1">已完成</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{selectedReportData.reviewingVouchers}</p>
                    <p className="text-xs text-gray-500 mt-1">待审核</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{selectedReportData.exceptionVouchers}</p>
                    <p className="text-xs text-gray-500 mt-1">异常</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">本期总金额：</span>
                    {selectedReportData.totalAmount ? formatMoney(selectedReportData.totalAmount) : '-'}
                  </p>
                </div>
              </div>

              <div className="p-5">
                <h4 className="font-medium text-gray-900 mb-3">凭证明细</h4>
                <div className="overflow-x-auto max-h-96 overflow-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">凭证号</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">客户</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">摘要</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">金额</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">状态</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">追溯</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedReportData.items?.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 font-mono text-sm text-gray-700">{item.voucherNo}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.customerName}</td>
                          <td className="px-3 py-2 text-sm text-gray-600">{formatDate(item.date)}</td>
                          <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">{item.description}</td>
                          <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900">
                            {formatMoney(item.amount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              item.status === 'completed' ? 'bg-green-100 text-green-700' :
                              item.status === 'exception' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {item.status === 'completed' ? '已完成' :
                               item.status === 'exception' ? '异常' : '待审核'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center gap-1 text-xs text-primary-600">
                              <Link2 size={12} />
                              {item.voucherId?.slice(-8)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
