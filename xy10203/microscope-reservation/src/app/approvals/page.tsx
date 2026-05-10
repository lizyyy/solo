'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Microscope,
  Loader2,
  X
} from 'lucide-react';
import { ReservationWithDetails, ConflictDetail } from '@/lib/types';
import { getStatusLabel } from '@/lib/services/reservation-service';
import { formatDateTime } from '@/lib/utils';

export default function ApprovalsPage() {
  const [pendingReservations, setPendingReservations] = useState<ReservationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [conflicts, setConflicts] = useState<Record<string, ConflictDetail[]>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch('/api/reservations?status=pending');
      const data = await response.json();
      setPendingReservations(data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkConflicts(reservation: ReservationWithDetails) {
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-conflict',
          microscopeId: reservation.microscope_id,
          accessoryIds: reservation.accessories.map(a => a.id),
          startTime: reservation.start_time,
          endTime: reservation.end_time,
          excludeReservationId: reservation.id
        })
      });

      const result = await response.json();
      setConflicts(prev => ({
        ...prev,
        [reservation.id]: result.conflicts || []
      }));
    } catch (error) {
      console.error('冲突检测失败:', error);
    }
  }

  useEffect(() => {
    pendingReservations.forEach(r => {
      if (!conflicts[r.id]) {
        checkConflicts(r);
      }
    });
  }, [pendingReservations]);

  async function handleApprove(reservation: ReservationWithDetails) {
    const reservationConflicts = conflicts[reservation.id] || [];
    if (reservationConflicts.length > 0) {
      setError(`该预约存在 ${reservationConflicts.length} 个资源冲突，请先检查`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    setActionLoading(reservation.id);
    setError('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservation.id, action: 'approve' })
      });

      if (response.ok) {
        setToast({ type: 'success', message: `已批准 ${reservation.user_name} 的预约` });
        loadData();
      } else {
        const errorData = await response.json();
        if (errorData.errorType === 'ConflictError') {
          setConflicts(prev => ({
            ...prev,
            [reservation.id]: errorData.conflicts || []
          }));
          setError(errorData.error);
        } else {
          setError(errorData.error || '审批失败');
        }
      }
    } catch (error) {
      console.error('审批失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!showRejectModal || !rejectReason.trim()) {
      setError('请填写拒绝原因');
      return;
    }

    setActionLoading(showRejectModal);
    setError('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: showRejectModal,
          action: 'reject',
          reason: rejectReason.trim()
        })
      });

      if (response.ok) {
        setShowRejectModal(false);
        setRejectReason('');
        setToast({ type: 'success', message: '已拒绝预约' });
        loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function getAccessoryTypeLabel(type: string) {
    switch (type) {
      case 'magnification': return '倍率模块';
      case 'sample_stage': return '样品台';
      default: return '其他附件';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`toast flex items-center p-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertTriangle className="h-5 w-5 mr-2" />
            )}
            {toast.message}
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">拒绝预约</h3>
                <button
                  onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">拒绝原因</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="请说明拒绝原因，例如：资源冲突、时间安排问题等"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                disabled={actionLoading === showRejectModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === showRejectModal || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === showRejectModal ? (
                  <span className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    处理中...
                  </span>
                ) : (
                  '确认拒绝'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <ArrowLeft className="h-5 w-5 mr-2" />
                返回首页
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">审批中心</h1>
                <p className="text-sm text-gray-500">
                  待审批预约：{pendingReservations.length} 条
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start mb-6">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : pendingReservations.length > 0 ? (
          <div className="space-y-6">
            {pendingReservations.map((reservation) => {
              const reservationConflicts = conflicts[reservation.id] || [];
              const hasConflict = reservationConflicts.length > 0;

              return (
                <div key={reservation.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {reservation.microscope_name}
                          </h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3 mr-1" />
                            待审批
                          </span>
                        </div>
                        <p className="mt-1 text-gray-600">{reservation.purpose}</p>
                      </div>
                      <Link
                        href={`/reservations/${reservation.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        查看详情
                      </Link>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{reservation.user_name}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span>{reservation.group_name}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        <span>
                          {formatDateTime(reservation.start_time)} - {formatDateTime(reservation.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Microscope className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{reservation.accessories.length} 个附件</span>
                      </div>
                    </div>

                    {reservation.accessories.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-500 mb-2">已选附件：</p>
                        <div className="flex flex-wrap gap-2">
                          {reservation.accessories.map((acc) => (
                            <span
                              key={acc.id}
                              className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg"
                            >
                              <span className={`w-2 h-2 rounded-full mr-2 ${
                                acc.type === 'magnification' ? 'bg-purple-500' : 'bg-green-500'
                              }`}></span>
                              {getAccessoryTypeLabel(acc.type)}：{acc.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasConflict && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-red-800">
                              发现 {reservationConflicts.length} 个资源冲突
                            </h4>
                            <div className="mt-2 space-y-2">
                              {reservationConflicts.map((conflict, idx) => (
                                <div key={idx} className="text-sm text-red-700">
                                  <span className="font-medium">
                                    {conflict.type === 'microscope' ? '显微镜' : '附件'}：
                                  </span>
                                  {conflict.resourceName}
                                  <span className="text-red-500 ml-2">
                                    与「{conflict.conflictingReservationTitle}」冲突
                                  </span>
                                  <p className="text-xs text-red-600 mt-0.5">
                                    重叠时间：{formatDateTime(conflict.overlappingTime.start)} - {formatDateTime(conflict.overlappingTime.end)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end space-x-3">
                    <button
                      onClick={() => { setShowRejectModal(reservation.id); setRejectReason(''); }}
                      disabled={actionLoading === reservation.id}
                      className="inline-flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === reservation.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 mr-2" />
                          拒绝
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleApprove(reservation)}
                      disabled={actionLoading === reservation.id || hasConflict}
                      className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                        hasConflict
                          ? 'bg-gray-300 text-gray-500'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {actionLoading === reservation.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          {hasConflict ? '存在冲突' : '批准'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">审批已全部处理完毕</h3>
            <p className="text-gray-500">当前没有待审批的预约</p>
            <Link
              href="/reservations"
              className="inline-flex items-center mt-4 px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              查看所有预约
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
