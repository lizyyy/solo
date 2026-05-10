import { useState, useEffect } from 'react';
import { api } from '../api';
import type { TransferRequest, Toast } from '../types';

interface TransfersPageProps {
  onToast: (type: Toast['type'], message: string) => void;
}

export default function TransfersPage({ onToast }: TransfersPageProps) {
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [rejectModal, setRejectModal] = useState<{ id: string; visible: boolean }>({ id: '', visible: false });
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    setLoading(true);
    const result = await api.getTransferRequests();
    
    if (result.success && result.data) {
      setTransfers(result.data);
    } else {
      onToast('error', result.message || '加载改选申请失败');
    }
    
    setLoading(false);
  };

  const handleApprove = async (requestId: string) => {
    if (!confirm('确定通过这个改选申请吗？')) {
      return;
    }
    
    setProcessing(true);
    const result = await api.approveTransfer(requestId);
    
    if (result.success) {
      onToast('success', result.message || '改选申请已通过');
      loadTransfers();
    } else {
      onToast('error', result.message || '审批失败');
    }
    
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      onToast('warning', '请填写拒绝原因');
      return;
    }
    
    setProcessing(true);
    const result = await api.rejectTransfer(rejectModal.id, rejectReason);
    
    if (result.success) {
      onToast('success', result.message || '改选申请已拒绝');
      setRejectModal({ id: '', visible: false });
      setRejectReason('');
      loadTransfers();
    } else {
      onToast('error', result.message || '拒绝失败');
    }
    
    setProcessing(false);
  };

  const filteredTransfers = transfers.filter(t => {
    if (!filterStatus) return true;
    return t.status === filterStatus;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">🔄 改选申请</h2>
        
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态筛选</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部</option>
                  <option value="pending">待处理</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                </select>
              </div>
            </div>
            <button
              onClick={loadTransfers}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              🔄 刷新
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">
              {transfers.filter(t => t.status === 'pending').length}
            </div>
            <div className="text-sm text-yellow-600">待处理</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-700">
              {transfers.filter(t => t.status === 'approved').length}
            </div>
            <div className="text-sm text-green-600">已通过</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-2xl font-bold text-red-700">
              {transfers.filter(t => t.status === 'rejected').length}
            </div>
            <div className="text-sm text-red-600">已拒绝</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredTransfers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无改选申请
          </div>
        ) : (
          <div className="divide-y">
            {filteredTransfers.map(transfer => (
              <div key={transfer.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getStatusStyle(transfer.status)}`}>
                        {transfer.statusText}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(transfer.requestedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="text-gray-800">
                      <span className="font-medium">{transfer.studentName}</span>
                      <span className="text-gray-500 text-sm ml-2">({transfer.studentClass})</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-red-600">❌ {transfer.fromCourseName}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-600">✅ {transfer.toCourseName}</span>
                    </div>
                    {transfer.rejectReason && (
                      <div className="mt-2 text-sm text-red-600">
                        拒绝原因：{transfer.rejectReason}
                      </div>
                    )}
                    {transfer.processedAt && (
                      <div className="mt-1 text-xs text-gray-400">
                        处理时间：{new Date(transfer.processedAt).toLocaleString('zh-CN')}
                      </div>
                    )}
                  </div>
                  {transfer.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(transfer.id)}
                        disabled={processing}
                        className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:bg-gray-300"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => setRejectModal({ id: transfer.id, visible: true })}
                        disabled={processing}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:bg-gray-300"
                      >
                        拒绝
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectModal.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-4 py-3 border-b">
              <h3 className="font-bold text-gray-800">拒绝改选申请</h3>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                请填写拒绝原因（必填）
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="例如：目标课程名额已满 / 年级不符合要求 / 时段冲突..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-4 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setRejectModal({ id: '', visible: false });
                    setRejectReason('');
                  }}
                  disabled={processing}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || processing}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {processing ? '处理中...' : '确认拒绝'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
