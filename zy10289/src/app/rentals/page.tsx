'use client';

import { useEffect, useState } from 'react';
import { Rental, RentalStatus } from '@/types';
import { store } from '@/lib/store';
import { formatCurrency, formatDate, exportToCSV } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    refreshRentals();
  }, []);

  const refreshRentals = () => {
    setRentals([...store.getRentals()]);
  };

  const filteredRentals = rentals.filter((rental) => {
    const matchesStatus = filterStatus === 'all' || rental.status === filterStatus;
    const matchesSearch = rental.crewName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rental.items.some(item => item.propName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleExportPendingReturns = () => {
    const pendingReturns = rentals.filter(r => ['picked_up', 'returned', 'cleaning'].includes(r.status));
    const data = pendingReturns.map(r => ({
      租借编号: r.id,
      拍摄组: r.crewName,
      租借开始: formatDate(r.startDate),
      租借结束: formatDate(r.endDate),
      押金: r.totalDeposit,
      状态: r.status,
    }));
    exportToCSV(data, '待归还清单.csv');
  };

  const handleExportPendingCompensations = () => {
    const pendingCompensations = rentals.filter(r => r.status === 'damaged' && !r.compensationPaid);
    const data = pendingCompensations.map(r => ({
      租借编号: r.id,
      拍摄组: r.crewName,
      租借开始: formatDate(r.startDate),
      租借结束: formatDate(r.endDate),
      押金: r.totalDeposit,
      赔付金额: r.damageCompensation || 0,
      损坏描述: r.items.find(i => i.damageDescription)?.damageDescription || '',
    }));
    exportToCSV(data, '待赔付清单.csv');
  };

  const handleStatusChange = (id: string, newStatus: RentalStatus) => {
    store.updateRental(id, { status: newStatus });
    refreshRentals();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">📋 租借记录</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportPendingReturns}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            📥 导出待归还清单
          </button>
          <button
            onClick={handleExportPendingCompensations}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            💸 导出待赔付清单
          </button>
          <Link
            href="/rentals/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            ➕ 新建租借
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索拍摄组或道具名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'confirmed', 'picked_up', 'returned', 'cleaning', 'completed', 'damaged'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? '全部' : 
                 status === 'pending' ? '待处理' :
                 status === 'confirmed' ? '已确认' :
                 status === 'picked_up' ? '已取走' :
                 status === 'returned' ? '已归还' :
                 status === 'cleaning' ? '清洁中' :
                 status === 'completed' ? '已完成' : '待赔付'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRentals.map((rental) => (
          <div key={rental.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg text-gray-900">{rental.crewName}</h3>
                  <StatusBadge status={rental.status} />
                </div>
                <p className="text-sm text-gray-500">
                  📅 {formatDate(rental.startDate)} - {formatDate(rental.endDate)} · 共{rental.totalDays}天
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">租金小计</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(rental.subtotal)}</p>
                <p className="text-sm text-gray-500">押金: {formatCurrency(rental.totalDeposit)}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">租借道具:</p>
              <div className="flex flex-wrap gap-2">
                {rental.items.map((item, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {item.propName} × {item.quantity}
                  </span>
                ))}
              </div>
            </div>

            {rental.damageCompensation && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-700">⚠️ 损坏赔付: {formatCurrency(rental.damageCompensation)}</p>
                {rental.items.find(i => i.damageDescription) && (
                  <p className="text-sm text-red-600 mt-1">
                    描述: {rental.items.find(i => i.damageDescription)?.damageDescription}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t">
              {rental.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleStatusChange(rental.id, 'confirmed')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    ✅ 确认订单
                  </button>
                  <button
                    onClick={() => handleStatusChange(rental.id, 'blocked')}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    🚫 拦截订单
                  </button>
                </>
              )}
              {rental.status === 'confirmed' && (
                <button
                  onClick={() => handleStatusChange(rental.id, 'picked_up')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                   
                  
                  
                
                  
                 确认取货
                </button>
              )}
              {rental.status === 'picked_up' && (
                <button
                  onClick={() => handleStatusChange(rental.id, 'returned')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  📦 确认归还
                </button>
              )}
              {rental.status === 'returned' && (
                <>
                  <button
                    onClick={() => handleStatusChange(rental.id, 'cleaning')}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                  >
                    🧹 开始清洁
                  </button>
                  <button
                    onClick={() => handleStatusChange(rental.id, 'damaged')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    ⚠️ 损坏登记
                  </button>
                </>
              )}
              {rental.status === 'cleaning' && (
                <button
                  onClick={() => handleStatusChange(rental.id, 'completed')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  ✨ 完成清洁
                </button>
              )}
              {rental.status === 'damaged' && !rental.compensationPaid && (
                <button
                  onClick={() => {
                    store.updateRental(rental.id, { compensationPaid: true, status: 'completed' });
                    refreshRentals();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  💰 确认收到赔款
                </button>
              )}
              {['pending', 'confirmed'].includes(rental.status) && (
                <button
                  onClick={() => handleStatusChange(rental.id, 'cancelled')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  ❌ 取消订单
                </button>
              )}
            </div>

            {rental.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">📝 备注: {rental.notes}</p>
              </div>
            )}
          </div>
        ))}

        {filteredRentals.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow">
            <span className="text-6xl block mb-4">📭</span>
            <p className="text-gray-500">没有找到符合条件的租借记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
