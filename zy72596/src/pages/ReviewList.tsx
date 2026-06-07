import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, AlertTriangle, List, FileText, BookOpen, User, LayoutGrid } from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Review, ReviewStatus } from '@/types';
import { formatDate } from '@/utils/common';
import clsx from 'clsx';

const statusFilters: Array<{ value: ReviewStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'in_progress', label: '进行中' },
  { value: 'pending_review', label: '待复核' },
  { value: 'completed', label: '已完成' },
];

export function ReviewList() {
  const navigate = useNavigate();
  const reviews = useReviewStore(s => s.reviews);
  const viewMode = useReviewStore(s => s.viewMode);
  const setViewMode = useReviewStore(s => s.setViewMode);
  const createReview = useReviewStore(s => s.createReview);
  const loadReviewDetail = useReviewStore(s => s.loadReviewDetail);

  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const filteredReviews = reviews.filter(
    r => statusFilter === 'all' || r.status === statusFilter
  );

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const review = createReview(newTitle.trim());
    setShowCreateModal(false);
    setNewTitle('');
    navigate(`/review/${review.id}`);
  };

  const handleOpenReview = (id: string) => {
    navigate(`/review/${id}`);
  };

  const pendingCount = reviews.filter(r => r.status === 'pending_review').length;

  return (
    <div className="min-h-screen bg-primary-50">
      <header className="bg-white border-b border-primary-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-primary-900 font-mono">
                特征缓存失效复盘
              </h1>
              <p className="text-sm text-primary-500 mt-0.5">
                每一条结论都能追溯到原始证据
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-primary-100 rounded p-0.5">
                <button
                  onClick={() => setViewMode('standard')}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                    viewMode === 'standard'
                      ? 'bg-white text-primary-800 shadow-sm'
                      : 'text-primary-500 hover:text-primary-700'
                  )}
                >
                  <List size={14} className="inline mr-1.5" />
                  标准视图
                </button>
                <button
                  onClick={() => setViewMode('summary')}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                    viewMode === 'summary'
                      ? 'bg-white text-primary-800 shadow-sm'
                      : 'text-primary-500 hover:text-primary-700'
                  )}
                >
                  <FileText size={14} className="inline mr-1.5" />
                  会前摘要
                </button>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus size={16} />
                新建复盘
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {statusFilters.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded whitespace-nowrap transition-colors',
                statusFilter === f.value
                  ? 'bg-primary-800 text-white'
                  : 'bg-white border border-primary-200 text-primary-600 hover:bg-primary-50'
              )}
            >
              {f.label}
              {f.value === 'pending_review' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {viewMode === 'summary' ? (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-primary-800 mb-4 flex items-center gap-2">
                <Clock size={18} />
                会前快速摘要（仅展示结论和待办
              </h2>
              {filteredReviews.length === 0 ? (
                <p className="text-primary-400 text-sm py-8 text-center">暂无复盘记录</p>
              ) : (
                <div className="space-y-4">
                  {filteredReviews.map(review => (
                    <div
                      key={review.id}
                      onClick={() => handleOpenReview(review.id)}
                      className="p-4 border border-primary-100 rounded-sm hover:border-primary-300 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-primary-800">{review.title}</h3>
                        <StatusBadge status={review.status} />
                      </div>
                      {review.hasDefaultScoreIssue && (
                        <div className="flex items-center gap-1.5 text-sm text-orange-600 mb-2">
                          <AlertTriangle size={14} />
                          存在特征缺失给默认分问题，待推荐负责人复核
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredReviews.length === 0 ? (
              <div className="col-span-full card p-12 text-center">
                <FileText size={40} className="mx-auto text-primary-300 mb-3" />
                <p className="text-primary-500 text-sm">暂无复盘记录</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary mt-4"
                >
                  创建第一条复盘
                </button>
              </div>
            ) : (
              filteredReviews.map((review, idx) => (
                <div
                  key={review.id}
                  onClick={() => handleOpenReview(review.id)}
                  className="card p-5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <StatusBadge status={review.status} />
                    {review.hasDefaultScoreIssue && (
                      <span className="text-orange-500" title="存在默认分问题">
                        <AlertTriangle size={16} />
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-primary-800 mb-2 line-clamp-2">
                    {review.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-primary-400 mt-3">
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {review.assignee}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(review.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-primary-100 flex items-center gap-3 text-xs text-primary-500">
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      训练日志
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      阈值笔记
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-primary-900 mb-4">新建复盘记录</h3>
            <label className="label-text">复盘标题</label>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="例如：2024-06-01 特征缓存失效复盘"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTitle('');
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="btn btn-primary"
                disabled={!newTitle.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
