import { useState } from 'react';
import { X, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { cn } from '@/lib/utils';

export function ImportModal() {
  const { showImportModal, setShowImportModal, importCustodian, fetchRecords } = useDashboardStore();
  const [formData, setFormData] = useState({
    institutionCode: '',
    institutionNamePrev: '',
    institutionNameCurrent: '',
    creditLine: '',
    occupiedAmount: '',
    exDividendDate: '',
    shareRatio: '',
    totalShares: '',
    confirmDate: ''
  });
  const [result, setResult] = useState<{ imported: number; duplicates: number; nameInconsistencies: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!showImportModal) return null;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.institutionCode || !formData.institutionNameCurrent || !formData.creditLine) {
      alert('请至少填写机构代码、当前机构简称和授信额度');
      return;
    }

    const importData = [{
      institutionCode: formData.institutionCode,
      institutionNamePrev: formData.institutionNamePrev || formData.institutionNameCurrent,
      institutionNameCurrent: formData.institutionNameCurrent,
      creditLine: parseFloat(formData.creditLine) || 0,
      occupiedAmount: parseFloat(formData.occupiedAmount) || 0,
      availableAmount: (parseFloat(formData.creditLine) || 0) - (parseFloat(formData.occupiedAmount) || 0),
      custodianData: {
        exDividendDate: formData.exDividendDate || new Date().toISOString().split('T')[0],
        shareRatio: parseFloat(formData.shareRatio) || 0,
        totalShares: parseInt(formData.totalShares) || 0,
        confirmDate: formData.confirmDate || new Date().toISOString().split('T')[0]
      }
    }];

    setSubmitting(true);
    const res = await importCustodian(importData);
    if (res) {
      setResult(res);
      await fetchRecords();
    } else {
      alert('导入失败，可能存在重复导入');
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setShowImportModal(false);
    setFormData({
      institutionCode: '',
      institutionNamePrev: '',
      institutionNameCurrent: '',
      creditLine: '',
      occupiedAmount: '',
      exDividendDate: '',
      shareRatio: '',
      totalShares: '',
      confirmDate: ''
    });
    setResult(null);
  };

  const nameConsistent = formData.institutionNamePrev
    ? formData.institutionNamePrev === formData.institutionNameCurrent
    : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">导入托管确认页</h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-800">导入完成</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-green-700">
                  <p>成功导入: {result.imported} 条</p>
                  <p>重复跳过: {result.duplicates} 条</p>
                  <p>机构简称不一致: {result.nameInconsistencies} 条</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600"
              >
                确定
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">机构信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">机构代码 *</label>
                    <input type="text" value={formData.institutionCode} onChange={e => handleChange('institutionCode', e.target.value)} placeholder="如 INS009" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">当前机构简称 *</label>
                    <input type="text" value={formData.institutionNameCurrent} onChange={e => handleChange('institutionNameCurrent', e.target.value)} placeholder="如 光大证券" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">原机构简称（若变更）</label>
                    <input type="text" value={formData.institutionNamePrev} onChange={e => handleChange('institutionNamePrev', e.target.value)} placeholder="与当前不同则标记异常" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-end">
                    {!nameConsistent && (
                      <div className="flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        简称不一致，将标记异常
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">额度信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">授信额度(元) *</label>
                    <input type="number" value={formData.creditLine} onChange={e => handleChange('creditLine', e.target.value)} placeholder="如 500000000" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">已占用(元)</label>
                    <input type="number" value={formData.occupiedAmount} onChange={e => handleChange('occupiedAmount', e.target.value)} placeholder="0" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">托管确认页数据</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">除权日</label>
                    <input type="date" value={formData.exDividendDate} onChange={e => handleChange('exDividendDate', e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">确认日期</label>
                    <input type="date" value={formData.confirmDate} onChange={e => handleChange('confirmDate', e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">配售比例</label>
                    <input type="number" step="0.01" value={formData.shareRatio} onChange={e => handleChange('shareRatio', e.target.value)} placeholder="如 0.85" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">总股数</label>
                    <input type="number" value={formData.totalShares} onChange={e => handleChange('totalShares', e.target.value)} placeholder="如 10000000" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleClose} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">{submitting ? '导入中...' : '确认导入'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
