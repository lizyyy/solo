import React, { useState } from 'react';
import { Feedback, FeedbackType } from '../types';
import { useAppContext } from '../context/AppContext';

interface FeedbackListProps {
  pointId: string;
  feedbacks: Feedback[];
}

const typeLabels: Record<FeedbackType, { label: string; color: string }> = {
  complaint: { label: '投诉', color: 'bg-red-100 text-red-700' },
  suggestion: { label: '建议', color: 'bg-blue-100 text-blue-700' },
  info: { label: '信息', color: 'bg-green-100 text-green-700' }
};

export default function FeedbackList({ pointId, feedbacks }: FeedbackListProps) {
  const { addFeedback } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    residentName: '',
    content: '',
    type: 'info' as FeedbackType
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedback.residentName || !newFeedback.content) return;

    addFeedback({
      id: `fb-${Date.now()}`,
      pointId,
      ...newFeedback,
      createdAt: new Date().toISOString()
    });

    setNewFeedback({ residentName: '', content: '', type: 'info' });
    setShowForm(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">居民反馈记录</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {showForm ? '取消' : '+ 添加反馈'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">反馈人</label>
              <input
                type="text"
                value={newFeedback.residentName}
                onChange={(e) => setNewFeedback(prev => ({ ...prev, residentName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">类型</label>
              <select
                value={newFeedback.type}
                onChange={(e) => setNewFeedback(prev => ({ ...prev, type: e.target.value as FeedbackType }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="info">信息</option>
                <option value="suggestion">建议</option>
                <option value="complaint">投诉</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">内容</label>
              <textarea
                value={newFeedback.content}
                onChange={(e) => setNewFeedback(prev => ({ ...prev, content: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入反馈内容"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              提交反馈
            </button>
          </div>
        </form>
      )}

      {feedbacks.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          暂无反馈记录
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(fb => (
            <div key={fb.id} className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${typeLabels[fb.type].color}`}>
                    {typeLabels[fb.type].label}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{fb.residentName}</span>
                </div>
                <span className="text-xs text-slate-400">{formatDate(fb.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{fb.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
