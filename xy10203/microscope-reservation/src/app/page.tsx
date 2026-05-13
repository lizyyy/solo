'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Users,
  Microscope as MicroscopeIcon,
  BarChart3,
  Activity,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import type { ReservationWithDetails, User, ResearchGroup, Microscope as MicroscopeType } from '@/lib/types';
import { getStatusLabel } from '@/lib/client-utils';
import { formatDateTime } from '@/lib/utils';

export default function Home() {
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [microscopes, setMicroscopes] = useState<MicroscopeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  useEffect(() => {
    initializeAndLoad();
  }, []);

  async function initializeAndLoad() {
    try {
      await fetch('/api/init');
    } catch (error) {
      console.log('初始化检查完成');
    }
    loadData();
  }

  async function loadData() {
    try {
      const [reservationsRes, resourcesRes] = await Promise.all([
        fetch('/api/reservations'),
        fetch('/api/resources')
      ]);

      const reservationsData = await reservationsRes.json();
      const resourcesData = await resourcesRes.json();

      setReservations(reservationsData);
      setUsers(resourcesData.users || []);
      setGroups(resourcesData.groups || []);
      setMicroscopes(resourcesData.microscopes || []);

      const statsData = {
        total: reservationsData.length,
        pending: reservationsData.filter((r: ReservationWithDetails) => r.status === 'pending').length,
        approved: reservationsData.filter((r: ReservationWithDetails) => r.status === 'approved').length,
        rejected: reservationsData.filter((r: ReservationWithDetails) => r.status === 'rejected' || r.status === 'cancelled').length
      };
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载系统数据...</p>
        </div>
      </div>
    );
  }

  const recentReservations = reservations.slice(0, 5);

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MicroscopeIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">显微镜共享预约冲突器</h1>
                <p className="text-sm text-gray-500">实验室资源智能调度系统</p>
              </div>
            </div>
            <Link
              href="/reservations/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Calendar className="h-5 w-5 mr-2" />
              新建预约
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">总预约数</p>
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
                <p className="text-sm font-medium text-gray-500">已拒绝/取消</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">最近预约</h2>
              </div>
              <div className="divide-y">
                {recentReservations.length > 0 ? (
                  recentReservations.map((reservation) => (
                    <div key={reservation.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-medium text-gray-900">{reservation.microscope_name}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                              {getStatusLabel(reservation.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{reservation.purpose}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {reservation.user_name} ({reservation.group_name})
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {formatDateTime(reservation.start_time)} - {formatDateTime(reservation.end_time)}
                            </span>
                          </div>
                          {reservation.accessories.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {reservation.accessories.map((acc) => (
                                <span
                                  key={acc.id}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
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
                          查看详情
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">暂无预约记录</p>
                    <Link
                      href="/reservations/new"
                      className="inline-flex items-center mt-4 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      创建第一个预约
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">快捷入口</h3>
              <div className="space-y-3">
                <Link
                  href="/reservations"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="font-medium text-gray-700">预约列表</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <BarChart3 className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="font-medium text-gray-700">资源看板</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>
                <Link
                  href="/approvals"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="font-medium text-gray-700">审批中心</span>
                  </div>
                  {stats.pending > 0 && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                      {stats.pending}
                    </span>
                  )}
                </Link>
                <Link
                  href="/guide"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="font-medium text-gray-700">使用指南</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>
              </div>
            </div>

            <Link
              href="/guide"
              className="block bg-blue-50 rounded-xl border border-blue-200 p-6 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center mb-3">
                <BookOpen className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-blue-900">使用指南</h3>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                从空数据到资源看板的完整操作流程
              </p>
              <span className="inline-flex items-center text-sm font-medium text-blue-600">
                查看详细指南
                <ChevronRight className="h-4 w-4 ml-1" />
              </span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">可用设备</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            {microscopes.map((scope) => (
              <div key={scope.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{scope.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{scope.model}</p>
                    <p className="text-xs text-gray-400 mt-1">{scope.location}</p>
                  </div>
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
