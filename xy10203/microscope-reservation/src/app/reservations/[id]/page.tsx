'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Microscope,
  FileText,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Loader2,
  History,
  Edit2,
  Trash2
} from 'lucide-react';
import { ReservationWithDetails, OperationLog } from '@/lib/types';
import { getStatusLabel, getAccessoryTypeLabel, getActionLabel } from '@/lib/client-utils';
import { formatDateTime } from '@/lib/utils';

interface PageProps {
  params: { id: string };
}

export default function ReservationDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationWithDetails | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [params.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [reservationRes, logsRes] = await Promise.all([
        fetch(`/api/reservations?id=${params.id}`),
        fetch(`/api/reservations/${params.id}/logs`)
      ]);

      if (!reservationRes.ok) {
        throw new Error('预约不存在');
      }

      const reservationData = await reservationRes.json();
      const logsData = await logsRes.json();

      setReservation(reservationData);
      setLogs(logsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      setError('加载预约详情失败');
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'approved': return <CheckCircle className="h-5 w-5" />;
      case 'pending': return <Clock className="h-5 w-5" />;
      case 'rejected': return <XCircle className="h-5 w-5" />;
      case 'cancelled': return <X className="h-5 w-5" />;
      default: return <Calendar className="h-5 w-5" />;
    }
  }

  async function handleApprove() {
    if (!reservation) return;
    setActionLoading(true);
    setError('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservation.id, action: 'approve' })
      });

      if (response.ok) {
        setToast({ type: 'success', message: '预约已批准！' });
        loadData();
      } else {
        const errorData = await response.json();
        if (errorData.errorType === 'ConflictError') {
          setError(`审批失败：${errorData.error}，存在资源冲突`);
        } else {
          setError(errorData.error || '审批失败');
        }
      }
    } catch (error) {
      console.error('审批失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!reservation || !rejectReason.trim()) {
      setError('请填写拒绝原因');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reservation.id,
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
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!reservation) return;
    if (!confirm('确定要取消这个预约吗？')) return;

    setActionLoading(true);
    setError('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservation.id, action: 'cancel' })
      });

      if (response.ok) {
        setToast({ type: 'success', message: '预约已取消' });
        loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!reservation) return;
    if (!confirm('确定要删除这个预约吗？此操作不可恢复。')) return;

    setActionLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/reservations?id=${reservation.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setToast({ type: 'success', message: '预约已删除' });
        setTimeout(() => {
          router.push('/reservations');
        }, 1000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">正在加载预约详情...</p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">预约不存在</h2>
          <p className="text-gray-500 mb-4">{error || '该预约记录可能已被删除'}</p>
          <Link
            href="/reservations"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const canApprove = reservation.status === 'pending';
  const canCancel = reservation.status !== 'cancelled' && reservation.status !== 'rejected';
  const canDelete = reservation.status !== 'approved';

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
                  onClick={() => setShowRejectModal(false)}
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
                placeholder="请说明拒绝原因..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
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
              <Link href="/reservations" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <ArrowLeft className="h-5 w-5 mr-2" />
                返回列表
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">预约详情</h1>
                <p className="text-sm text-gray-500">预约编号: {reservation.id.slice(0, 8)}</p>
              </div>
            </div>
            <div className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-medium ${getStatusColor(reservation.status)}`}>
              {getStatusIcon(reservation.status)}
              <span className="ml-2">{getStatusLabel(reservation.status)}</span>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center">
                  <Microscope className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">设备信息</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">显微镜</h3>
                  <p className="text-lg font-medium text-gray-900">{reservation.microscope_name}</p>
                </div>

                {reservation.accessories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">已选附件</h3>
                    <div className="space-y-3">
                      {['magnification', 'sample_stage'].map((type) => {
                        const accessories = reservation.accessories.filter(a => a.type === type);
                        if (accessories.length === 0) return null;
                        return (
                          <div key={type}>
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                              {getAccessoryTypeLabel(type)}
                            </span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {accessories.map((acc) => (
                                <span
                                  key={acc.id}
                                  className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg"
                                >
                                  {acc.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">预约时间</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">开始时间</h3>
                    <p className="text-gray-900">{formatDateTime(reservation.start_time)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">结束时间</h3>
                    <p className="text-gray-900">{formatDateTime(reservation.end_time)}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    预约时长：{Math.round((new Date(reservation.end_time).getTime() - new Date(reservation.start_time).getTime()) / 60000)} 分钟
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">预约信息</h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">预约人</h3>
                    <p className="text-gray-900 font-medium">{reservation.user_name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">所属课题组</h3>
                    <p className="text-gray-900 font-medium">{reservation.group_name}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">实验目的</h3>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{reservation.purpose}</p>
                </div>
              </div>
            </div>

            {reservation.rejection_reason && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                <div className="flex items-start">
                  <XCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-red-800">拒绝原因</h3>
                    <p className="mt-1 text-red-700">{reservation.rejection_reason}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center">
                  <History className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">操作历史</h2>
                </div>
              </div>
              <div className="divide-y">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={log.id} className="p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                          {log.action === 'create' && <FileText className="h-4 w-4 text-gray-600" />}
                          {log.action === 'update' && <Edit2 className="h-4 w-4 text-gray-600" />}
                          {log.action === 'approve' && <CheckCircle className="h-4 w-4 text-green-600" />}
                          {log.action === 'reject' && <XCircle className="h-4 w-4 text-red-600" />}
                          {log.action === 'cancel' && <X className="h-4 w-4 text-gray-600" />}
                          {!['create', 'update', 'approve', 'reject', 'cancel'].includes(log.action) && (
                            <History className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">
                              {getActionLabel(log.action)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(log.timestamp)}
                            </p>
                          </div>
                          {log.note && (
                            <p className="mt-1 text-sm text-gray-600">{log.note}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p>暂无操作记录</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">操作</h3>
              <div className="space-y-3">
                {canApprove && (
                  <>
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          批准预约
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="h-5 w-5 mr-2" />
                      拒绝预约
                    </button>
                  </>
                )}

                {canCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-5 w-5 mr-2" />
                    取消预约
                  </button>
                )}

                {canDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center px-4 py-2.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-5 w-5 mr-2" />
                    删除预约
                  </button>
                )}

                {!canApprove && !canCancel && !canDelete && (
                  <p className="text-center text-gray-500 text-sm py-4">
                    此预约当前状态下无可执行操作
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">时间线</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-3 h-3 bg-gray-300 rounded-full mt-1.5 mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">创建时间</p>
                    <p className="text-xs text-gray-500">{formatDateTime(reservation.created_at)}</p>
                  </div>
                </div>
                {reservation.submitted_at && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-3 h-3 bg-yellow-500 rounded-full mt-1.5 mr-3"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">提交时间</p>
                      <p className="text-xs text-gray-500">{formatDateTime(reservation.submitted_at)}</p>
                    </div>
                  </div>
                )}
                {reservation.approved_at && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-3 h-3 bg-green-500 rounded-full mt-1.5 mr-3"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">批准时间</p>
                      <p className="text-xs text-gray-500">{formatDateTime(reservation.approved_at)}</p>
                    </div>
                  </div>
                )}
                {reservation.rejected_at && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-3 h-3 bg-red-500 rounded-full mt-1.5 mr-3"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">拒绝时间</p>
                      <p className="text-xs text-gray-500">{formatDateTime(reservation.rejected_at)}</p>
                    </div>
                  </div>
                )}
                {reservation.cancelled_at && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-3 h-3 bg-gray-500 rounded-full mt-1.5 mr-3"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">取消时间</p>
                      <p className="text-xs text-gray-500">{formatDateTime(reservation.cancelled_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
