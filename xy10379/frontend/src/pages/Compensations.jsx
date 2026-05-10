import React, { useState, useEffect } from 'react';
import { compensationsApi } from '../api';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

function Compensations() {
  const [compensations, setCompensations] = useState([]);

  useEffect(() => {
    loadCompensations();
  }, []);

  const loadCompensations = async () => {
    try {
      const res = await compensationsApi.getAll();
      setCompensations(res.data);
    } catch (err) {
      console.error('加载赔付失败', err);
    }
  };

  const handlePay = async (comp) => {
    if (!confirm(`确认收到赔付 ¥${comp.amount}？`)) {
      return;
    }
    try {
      await compensationsApi.pay(comp.id);
      alert('赔付完成');
      loadCompensations();
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'unpaid': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return '已支付';
      case 'unpaid': return '待支付';
      default: return status;
    }
  };

  const totalUnpaid = compensations
    .filter(c => c.payment_status === 'unpaid')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalPaid = compensations
    .filter(c => c.payment_status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">客人赔付</h2>
        <div className="flex gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <span className="text-sm text-green-600">已赔付金额</span>
            <div className="text-xl font-bold text-green-700">¥{totalPaid.toFixed(2)}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <span className="text-sm text-red-600">待收金额</span>
            <div className="text-xl font-bold text-red-700">¥{totalUnpaid.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">房号</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">客人</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">布草类型</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">数量</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">损坏程度</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">赔付金额</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">支付时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {compensations.map((comp) => (
              <tr key={comp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{comp.room_number}</td>
                <td className="px-4 py-3 text-gray-600">{comp.guest_name}</td>
                <td className="px-4 py-3 text-gray-600">{comp.linen_name}</td>
                <td className="px-4 py-3 text-gray-600">{comp.quantity} {comp.unit}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    comp.damage_level === 'severe' ? 'bg-red-100 text-red-700' :
                    comp.damage_level === 'moderate' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {comp.damage_level === 'severe' ? '严重' : 
                     comp.damage_level === 'moderate' ? '中度' : '轻微'}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">¥{comp.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(comp.payment_status)}`}>
                    {getStatusText(comp.payment_status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{comp.payment_time || '-'}</td>
                <td className="px-4 py-3">
                  {comp.payment_status === 'unpaid' && (
                    <button
                      onClick={() => handlePay(comp)}
                      className="flex items-center gap-1 text-green-600 hover:text-green-800"
                    >
                      <CreditCard size={16} />
                      <span className="text-sm">收款</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {compensations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CreditCard size={48} className="mx-auto mb-3 text-gray-300" />
            <p>暂无赔付记录</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Compensations;
