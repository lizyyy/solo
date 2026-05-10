'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Users,
  Microscope,
  CheckCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { ReservationWithDetails, Microscope as MicroscopeType, Accessory } from '@/lib/types';
import { getStatusLabel } from '@/lib/services/reservation-service';
import { formatDateTime, formatDate } from '@/lib/utils';
import dayjs from 'dayjs';

interface MicroscopeWithAccessories extends MicroscopeType {
  accessories: Accessory[];
}

export default function DashboardPage() {
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([]);
  const [microscopes, setMicroscopes] = useState<MicroscopeWithAccessories[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  async function loadData() {
    setLoading(true);
    try {
      const [reservationsRes, microscopesRes] = await Promise.all([
        fetch(`/api/reservations?startDate=${selectedDate}&endDate=${selectedDate}`),
        fetch('/api/resources?type=microscopes')
      ]);

      const reservationsData = await reservationsRes.json();
      const microscopesData = await microscopesRes.json();

      setReservations(reservationsData);
      setMicroscopes(microscopesData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const activeReservations = reservations.filter(r => 
    ['pending', 'approved', 'completed'].includes(r.status)
  );

  const stats = {
    total: reservations.length,
    pending: reservations.filter(r => r.status === 'pending').length,
    approved: reservations.filter(r => r.status === 'approved').length,
    rejected: reservations.filter(r => r.status === 'rejected' || r.status === 'cancelled').length
  };

  function getReservationsForMicroscope(microscopeId: string) {
    return activeReservations.filter(r => r.microscope_id === microscopeId);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  }

  function getStatusBgColor(status: string) {
    switch (status) {
      case 'approved': return 'bg-green-50 border-green-200';
      case 'pending': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  }

  function generateTimeSlots() {
    const slots = [];
    for (let h = 8; h <= 20; h++) {
      slots.push(h);
    }
    return slots;
  }

  function getReservationForSlot(reservations: ReservationWithDetails[], hour: number) {
    const slotStart = dayjs(selectedDate).hour(hour).minute(0);
    const slotEnd = dayjs(selectedDate).hour(hour + 1).minute(0);

    return reservations.find(r => {
      const rStart = dayjs(r.start_time);
      const rEnd = dayjs(r.end_time);
      return rStart.isBefore(slotEnd) && rEnd.isAfter(slotStart);
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <ArrowLeft className="h-5 w-5 mr-2" />
                返回首页
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">资源看板</h1>
                <p className="text-sm text-gray-500">实时查看显微镜和附件的占用情况</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <label className="text-sm text-gray-600">查看日期：</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">今日预约总数</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">待审批</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">已批准</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.approved}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">设备数量</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{microscopes.length}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Microscope className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border mb-8">
          <div className="p-6 border-b">
            <div className="flex items-center">
              <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">资源占用时间轴</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">{formatDate(selectedDate)} 8:00 - 21:00</p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-48">
                      设备
                    </th>
                    {generateTimeSlots().map(hour => (
                      <th key={hour} className="px-2 py-3 text-center text-xs font-medium text-gray-500 min-w-16">
                        {hour}:00
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {microscopes.map((scope) => {
                    const scopeReservations = getReservationsForMicroscope(scope.id);

                    return (
                      <tr key={scope.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 sticky left-0 bg-white z-10">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{scope.name}</p>
                            <p className="text-xs text-gray-500">{scope.location}</p>
                          </div>
                        </td>
                        {generateTimeSlots().map(hour => {
                          const reservation = getReservationForSlot(scopeReservations, hour);

                          if (reservation) {
                            return (
                              <td key={hour} className="px-1 py-2">
                                <Link
                                  href={`/reservations/${reservation.id}`}
                                  className={`block rounded text-center py-3 px-1 text-xs font-medium ${
                                    reservation.status === 'approved'
                                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                      : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                  }`}
                                  title={`${reservation.user_name} - ${reservation.purpose}`}
                                >
                                  {reservation.user_name.slice(0, 2)}
                                </Link>
                              </td>
                            );
                          }

                          return (
                            <td key={hour} className="px-1 py-2">
                              <div className="h-9 bg-gray-50 rounded border border-dashed border-gray-200"></div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">今日预约详情</h2>
              </div>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {activeReservations.length > 0 ? (
                activeReservations
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((reservation) => (
                    <div key={reservation.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">{reservation.microscope_name}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              reservation.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {getStatusLabel(reservation.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {reservation.user_name} ({reservation.group_name})
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDateTime(reservation.start_time)} - {formatDateTime(reservation.end_time)}
                          </p>
                          {reservation.accessories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {reservation.accessories.map((acc) => (
                                <span
                                  key={acc.id}
                                  className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                                >
                                  {acc.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/reservations/${reservation.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          查看
                        </Link>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p>今日暂无预约</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">冲突风险提示</h2>
              </div>
            </div>
            <div className="p-6">
              {stats.pending > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-start p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-500 mr-3 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">
                        {stats.pending} 个预约待审批
                      </h4>
                      <p className="mt-1 text-xs text-yellow-700">
                        请及时处理待审批预约，避免资源冲突
                      </p>
                      <Link
                        href="/approvals"
                        className="inline-flex items-center mt-2 text-sm text-yellow-700 hover:text-yellow-900 font-medium"
                      >
                        前往审批中心 →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-10 w-10 text-green-300 mx-auto mb-2" />
                  <p className="text-gray-500">当前无待审批预约</p>
                  <p className="text-sm text-gray-400 mt-1">资源状态良好</p>
                </div>
              )}

              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-3">设备统计</h3>
                <div className="space-y-3">
                  {microscopes.map((scope) => {
                    const count = getReservationsForMicroscope(scope.id).length;
                    const magCount = scope.accessories.filter(a => a.type === 'magnification').length;
                    const stageCount = scope.accessories.filter(a => a.type === 'sample_stage').length;

                    return (
                      <div key={scope.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{scope.name}</p>
                          <p className="text-xs text-gray-500">
                            {magCount} 倍率模块 · {stageCount} 样品台
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{count}</p>
                          <p className="text-xs text-gray-500">今日预约</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
