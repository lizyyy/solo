import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { parseCsvFile } from '../utils/csvParser';
import { useRecordStore } from '../store/useRecordStore';
import { AnnotationRecord } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { AbnormalTypeBadge } from '../components/common/AbnormalTypeBadge';
import { generateSampleCsvContent } from '../utils/mockData';

export default function Import() {
  const { addRecords } = useRecordStore();
  const [isDragging, setIsDragging] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<AnnotationRecord[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setImportResult(null);
    try {
      const records = await parseCsvFile(file);
      setPreviewRecords(records);
    } catch (e) {
      setError('文件解析失败，请检查CSV格式是否正确');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.CSV'))) {
      handleFile(file);
    } else {
      setError('请上传CSV格式的文件');
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleConfirmImport = () => {
    addRecords(previewRecords);
    setImportResult({ success: previewRecords.length, failed: 0 });
    setPreviewRecords([]);
  };

  const handleDownloadSample = () => {
    const content = generateSampleCsvContent();
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = '标注导入示例.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const abnormalCount = previewRecords.filter(r =>
    !r.urlStatus && r.robotJudgment === '通过'
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">标注导入</h1>
          <p className="text-slate-500 mt-1">导入标注员留言文件，系统自动保留原始行号并应用边界规则</p>
        </div>
        <button
          onClick={handleDownloadSample}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <FileText className="w-4 h-4" />
          下载示例CSV
        </button>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
          isDragging
            ? 'border-slate-400 bg-slate-50'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Upload className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-lg font-medium text-slate-900 mb-2">
          拖拽CSV文件到此处，或
          <label className="text-slate-900 font-bold cursor-pointer hover:underline ml-1">
            点击选择文件
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>
        </p>
        <p className="text-sm text-slate-500">
          支持CSV格式，需包含列：标注员留言、引用链接、链接状态、机器人判断
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700">
            导入成功！共导入 <span className="font-bold">{importResult.success}</span> 条记录
          </p>
        </div>
      )}

      {previewRecords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">数据预览</h2>
              <span className="text-sm text-slate-500">
                共 {previewRecords.length} 条记录
              </span>
              {abnormalCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  检测到 {abnormalCount} 条引用链接404仍被判通过，将自动标记为待产品经理复核
                </span>
              )}
            </div>
            <button
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              确认导入
            </button>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    原始行号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    标注员留言
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    引用链接
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    链接状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    机器人判断
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    导入后状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    异常类型
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRecords.map((record, idx) => {
                  const willBeAbnormal = !record.urlStatus && record.robotJudgment === '通过';
                  return (
                    <tr
                      key={idx}
                      className={willBeAbnormal ? 'bg-amber-50' : 'hover:bg-slate-50'}
                    >
                      <td className="px-4 py-3 text-sm text-slate-900 font-mono">
                        {record.originalLineNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-md">
                        <p className="line-clamp-2">{record.annotatorMessage}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono max-w-xs truncate">
                        {record.referenceUrl}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          record.urlStatus
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {record.urlStatus ? '有效' : '无效(404)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {record.robotJudgment}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={willBeAbnormal ? 'pm_review' as any : record.currentStatus}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <AbnormalTypeBadge
                          type={willBeAbnormal ? 'url_404_passed' as any : record.abnormalType}
                          size="sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
