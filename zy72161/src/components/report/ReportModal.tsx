import React from 'react';
import { X, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useReport } from '@/hooks/useReport';
import { StatusBadge } from '@/components/common/StatusBadge';
import { shelterStatusLabels } from '@/types';

export const ReportModal: React.FC = () => {
  const { showReportModal, closeReportModal } = useUIStore();
  const { reportData, processed, pending, onsite, handleExportPDF, handleExportExcel, handlePrint } = useReport();

  if (!showReportModal) return null;

  const renderShelterList = (shelters: typeof processed, statusClass: string) => (
    <div className="space-y-3">
      {shelters.map((shelter) => (
        <div key={shelter.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{shelter.standardName}</h4>
            <StatusBadge status={shelter.status} size="sm" />
          </div>
          <p className="text-sm text-gray-600">{shelter.naturalLanguageResult}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>设计容量：{shelter.designCapacity}人</span>
            <span>反馈人数：{shelter.reportedCount}人</span>
            <span>利用率：{Math.round((shelter.reportedCount / shelter.designCapacity) * 100)}%</span>
          </div>
          {shelter.aliases.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              居民不同说法：{shelter.aliases.join('、')}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeReportModal} />

      <div className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-700 p-4">
          <div>
            <h2 className="text-lg font-bold text-white">报告预览</h2>
            <p className="text-xs text-gray-400">{reportData.reportPeriod} · 生成于 {reportData.generatedAt}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
            >
              <Printer className="h-4 w-4" />
              打印
            </button>
            <button
              onClick={closeReportModal}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-100">
          <div id="report-content" className="mx-auto max-w-3xl bg-white p-12">
            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              {reportData.reportTitle}
            </h1>
            <p className="mb-8 text-center text-sm text-gray-500">{reportData.reportPeriod}</p>

            <div className="mb-8 rounded-lg bg-blue-50 p-6">
              <h2 className="mb-3 text-lg font-bold text-gray-900">一、总体情况</h2>
              <p className="leading-relaxed text-gray-700">{reportData.summary}</p>
            </div>

            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="h-5 w-1 rounded bg-green-500"></span>
                二、已处理点位（{processed.length}处）
              </h2>
              {processed.length > 0 ? (
                renderShelterList(processed, 'bg-green-500/10 text-green-700 border-green-200')
              ) : (
                <p className="text-sm text-gray-500">暂无已处理点位</p>
              )}
            </div>

            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="h-5 w-1 rounded bg-orange-500"></span>
                三、待核实时点（{pending.length}处）
              </h2>
              {pending.length > 0 ? (
                renderShelterList(pending, 'bg-orange-500/10 text-orange-700 border-orange-200')
              ) : (
                <p className="text-sm text-gray-500">暂无待核实时点</p>
              )}
            </div>

            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="h-5 w-1 rounded bg-red-500"></span>
                四、需现场复看点位（{onsite.length}处）
              </h2>
              {onsite.length > 0 ? (
                renderShelterList(onsite, 'bg-red-500/10 text-red-700 border-red-200')
              ) : (
                <p className="text-sm text-gray-500">暂无需现场复看点位</p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h2 className="mb-4 text-lg font-bold text-gray-900">五、统计汇总</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-600">状态</th>
                    <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-600">数量</th>
                    <th className="border border-gray-200 px-4 py-2 text-right font-medium text-gray-600">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(shelterStatusLabels).map(([status, label]) => {
                    const count = status === 'processed' ? processed.length :
                                  status === 'pending_verify' ? pending.length : onsite.length;
                    const total = processed.length + pending.length + onsite.length;
                    return (
                      <tr key={status}>
                        <td className="border border-gray-200 px-4 py-2">{label}</td>
                        <td className="border border-gray-200 px-4 py-2 text-center font-mono">{count}</td>
                        <td className="border border-gray-200 px-4 py-2 text-right font-mono">
                          {total > 0 ? Math.round((count / total) * 100) : 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 text-right text-xs text-gray-400">
              <p>报告生成时间：{reportData.generatedAt}</p>
              <p>操作人：阿宁（社区运营）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
