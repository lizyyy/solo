import { useState } from 'react';
import { Download, FilePlus, AlertCircle, Package, User, Clock, MapPin, AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import * as XLSX from 'xlsx';
import type { SafetyReport } from '@/types';

export default function ReportPage() {
  const [showPendingAlert, setShowPendingAlert] = useState(false);

  const {
    rangefinderRecords,
    safetyReports,
    generateSafetyReport,
    getReviewForRecord,
  } = useAppStore();

  const uniqueRecords = rangefinderRecords.filter(
    (r, i, arr) =>
      arr.findIndex((x) => x.batchNo === r.batchNo && x.pointX === r.pointX && x.pointY === r.pointY) === i
  );

  const recordsNeedingReport = uniqueRecords.filter(
    (r) => r.distance < 1.2 || r.alarmOccluded
  );

  const hasPendingReviews = recordsNeedingReport.some(
    (r) => r.alarmOccluded && getReviewForRecord(r.id)?.reviewStatus === 'pending'
  );

  const getReportForRecord = (recordId: string) => {
    return safetyReports.find((r) => r.recordId === recordId);
  };

  const handleGenerateReport = (recordId: string) => {
    const review = getReviewForRecord(recordId);
    if (review?.reviewStatus === 'pending') {
      setShowPendingAlert(true);
      return;
    }
    generateSafetyReport(recordId);
  };

  const handleBatchGenerate = () => {
    if (hasPendingReviews) {
      setShowPendingAlert(true);
      return;
    }
    recordsNeedingReport.forEach((r) => {
      const review = getReviewForRecord(r.id);
      if (!r.alarmOccluded || review?.reviewStatus !== 'pending') {
        generateSafetyReport(r.id);
      }
    });
  };

  const handleExport = () => {
    const exportData = safetyReports.map((report) => {
      const record = rangefinderRecords.find((r) => r.id === report.recordId);
      return {
        '报告ID': report.id,
        '测距点': record ? `(${record.pointX}, ${record.pointY})` : '',
        '批次号': record?.batchNo || '',
        '为什么留下': report.reason,
        '缺什么材料': report.missingMaterials.join('、'),
        '下一步找谁': report.nextStep,
        '责任人': report.nextOwner === 'manager' ? '施工经理' : '园区运维',
        '状态': report.status === 'draft' ? '草稿' : report.status === 'confirmed' ? '已确认' : '已导出',
        '创建时间': report.createdAt.slice(0, 16).replace('T', ' '),
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '安全距离报告');
    XLSX.writeFile(wb, `安全距离报告_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getStatusBadge = (status: SafetyReport['status']) => {
    switch (status) {
      case 'draft':
        return <StatusBadge status="pending" />;
      case 'confirmed':
        return <StatusBadge status="completed" />;
      case 'exported':
        return <StatusBadge status="completed" />;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900 mb-2">安全距离报告</h1>
          <p className="text-gray-500">生成和管理安全距离告警报告</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleBatchGenerate}
            className="px-4 py-2 bg-industrial-500 text-white text-sm font-medium rounded hover:bg-industrial-600 transition-colors flex items-center gap-2"
          >
            <FilePlus className="w-4 h-4" />
            批量生成报告
          </button>
          <button
            onClick={handleExport}
            disabled={safetyReports.length === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>
      </div>

      {hasPendingReviews && (
        <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-800">
              存在待复核的告警记录，请先由施工经理复核后再生成报告
            </p>
            <p className="text-xs text-warning-600 mt-1">
              未复核的记录将无法生成正式报告
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {recordsNeedingReport.length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
            <FilePlus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无需要生成报告的记录</p>
          </div>
        ) : (
          recordsNeedingReport.map((record) => {
            const report = getReportForRecord(record.id);
            const review = getReviewForRecord(record.id);
            const isPending = record.alarmOccluded && review?.reviewStatus === 'pending';

            return (
              <div key={record.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-industrial-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      测距点 ({record.pointX}, {record.pointY})
                    </span>
                    <span className="text-xs text-gray-500">{record.batchNo}</span>
                    {report && getStatusBadge(report.status)}
                  </div>
                  <div className="flex items-center gap-3">
                    {report && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {report.createdAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    )}
                    <button
                      onClick={() => handleGenerateReport(record.id)}
                      disabled={isPending}
                      className="px-4 py-1.5 text-sm font-medium rounded bg-success-500 text-white hover:bg-success-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {report ? '重新生成' : '生成报告'}
                    </button>
                  </div>
                </div>

                {isPending ? (
                  <div className="p-8 text-center text-gray-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-warning-400" />
                    <p className="text-sm">请先由施工经理复核此记录</p>
                  </div>
                ) : report ? (
                  <div className="divide-y divide-gray-100">
                    <div className="p-4 bg-red-50">
                      <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">!</span>
                        为什么留下
                      </h4>
                      <p className="text-sm text-red-700">{report.reason}</p>
                    </div>
                    <div className="p-4 bg-yellow-50">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs">
                          <Package className="w-3 h-3" />
                        </span>
                        缺什么材料
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {report.missingMaterials.map((m, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50">
                      <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                          <User className="w-3 h-3" />
                        </span>
                        下一步找谁
                      </h4>
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">
                          {report.nextOwner === 'manager' ? '施工经理' : '园区运维'}：
                        </span>
                        {report.nextStep}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <FilePlus className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">点击上方按钮生成安全距离报告</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showPendingAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-warning-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning-500" />
              </div>
              <div>
                <h3 className="font-semibold text-industrial-900">无法生成报告</h3>
                <p className="text-sm text-gray-500">存在待复核的告警记录</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              截图遮挡告警标签的记录必须先由施工经理复核确认后，才能生成安全距离报告。请前往告警复核页面完成复核操作。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPendingAlert(false)}
                className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                知道了
              </button>
              <button
                onClick={() => setShowPendingAlert(false)}
                className="flex-1 px-4 py-2 text-sm text-white bg-industrial-500 rounded-lg hover:bg-industrial-600 transition-colors"
              >
                前往复核
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
