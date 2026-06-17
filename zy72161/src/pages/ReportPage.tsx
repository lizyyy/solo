import React from 'react';
import { FileText, Download, FileSpreadsheet, Printer, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { useReport } from '@/hooks/useReport';
import { useShelter } from '@/hooks/useShelter';
import { StatusBadge } from '@/components/common/StatusBadge';
import { shelterStatusLabels, ShelterStatus } from '@/types';

export const ReportPage: React.FC = () => {
  const { reportData, processed, pending, onsite, handleExportPDF, handleExportExcel, handlePrint } = useReport();
  const { shelters } = useShelter();

  const renderShelterCard = (shelter: typeof processed[0]) => (
    <div
      key={shelter.id}
      className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 transition-all hover:border-gray-600 hover:bg-gray-800"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h4 className="font-medium text-white">{shelter.standardName}</h4>
          <p className="text-xs text-gray-400">
            {shelter.aliases.slice(0, 2).join(' / ')}
          </p>
        </div>
        <StatusBadge status={shelter.status} size="sm" />
      </div>
      <p className="text-sm leading-relaxed text-gray-300">{shelter.naturalLanguageResult}</p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg bg-gray-700/30 p-2">
          <p className="text-gray-500">设计容量</p>
          <p className="font-mono text-white">{shelter.designCapacity}人</p>
        </div>
        <div className="rounded-lg bg-gray-700/30 p-2">
          <p className="text-gray-500">反馈人数</p>
          <p className={`font-mono ${shelter.reportedCount > shelter.designCapacity ? 'text-red-400' : 'text-white'}`}>
            {shelter.reportedCount}人
          </p>
        </div>
        <div className="rounded-lg bg-gray-700/30 p-2">
          <p className="text-gray-500">利用率</p>
          <p className={`font-mono ${
            (shelter.reportedCount / shelter.designCapacity) > 1 ? 'text-red-400' :
            (shelter.reportedCount / shelter.designCapacity) > 0.8 ? 'text-orange-400' : 'text-green-400'
          }`}>
            {Math.round((shelter.reportedCount / shelter.designCapacity) * 100)}%
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto bg-gray-900">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">报告中心</h2>
            <p className="mt-1 text-sm text-gray-400">
              按状态分类展示所有点位，支持导出PDF、Excel和打印
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              导出Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              导出PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-blue-700"
            >
              <Printer className="h-4 w-4" />
              打印报告
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-blue-300">总点位</p>
              <div className="rounded-lg bg-blue-500/20 p-2">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{shelters.length}</p>
            <p className="mt-1 text-xs text-blue-400/70">处应急避难场所</p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/20 to-green-600/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-green-300">已处理</p>
              <div className="rounded-lg bg-green-500/20 p-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{processed.length}</p>
            <p className="mt-1 text-xs text-green-400/70">
              {shelters.length > 0 ? Math.round((processed.length / shelters.length) * 100) : 0}% 处理完成率
            </p>
          </div>
          <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-orange-600/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-orange-300">待核实</p>
              <div className="rounded-lg bg-orange-500/20 p-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{pending.length}</p>
            <p className="mt-1 text-xs text-orange-400/70">需要进一步确认</p>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-red-600/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-red-300">需现场复看</p>
              <div className="rounded-lg bg-red-500/20 p-2">
                <Users className="h-5 w-5 text-red-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{onsite.length}</p>
            <p className="mt-1 text-xs text-red-400/70">需工作人员现场确认</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h3 className="mb-3 text-lg font-medium text-white">📊 月度总结</h3>
          <p className="leading-relaxed text-gray-300">{reportData.summary}</p>
        </div>

        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
            <span className="h-5 w-1 rounded bg-green-500"></span>
            已处理点位（{processed.length}处）
          </h3>
          {processed.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {processed.map(renderShelterCard)}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-700 py-8 text-center text-gray-500">
              暂无已处理点位
            </p>
          )}
        </div>

        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
            <span className="h-5 w-1 rounded bg-orange-500"></span>
            待核实时点（{pending.length}处）
          </h3>
          {pending.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {pending.map(renderShelterCard)}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-700 py-8 text-center text-gray-500">
              暂无待核实时点
            </p>
          )}
        </div>

        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
            <span className="h-5 w-1 rounded bg-red-500"></span>
            需现场复看点位（{onsite.length}处）
          </h3>
          {onsite.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {onsite.map(renderShelterCard)}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-700 py-8 text-center text-gray-500">
              暂无需现场复看点位
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h3 className="mb-4 text-lg font-medium text-white">📋 统计汇总表</h3>
          <div className="overflow-hidden rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">状态</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-300">数量</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-300">占比</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {Object.entries(shelterStatusLabels).map(([status, label]) => {
                  const statusKey = status as ShelterStatus;
                  const count = statusKey === ShelterStatus.PROCESSED ? processed.length :
                                statusKey === ShelterStatus.PENDING_VERIFY ? pending.length : onsite.length;
                  const total = shelters.length;
                  return (
                    <tr key={status} className="transition-colors hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <StatusBadge status={statusKey} size="sm" />
                        <span className="ml-2 text-gray-300">{label}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-white">{count}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">
                        {total > 0 ? Math.round((count / total) * 100) : 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div id="report-content" className="hidden">
          <div className="bg-white p-12">
            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              {reportData.reportTitle}
            </h1>
            <p className="mb-8 text-center text-sm text-gray-500">{reportData.reportPeriod}</p>
            <div className="mb-8 rounded-lg bg-blue-50 p-6">
              <h2 className="mb-3 text-lg font-bold text-gray-900">一、总体情况</h2>
              <p className="leading-relaxed text-gray-700">{reportData.summary}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
