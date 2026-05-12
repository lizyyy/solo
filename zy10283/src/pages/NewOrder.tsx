import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useRepairStore } from '../store';
import { CreateOrderDTO, RepairItem } from '../types';

export const NewOrder: React.FC = () => {
  const navigate = useNavigate();
  const { addOrder, checkDuplicate, calculateTotalEstimatedPrice } = useRepairStore();
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ reason: string; orderNo: string } | null>(null);
  
  const [formData, setFormData] = useState<CreateOrderDTO>({
    customerName: '',
    customerPhone: '',
    customerIdCard: '',
    jewelryName: '',
    jewelryDescription: '',
    jewelryMaterial: '',
    diamondCount: 0,
    weight: 0,
    deposit: 0,
    note: '',
    repairItems: []
  });

  const [newItem, setNewItem] = useState<Omit<RepairItem, 'id'>>({
    name: '',
    description: '',
    estimatedPrice: 0,
    completed: false
  });

  useEffect(() => {
    const checkTimer = setTimeout(() => {
      if (formData.customerName && formData.customerPhone && formData.jewelryName) {
        const result = checkDuplicate(formData);
        if (result.isDuplicate) {
          setDuplicateInfo({
            reason: result.reason || '',
            orderNo: result.existingOrderNo || ''
          });
          setShowDuplicateWarning(true);
        } else {
          setShowDuplicateWarning(false);
          setDuplicateInfo(null);
        }
      }
    }, 500);

    return () => clearTimeout(checkTimer);
  }, [formData.customerName, formData.customerPhone, formData.jewelryName, formData.jewelryDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const order = addOrder(formData);
    navigate(`/orders/${order.id}`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'diamondCount' || name === 'weight' || name === 'deposit'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const addRepairItem = () => {
    if (!newItem.name.trim()) return;
    setFormData(prev => ({
      ...prev,
      repairItems: [...(prev.repairItems || []), { ...newItem, id: '' } as RepairItem]
    }));
    setNewItem({ name: '', description: '', estimatedPrice: 0, completed: false });
  };

  const removeRepairItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      repairItems: (prev.repairItems || []).filter((_, i) => i !== index)
    }));
  };

  const totalEstimatedPrice = calculateTotalEstimatedPrice({ repairItems: formData.repairItems || [] } as any);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">新建维修单</h1>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.customerName || !formData.customerPhone || !formData.jewelryName || !formData.jewelryDescription}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>

      {showDuplicateWarning && duplicateInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-800 font-medium">⚠️ 可能重复录入</p>
              <p className="text-yellow-700 text-sm mt-1">{duplicateInfo.reason}</p>
              <p className="text-yellow-600 text-sm mt-1">已有订单：{duplicateInfo.orderNo}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            客户信息
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                客户姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                联系电话 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                身份证号
              </label>
              <input
                type="text"
                name="customerIdCard"
                value={formData.customerIdCard}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            首饰信息
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                首饰名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="jewelryName"
                value={formData.jewelryName}
                onChange={handleChange}
                required
                placeholder="如：18K金钻石戒指"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                材质
              </label>
              <input
                type="text"
                name="jewelryMaterial"
                value={formData.jewelryMaterial}
                onChange={handleChange}
                placeholder="如：PT950、18K金、银"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                钻石数量（颗）
              </label>
              <input
                type="number"
                name="diamondCount"
                value={formData.diamondCount}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                重量（g）
              </label>
              <input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                详细描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                name="jewelryDescription"
                value={formData.jewelryDescription}
                onChange={handleChange}
                required
                rows={4}
                placeholder="请详细描述首饰外观、损坏情况、钻石位置和数量等重要信息..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            维修项目
            <span className="text-sm font-normal text-gray-500 ml-2">（预估总费用：¥{totalEstimatedPrice}）</span>
          </h2>
          
          {(formData.repairItems || []).length > 0 && (
            <div className="space-y-3 mb-6">
              {(formData.repairItems || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-gray-800">{item.name}</span>
                      <span className="text-sm text-gray-500">- {item.description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-blue-600">¥{item.estimatedPrice}</span>
                    <button
                      type="button"
                      onClick={() => removeRepairItem(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-3">
              <input
                type="text"
                placeholder="项目名称"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="col-span-6">
              <input
                type="text"
                placeholder="项目描述"
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                placeholder="预估费用"
                value={newItem.estimatedPrice || ''}
                onChange={(e) => setNewItem(prev => ({ 
                  ...prev, 
                  estimatedPrice: parseFloat(e.target.value) || 0 
                }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="col-span-1">
              <button
                type="button"
                onClick={addRepairItem}
                disabled={!newItem.name.trim()}
                className="w-full flex items-center justify-center p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">4</span>
            其他信息
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                押金（元）
              </label>
              <input
                type="number"
                name="deposit"
                value={formData.deposit}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                预计取件日期
              </label>
              <input
                type="date"
                name="estimatedPickupDate"
                value={formData.estimatedPickupDate?.split('T')[0] || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  estimatedPickupDate: e.target.value
                }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                备注
              </label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <p className="text-sm text-yellow-800">
            <strong>重要提示：</strong>请务必仔细核对首饰信息，特别是钻石数量和外观描述。
            建议拍照存档，避免取件时产生纠纷。
          </p>
        </div>
      </form>
    </div>
  );
};
