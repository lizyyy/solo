'use client';

import { useEffect, useState } from 'react';
import { Prop, Crew, RentalItem } from '@/types';
import { store } from '@/lib/store';
import { formatCurrency, calculateDays } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function NewRentalPage() {
  const router = useRouter();
  const [props, setProps] = useState<Prop[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [selectedCrew, setSelectedCrew] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedItems, setSelectedItems] = useState<RentalItem[]>([]);
  const [notes, setNotes] = useState('');
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setProps(store.getProps());
    setCrews(store.getCrews());
  }, []);

  useEffect(() => {
    if (startDate && endDate && selectedItems.length > 0) {
      const propIds = selectedItems.map(item => item.propId);
      const conflictList = store.checkScheduleConflict(propIds, startDate, endDate);
      setConflicts(conflictList);
    } else {
      setConflicts([]);
    }
  }, [startDate, endDate, selectedItems]);

  const days = startDate && endDate ? calculateDays(startDate, endDate) : 0;
  const subtotal = selectedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity * days, 0);
  const totalDeposit = selectedItems.reduce((sum, item) => sum + item.depositAmount * item.quantity, 0);

  const addItem = (prop: Prop) => {
    const existing = selectedItems.find(item => item.propId === prop.id);
    if (existing) {
      if (existing.quantity < prop.availableQuantity) {
        setSelectedItems(selectedItems.map(item =>
          item.propId === prop.id ? { ...item, quantity: item.quantity + 1 } : item
        ));
      }
    } else {
      setSelectedItems([...selectedItems, {
        propId: prop.id,
        propName: prop.name,
        quantity: 1,
        unitPrice: prop.dailyRate,
        depositAmount: prop.depositAmount,
      }]);
    }
  };

  const removeItem = (propId: string) => {
    setSelectedItems(selectedItems.filter(item => item.propId !== propId));
  };

  const updateQuantity = (propId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(propId);
    } else {
      const prop = props.find(p => p.id === propId);
      if (prop && quantity <= prop.availableQuantity) {
        setSelectedItems(selectedItems.map(item =>
          item.propId === propId ? { ...item, quantity } : item
        ));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCrew) {
      setError('请选择拍摄组');
      return;
    }
    if (!startDate || !endDate) {
      setError('请选择租借日期');
      return;
    }
    if (selectedItems.length === 0) {
      setError('请选择至少一个道具');
      return;
    }
    if (conflicts.length > 0) {
      setError('以下道具档期冲突: ' + conflicts.join(', '));
      return;
    }

    const crew = crews.find(c => c.id === selectedCrew);
    if (!crew) return;

    const result = store.addRental({
      crewId: selectedCrew,
      crewName: crew.name,
      items: selectedItems,
      startDate,
      endDate,
      totalDays: days,
      subtotal,
      totalDeposit,
      depositPaid: true,
      status: 'pending',
      notes,
      createdBy: 'admin',
    });

    if (result.conflicts.includes('DUPLICATE')) {
      setError('检测到重复订单，该拍摄组在相同日期已有类似租借');
      return;
    }

    router.push('/rentals');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">➕ 新建租借订单</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 基本信息</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">拍摄组 *</label>
                <select
                  value={selectedCrew}
                  onChange={(e) => setSelectedCrew(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">请选择拍摄组</option>
                  {crews.map((crew) => (
                    <option key={crew.id} value={crew.id}>{crew.name} - {crew.contactPerson}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始日期 *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束日期 *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={startDate}
                  />
                </div>
              </div>
              {days > 0 && (
                <p className="text-sm text-gray-500">租借天数: {days} 天</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="备注信息（可选）"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🎭 选择道具</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {props.map((prop) => {
                const selected = selectedItems.find(item => item.propId === prop.id);
                const hasConflict = conflicts.includes(prop.name);
                return (
                  <div
                    key={prop.id}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${
                      selected ? 'border-blue-500 bg-blue-50' : 
                      hasConflict ? 'border-red-300 bg-red-50' :
                      'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                    onClick={() => !hasConflict && addItem(prop)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{prop.name}</h3>
                        <p className="text-sm text-gray-500">{prop.category}</p>
                      </div>
                      {hasConflict && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                          档期冲突
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600 font-medium">{formatCurrency(prop.dailyRate)}/天</span>
                      <span className="text-gray-500">可用: {prop.availableQuantity}</span>
                    </div>
                    {selected && (
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(prop.id, selected.quantity - 1); }}
                            className="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300"
                          >-</button>
                          <span className="w-8 text-center font-medium">{selected.quantity}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(prop.id, selected.quantity + 1); }}
                            className="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300"
                          >+</button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeItem(prop.id); }}
                          className="text-red-500 hover:text-red-600 text-sm"
                        >移除</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">🛒 已选道具</h2>
              <div className="space-y-3">
                {selectedItems.map((item) => (
                  <div key={item.propId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.propName}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.unitPrice)}/天 × {item.quantity}件
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-blue-600">
                        {formatCurrency(item.unitPrice * item.quantity * days)}
                      </p>
                      <p className="text-sm text-gray-500">
                        押金: {formatCurrency(item.depositAmount * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6 sticky top-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">💰 费用明细</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">租借天数</span>
                <span className="text-gray-900">{days} 天</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">道具数量</span>
                <span className="text-gray-900">{selectedItems.length} 种</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">总件数</span>
                <span className="text-gray-900">{selectedItems.reduce((s, i) => s + i.quantity, 0)} 件</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="font-medium">租金小计</span>
                <span className="font-bold text-blue-600 text-lg">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">押金总额</span>
                <span className="font-bold text-orange-600">{formatCurrency(totalDeposit)}</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700 font-medium">⚠️ 档期冲突:</p>
                <ul className="text-sm text-yellow-600 mt-1">
                  {conflicts.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={conflicts.length > 0}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              创建租借订单
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
