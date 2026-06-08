import { useState } from 'react';
import { X, ImagePlus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import type { CreditRecord } from '../../shared/types';

interface ScreenshotModalProps {
  record: CreditRecord;
  onClose: () => void;
}

export function ScreenshotModal({ record, onClose }: ScreenshotModalProps) {
  const { uploadScreenshot, fetchRecords } = useDashboardStore();
  const [formData, setFormData] = useState({
    exDividendDate: '',
    shareRatio: '',
    totalShares: '',
    ocrConfidence: '0.95'
  });
  const [conflictResult, setConflictResult] = useState<{ hasConflict: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.exDividendDate && !formData.shareRatio && !formData.totalShares) {
      alert('请至少填写一项除权日截图数据');
      return;
    }

    const screenshotData = {
      exDividendDate: formData.exDividendDate || record.custodianData.exDividendDate,
      shareRatio: formData.shareRatio ? parseFloat(formData.shareRatio) : record.custodianData.shareRatio,
      totalShares: formData.totalShares ? parseInt(formData.totalShares) : record.custodianData.totalShares,
      ocrConfidence: parseFloat(formData.ocrConfidence) || 0.95
    };

    setSubmitting(true);
    const res = await uploadScreenshot(record.id, screenshotData);
    if (res) {
      await fetchRecords();
      if (res.hasConflict) {
        setConflictResult({
          hasConflict: true,
          message: `检测到 ${res.conflicts.length} 处数据冲突，请在记录列表点击"处理冲突"按钮查看详情并处理`
        });
      } else {
        setConflictResult({
          hasConflict: false,
          message: '截图数据与托管确认页数据一致，无冲突'
        });
      }
    } else {
      alert('上传失败');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <ImagePlus className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900">补看除权日截图</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 rounded-lg bg-purple-50 px-4 py-3">
            <p className="text-sm font-medium text-purple-900">
              {record.institutionNameCurrent}
              <span className="ml-2 text-purple-600">{record.institutionCode}</span>
            </p>
            <p className="mt-1 text-xs text-purple-600">
              托管确认页 - 除权日: {record.custodianData.exDividendDate}，配售比例: {record.custodianData.shareRatio}，总股数: {record.custodianData.totalShares}
            </p>
          </div>

          {conflictResult ? (
            <div className="space-y-4">
              <div className={conflictResult.hasConflict ? 'rounded-lg border border-red-200 bg-red-50 p-4' : 'rounded-lg border border-green-200 bg-green-50 p-4'}>
                <div className="flex items-center gap-2">
                  {conflictResult.hasConflict ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  <span className={conflictResult.hasConflict ? 'font-medium text-red-800' : 'font-medium text-green-800'}>
                    {conflictResult.hasConflict ? '发现数据冲突' : '数据一致'}
                  </span>
                </div>
                <p className={conflictResult.hasConflict ? 'mt-2 text-sm text-red-700' : 'mt-2 text-sm text-green-700'}>
                  {conflictResult.message}
                </p>
              </div>
              <button onClick={onClose} className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600">确定</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">截图识别数据（与托管确认页自动对比）</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">除权日</label>
                    <input type="date" value={formData.exDividendDate} onChange={e => handleChange('exDividendDate', e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <p className="mt-1 text-xs text-gray-400">托管值: {record.custodianData.exDividendDate}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">OCR置信度</label>
                    <input type="number" step="0.01" value={formData.ocrConfidence} onChange={e => handleChange('ocrConfidence', e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">配售比例</label>
                    <input type="number" step="0.01" value={formData.shareRatio} onChange={e => handleChange('shareRatio', e.target.value)} placeholder={record.custodianData.shareRatio.toString()} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <p className="mt-1 text-xs text-gray-400">托管值: {record.custodianData.shareRatio}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">总股数</label>
                    <input type="number" value={formData.totalShares} onChange={e => handleChange('totalShares', e.target.value)} placeholder={record.custodianData.totalShares.toString()} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <p className="mt-1 text-xs text-gray-400">托管值: {record.custodianData.totalShares}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50">{submitting ? '对比中...' : '提交并自动对比'}</button>
              </div>
              <p className="text-center text-xs text-gray-400">系统将自动与托管确认页数据对比，如有矛盾会列出冲突证据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
