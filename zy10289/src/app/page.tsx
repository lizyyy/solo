'use client';

import { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Rental, Prop, Crew } from '@/types';
import Link from 'next/link';

export default function Dashboard() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);

  useEffect(() => {
    setRentals(store.getRentals());
    setProps(store.getProps());
    setCrews(store.getCrews());
  }, []);

  const pendingRentals = rentals.filter(r => ['pending', 'confirmed'].includes(r.status));
  const activeRentals = rentals.filter(r => ['picked_up', 'returned', 'cleaning'].includes(r.status));
  const damagedRentals = rentals.filter(r => r.status === 'damaged' && !r.compensationPaid);
  const completedRentals = rentals.filter(r => r.status === 'completed');

  const totalValue = props.reduce((sum, p) => sum + p.dailyRate, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">📊 仪表盘概览</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">待处理租借</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingRentals.length}</p>
            </div>
            <span className="text-4xl">⏳</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">进行中租借</p>
              <p className="text-3xl font-bold text-green-600">{activeRentals.length}</p>
            </div>
            <span className="text-4xl">🎬</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">待赔付记录</p>
              <p className="text-3xl font-bold text-red-600">{damagedRentals.length}</p>
            </div>
            <span className="text-4xl">⚠️</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">道具总数量</p>
              <p className="text-3xl font-bold text-blue-600">{props.length}</p>
            </div>
            <span className="text-4xl">🎭</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">📋 近期租借记录</h2>
            <Link href="/rentals" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-3">
            {rentals.slice(0, 5).map((rental) => (
              <div key={rental.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{rental.crewName}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(rental.startDate)} - {formatDate(rental.endDate)}
                  </p>
                </div>
                <StatusBadge status={rental.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔥 热门道具</h2>
          <div className="space-y-3">
            {props.slice(0, 5).map((prop) => (
              <div key={prop.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{prop.name}</p>
                  <p className="text-sm text-gray-500">{prop.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">{formatCurrency(prop.dailyRate)}/天</p>
                  <p className="text-sm text-gray-500">库存: {prop.availableQuantity}/{prop.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">👥 合作拍摄组</h2>
          <div className="space-y-3">
            {crews.slice(0, 5).map((crew) => (
              <div key={crew.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{crew.name}</p>
                  <p className="text-sm text-gray-500">联系人: {crew.contactPerson}</p>
                </div>
                <p className="text-sm text-gray-600">{crew.phone}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 财务概览</h2>
          <div className="space-y-4">
            <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-700">道具日租金总值</span>
              <span className="font-semibold text-blue-600">{formatCurrency(totalValue)}</span>
            </div>
            <div className="flex justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-gray-700">已完成订单</span>
              <span className="font-semibold text-green-600">{completedRentals.length} 单</span>
            </div>
            <div className="flex justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-gray-700">待处理押金</span>
              <span className="font-semibold text-yellow-600">
                {formatCurrency(activeRentals.reduce((sum, r) => sum + r.totalDeposit, 0))}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-gray-700">待收赔款</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(damagedRentals.reduce((sum, r) => sum + (r.damageCompensation || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ 快捷操作</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/rentals/new" className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors">
            <span className="text-2xl block mb-2">➕</span>
            <span className="font-medium text-blue-700">新建租借</span>
          </Link>
          <Link href="/props" className="p-4 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors">
            <span className="text-2xl block mb-2">🎭</span>
            <span className="font-medium text-green-700">查看道具</span>
          </Link>
          <Link href="/calendar" className="p-4 bg-purple-50 rounded-lg text-center hover:bg-purple-100 transition-colors">
            <span className="text-2xl block mb-2">📅</span>
            <span className="font-medium text-purple-700">档期日历</span>
          </Link>
          <Link href="/crews" className="p-4 bg-orange-50 rounded-lg text-center hover:bg-orange-100 transition-colors">
            <span className="text-2xl block mb-2">👥</span>
            <span className="font-medium text-orange-700">拍摄组管理</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
