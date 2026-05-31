import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Edit,
  ChevronRight,
  Filter,
  Search,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge, SourceBadge } from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { formatDateTime } from '@/utils';
import type { RecordStatus, RecordSource } from '@/types';

export default function Review() {
  const navigate = useNavigate();
  const records = useAppStore(state => state.records);
  const updateRecordStatus = useAppStore(state => state.updateRecordStatus);
  const updateRecord = useAppStore(state => state.updateRecord);
  const currentUser = useAppStore(state => state.currentUser);

  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<RecordStatus>('completed');
  const [reviewReason, setReviewReason] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<RecordSource | 'all'>('all');
  const [editPendingReason, setEditPendingReason] = useState('');
  const [showEditReasonModal, setShowEditReasonModal] = useState(false);

  const pendingRecords = useMemo(() => {
    let filtered = records.filter(r =>
      r.status === 'pending' || r.status === 'error'
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(r => r.source === sourceFilter);
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      filtered = filtered.filter(r =>
        r.stockCode.toLowerCase().includes(kw) ||
        r.interfaceName.toLowerCase().includes(kw) ||
        r.operator.toLowerCase().includes(kw)
      );
    }

    return filtered.sort((a, b) => {
      const priority = { error: 0, pending: 1 };
      const priorityDiff = priority[a.status] - priority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [records, statusFilter, sourceFilter, searchKeyword]);

  const handleQuickReview = (recordId: string, status: RecordStatus, reason: string) => {
    updateRecordStatus(recordId, status, reason);
  };

  const handleOpenReview = (recordId: string) => {
    setSelectedRecord(recordId);
    const record = records.find(r => r.id === recordId);
    setEditPendingReason(record?.pendingReason || '');
    setShowReviewModal(true);
    setReviewStatus('completed');
    setReviewReason('');
  };

  const handleSubmitReview = () => {
    if (!selectedRecord || !reviewReason.trim()) {
      alert('请填写复核原因');
      return;
    }

    if (editPendingReason && reviewStatus === 'pending') {
      updateRecord(selectedRecord, { pendingReason: editPendingReason }, reviewReason);
    } else {
      updateRecordStatus(selectedRecord, reviewStatus, reviewReason);
    }

    setShowReviewModal(false);
    setSelectedRecord(null);
  };

  const getPriorityLabel = (status: string) => {
    if (status === 'error') return { label: '高优先级', color: 'text-red-400 bg-red-500/10' };
    return { label: '普通', color: 'text-amber-400 bg-amber-500/10' };
  };

  const statistics = useMemo(() => ({
    total: pendingRecords.length,
    error: pendingRecords.filter(r => r.status === 'error').length,
    pending: pendingRecords.filter(r => r.status === 'pending').length,
  }), [pendingRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">复核修正</h1>
          <p className="mt-1 text-slate-400 text-sm">
            处理待复核的库存预占释放记录
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-slate-400">异常: <span className="text-red-400 font-medium">{statistics.error}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-400">待处理: <span className="text-amber-400 font-medium">{statistics.pending}</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索库存编码、接口名称、操作人..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="all">全部状态</option>
              <option value="pending">待处理</option>
              <option value="error">异常</option>
            </select>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="all">全部来源</option>
              <option value="api_doc">接口文档</option>
              <option value="call_log">调用日志</option>
              <option value="manual">手动创建</option>
            </select>
          </div>
        </div>
      </div>

      {pendingRecords.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">太棒了！</p>
          <p className="text-slate-400 text-sm">当前没有待复核的记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRecords.map(record => {
            const priority = getPriorityLabel(record.status);
            return (
              <div
                key={record.id}
                className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <StatusBadge status={record.status} />
                      <SourceBadge source={record.source} />
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>
                        {priority.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <div>
                        <p className="text-slate-500 text-xs">库存编码</p>
                        <p className="text-white font-mono">{record.stockCode}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">接口名称</p>
                        <p className="text-white font-mono">{record.interfaceName}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">操作人</p>
                        <p className="text-white">{record.operator}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">预占/释放</p>
                        <p className="text-white font-mono">{record.preOccupyQty} / {record.releaseQty}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">创建时间</p>
                        <p className="text-slate-300 text-sm">{formatDateTime(record.createdAt)}</p>
                      </div>
                    </div>

                    {record.pendingReason && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-amber-400 text-xs font-medium mb-1">待处理原因</p>
                        <p className="text-amber-300 text-sm">{record.pendingReason}</p>
                      </div>
                    )}

                    {!record.idempotentValid && (
                      <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-xs font-medium mb-1">幂等键失效</p>
                        <p className="text-red-300 text-sm">
                          {record.idempotentInvalidReason || '未知原因'} · 重试 {record.idempotentRetryCount || 0} 次
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/records/${record.id}`)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenReview(record.id)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="复核处理"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <button
                        onClick={() => handleQuickReview(record.id, 'completed', '快速复核通过')}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        通过
                      </button>
                      <button
                        onClick={() => handleQuickReview(record.id, 'processing', '标记为处理中')}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        处理中
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="复核处理"
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">库存编码：</span>
                  <span className="text-white font-mono">{records.find(r => r.id === selectedRecord)?.stockCode}</span>
                </div>
                <div>
                  <span className="text-slate-500">接口名称：</span>
                  <span className="text-white font-mono">{records.find(r => r.id === selectedRecord)?.interfaceName}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1">复核结果</label>
              <div className="grid grid-cols-3 gap-2">
                {(['completed', 'processing', 'error'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setReviewStatus(status)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      reviewStatus === status
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <StatusBadge status={status} size="sm" />
                  </button>
                ))}
              </div>
            </div>

            {reviewStatus === 'pending' && (
              <div>
                <label className="block text-slate-400 text-sm mb-1">修改待处理原因</label>
                <textarea
                  value={editPendingReason}
                  onChange={e => setEditPendingReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  rows={3}
                  placeholder="请输入待处理原因"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-sm mb-1">复核原因 *</label>
              <textarea
                value={reviewReason}
                onChange={e => setReviewReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                rows={3}
                placeholder="请详细说明复核原因和处理意见"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitReview}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
              >
                确认复核
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
