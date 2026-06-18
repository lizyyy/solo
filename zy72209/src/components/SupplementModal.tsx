import { useState } from 'react';
import { X, Edit3, Calculator } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatAmount } from '@/utils/format';

export function SupplementModal() {
  const { supplementRecord, setSupplementRecord, supplementRecordAction, fetchRecords } = useDashboardStore();
  const [formData, setFormData] = useState({
    settlementAccount: '',
    settlementBank: '',
    contactPerson: '',
    contactPhone: '',
    exDividendDate: '',
    shareRatio: '',
    totalShares: ''
  });
  const [submitting, setSubmitting] = useState(false);

  if (!supplementRecord) return null;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!supplementRecord) return;
    
    const fields: Record<string, any> = {};
    
    if (formData.settlementAccount) fields.settlementAccount = formData.settlementAccount;
    if (formData.settlementBank) fields.settlementBank = formData.settlementBank;
    if (formData.contactPerson) fields.contactPerson = formData.contactPerson;
    if (formData.contactPhone) fields.contactPhone = formData.contactPhone;
    if (formData.exDividendDate) fields.exDividendDate = formData.exDividendDate;
    if (formData.shareRatio) fields.shareRatio = parseFloat(formData.shareRatio);
    if (formData.totalShares) fields.totalShares = parseInt(formData.totalShares);
    
    if (Object.keys(fields).length === 0) {
      alert('请至少填写一个补录字段');
      return;
    }
    
    setSubmitting(true);
    const success = await supplementRecordAction(supplementRecord.id, fields);
    if (success) {
      await fetchRecords();
      setSupplementRecord(null);
      setFormData({
        settlementAccount: '',
        settlementBank: '',
        contactPerson: '',
        contactPhone: '',
        exDividendDate: '',
        shareRatio: '',
        totalShares: ''
      });
    }
    setSubmitting(false);
  };

  const previewRecalc = () => {
    const shareRatio = formData.shareRatio ? parseFloat(formData.shareRatio) : supplementRecord.custodianData.shareRatio;
    const totalShares = formData.totalShares ? parseInt(formData.totalShares) : supplementRecord.custodianData.totalShares;
    
    const occupiedAmount = Math.round(totalShares * shareRatio * 100);
    const availableAmount = supplementRecord.creditLine - occupiedAmount;
    
    return { occupiedAmount, availableAmount };
  };

  const preview = previewRecalc();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={() => setSupplementRecord(null)}
      />
      
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Edit3 className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">补录记录</h2>
          </div>
          <button
            onClick={() => setSupplementRecord(null)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">
              {supplementRecord.institutionNameCurrent}
              <span className="ml-2 text-blue-600">
                {supplementRecord.institutionCode}
              </span>
            </p>
          </div>

          <div className="mb-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-700">基础信息补录</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500">结算账号</label>
                <input
                  type="text"
                  value={formData.settlementAccount}
                  onChange={(e) => handleChange('settlementAccount', e.target.value)}
                  placeholder="请输入结算账号"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">结算银行</label>
                <input
                  type="text"
                  value={formData.settlementBank}
                  onChange={(e) => handleChange('settlementBank', e.target.value)}
                  placeholder="请输入结算银行"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500">联系人</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => handleChange('contactPerson', e.target.value)}
                  placeholder="请输入联系人"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">联系电话</label>
                <input
                  type="text"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="请输入联系电话"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calculator className="h-4 w-4 text-amber-500" />
              关键数据修正（将触发重算）
            </h3>
            
            <div>
              <label className="block text-xs text-gray-500">除权日</label>
              <input
                type="date"
                value={formData.exDividendDate}
                onChange={(e) => handleChange('exDividendDate', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                当前值: {supplementRecord.custodianData.exDividendDate}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500">配售比例</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.shareRatio}
                  onChange={(e) => handleChange('shareRatio', e.target.value)}
                  placeholder={supplementRecord.custodianData.shareRatio.toString()}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">总股数</label>
                <input
                  type="number"
                  value={formData.totalShares}
                  onChange={(e) => handleChange('totalShares', e.target.value)}
                  placeholder={supplementRecord.custodianData.totalShares.toString()}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {(formData.shareRatio || formData.totalShares) && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-medium text-amber-800">重算预览</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-amber-600">已占用金额</p>
                  <p className="font-mono font-bold text-amber-900">
                    {formatAmount(preview.occupiedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-amber-600">可用额度</p>
                  <p className="font-mono font-bold text-amber-900">
                    {formatAmount(preview.availableAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setSupplementRecord(null)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存并重算'}
            </button>
          </div>
          
          <p className="mt-3 text-center text-xs text-gray-400">
            保存后系统将自动重算额度，并更新状态为待财务复核
          </p>
        </div>
      </div>
    </div>
  );
}
