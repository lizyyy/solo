import React, { useState, useEffect } from 'react';
import type { ParkingCase, CaseStatus, EvidenceAttachment, ManualReleaseRecord, PaymentRecord, TimelineEvent } from '../types';

interface CaseFormProps {
  initialData?: ParkingCase;
  onSubmit: (data: Omit<ParkingCase, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const CaseForm: React.FC<CaseFormProps> = ({ initialData, onSubmit, onCancel, isEdit = false }) => {
  const [formData, setFormData] = useState<Omit<ParkingCase, 'id' | 'createdAt' | 'updatedAt'>>({
    plateNumber: '',
    entryTime: '',
    exitTime: '',
    duration: '',
    feeAmount: 0,
    paidAmount: 0,
    status: 'pending_review',
    paymentStatus: 'unpaid',
    evidences: [] as EvidenceAttachment[],
    manualReleases: [] as ManualReleaseRecord[],
    payments: [] as PaymentRecord[],
    timeline: [] as TimelineEvent[],
    remarks: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        plateNumber: initialData.plateNumber,
        entryTime: initialData.entryTime,
        exitTime: initialData.exitTime,
        duration: initialData.duration,
        feeAmount: initialData.feeAmount,
        paidAmount: initialData.paidAmount,
        status: initialData.status,
        paymentStatus: initialData.paymentStatus,
        evidences: initialData.evidences,
        manualReleases: initialData.manualReleases,
        payments: initialData.payments,
        timeline: initialData.timeline,
        remarks: initialData.remarks || '',
      });
    }
  }, [initialData]);

  const calculateDuration = () => {
    if (formData.entryTime && formData.exitTime) {
      const entry = new Date(formData.entryTime);
      const exit = new Date(formData.exitTime);
      const diffMs = exit.getTime() - entry.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const duration = `${diffHours}小时${diffMinutes}分`;
      setFormData(prev => ({ ...prev, duration }));
      
      const feePerHour = 5;
      const fee = Math.ceil(diffHours + diffMinutes / 60) * feePerHour;
      setFormData(prev => ({ ...prev, feeAmount: fee }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-6">
          {isEdit ? '编辑案件' : '新增案件'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                车牌号码 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.plateNumber}
                onChange={(e) => handleChange('plateNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="例如: 沪A·12345"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                案件状态
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as CaseStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="pending_review">待复核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
                <option value="payment_pending">待补缴</option>
                <option value="payment_completed">补缴完成</option>
                <option value="exported">已导出</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                入场时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.entryTime}
                onChange={(e) => {
                  handleChange('entryTime', e.target.value);
                }}
                onBlur={calculateDuration}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                出场时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.exitTime}
                onChange={(e) => {
                  handleChange('exitTime', e.target.value);
                }}
                onBlur={calculateDuration}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                停车时长
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                placeholder="自动计算或手动填写"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                应付金额 (元)
              </label>
              <input
                type="number"
                value={formData.feeAmount}
                onChange={(e) => handleChange('feeAmount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                已付金额 (元)
              </label>
              <input
                type="number"
                value={formData.paidAmount}
                onChange={(e) => handleChange('paidAmount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注说明
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="可选，补充说明案件情况"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isEdit ? '保存修改' : '创建案件'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseForm;
