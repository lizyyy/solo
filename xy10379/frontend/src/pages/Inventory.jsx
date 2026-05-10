import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../api';
import { Package, ArrowUp, ArrowDown, History } from 'lucide-react';

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');

  useEffect(() => {
    loadInventory();
    loadTransactions();
  }, []);

  const loadInventory = async () => {
    try {
      const res = await inventoryApi.getAll();
      setInventory(res.data);
    } catch (err) {
      console.error('加载库存失败', err);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await inventoryApi.getTransactions();
      setTransactions(res.data);
    } catch (err) {
      console.error('加载变动记录失败', err);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">库存管理</h2>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Package size={18} className="inline mr-2" />
          库存概览
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'transactions'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <History size={18} className="inline mr-2" />
          库存变动记录
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">布草类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">单位</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">单价</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">总数量</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">在用</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">可用</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">报损</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-gray-600">¥{item.price}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{item.total_quantity}</td>
                  <td className="px-4 py-3 text-orange-600">{item.in_use_quantity}</td>
                  <td className="px-4 py-3 text-green-600">{item.available_quantity}</td>
                  <td className="px-4 py-3 text-red-600">{item.damaged_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {inventory.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package size={48} className="mx-auto mb-3 text-gray-300" />
              <p>暂无库存数据</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">布草类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">变动数量</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 text-sm">{t.created_at}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{t.linen_name}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 ${
                      t.change_quantity > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {t.change_quantity > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      {Math.abs(t.change_quantity)} {t.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      t.transaction_type === 'damage' ? 'bg-red-100 text-red-700' :
                      t.transaction_type === 'purchase' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {t.transaction_type === 'damage' ? '报损' :
                       t.transaction_type === 'purchase' ? '采购' : t.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">{t.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {transactions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <History size={48} className="mx-auto mb-3 text-gray-300" />
              <p>暂无库存变动记录</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Inventory;
