import React, { useState } from 'react';
import type { RecordSource } from '../types';
import { SOURCE_LABELS } from '../types';
import { api } from '../api';

interface CreateRecordModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export const CreateRecordModal: React.FC<CreateRecordModalProps> = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    guaranteeNo: '',
    customerName: '',
    amount: '',
    currency: 'CNY',
    source: 'manual_entry' as RecordSource,
    sourceRef: '',
    pendingReason: '',
    currentOperator: '当前用户',
    remark: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.guaranteeNo.trim() || !formData.customerName.trim() || !formData.amount) {
      alert('请填写保证函编号、客户名称和金额');
      return;
    }

    setLoading(true);
    try {
      const result = await api.createRecord({
        ...formData,
        amount: parseFloat(formData.amount),
        createdBy: formData.currentOperator
      });

      if (result.isDuplicate) {
        alert(`记录已创建，但检测到疑似重复授信，已自动标记为【待复核】。\n关联记录ID: #${result.duplicateWith}`);
      } else {
        alert('记录创建成功');
      }
      
      onCreated();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">新增记录</h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-2xl"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                保证函编号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                value={formData.guaranteeNo}
                onChange={(e) => setFormData({ ...formData, guaranteeNo: e.target.value })}
                placeholder="例如: GH2024001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                客户名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="客户全称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金额 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">币种</label>
              <select
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                <option value="CNY">CNY 人民币</option>
                <option value="USD">USD 美元</option>
                <option value="EUR">EUR 欧元</option>
                <option value="JPY">JPY 日元</option>
                <option value="HKD">HKD 港币</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
              <select
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as RecordSource })}
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">来源参考</label>
              <input
                type="text"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                value={formData.sourceRef}
                onChange={(e) => setFormData({ ...formData, sourceRef: e.target.value })}
                placeholder="审批单号/日报日期等"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                处理人
              </label>
              <input
                type="text"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                value={formData.currentOperator}
                onChange={(e) => setFormData({ ...formData, currentOperator: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">待处理原因</label>
              <textarea
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                rows={2}
                value={formData.pendingReason}
                onChange={(e) => setFormData({ ...formData, pendingReason: e.target.value })}
                placeholder="说明为什么需要待处理，方便下一班同事快速了解情况"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
              <textarea
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                rows={2}
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="其他需要说明的信息"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
