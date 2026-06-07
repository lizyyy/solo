import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  X,
  Check,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  MapPin,
  User,
  MessageSquare,
} from 'lucide-react';
import { useAppStore } from '../store';
import { labelMap } from '../data/mockData';
import type { ReviewTask } from '../types';

export default function Review() {
  const { reviewTasks, reviewTask, points, notices } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [reviewOpinion, setReviewOpinion] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const pendingTasks = reviewTasks.filter(t => t.status === 'pending');
  const filteredTasks = reviewTasks.filter(t => filter === 'all' || t.status === filter);

  const handleReview = (status: 'approved' | 'rejected') => {
    if (selectedTask && reviewOpinion) {
      reviewTask(selectedTask.id, status, reviewOpinion);
      setSelectedTask(null);
      setReviewOpinion('');
    }
  };

  const getTaskPoint = (pointId: string) => points.find(p => p.id === pointId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-800">复核中心</h2>
          <p className="text-slate-500 text-sm mt-1">居民代表复核异常点位，确保改道同步和数据一致性</p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? '全部' : labelMap.reviewTaskStatus[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{reviewTasks.filter(t => t.status === 'pending').length}</p>
              <p className="text-sm text-slate-500">待复核</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{reviewTasks.filter(t => t.status === 'approved').length}</p>
              <p className="text-sm text-slate-500">已通过</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{reviewTasks.filter(t => t.status === 'rejected').length}</p>
              <p className="text-sm text-slate-500">已退回</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredTasks.map((task) => {
          const point = getTaskPoint(task.pointId);
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card p-5 ${task.status === 'pending' ? 'border-l-4 border-l-amber-400' : task.status === 'approved' ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-rose-400'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className={`w-5 h-5 ${task.status === 'pending' ? 'text-amber-500' : task.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <h3 className="font-semibold text-slate-800">{task.pointName}</h3>
                    <span className={`tag-${task.type === 'detour_not_synced' ? 'rose' : 'amber'}`}>
                      {labelMap.reviewTaskType[task.type]}
                    </span>
                    <span className={`tag-${task.status === 'pending' ? 'amber' : task.status === 'approved' ? 'emerald' : 'rose'}`}>
                      {labelMap.reviewTaskStatus[task.status]}
                    </span>
                  </div>

                  <p className="text-slate-600 mb-4">{task.description}</p>

                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>指派人：{task.assigneeName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>创建时间：{new Date(task.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    {task.reviewedAt && (
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        <span>复核时间：{new Date(task.reviewedAt).toLocaleString('zh-CN')}</span>
                      </div>
                    )}
                  </div>

                  {task.reviewerOpinion && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                        <MessageSquare className="w-4 h-4" />
                        <span>复核意见</span>
                      </div>
                      <p className="text-slate-700">{task.reviewerOpinion}</p>
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="btn-primary"
                    >
                      去复核
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {selectedTask && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedTask(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl font-semibold text-slate-800">点位复核</h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-slate-500">点位名称</label>
                <p className="text-slate-800 font-medium">{selectedTask.pointName}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500">问题类型</label>
                <p className="text-slate-800">
                  <span className="tag-rose">{labelMap.reviewTaskType[selectedTask.type]}</span>
                </p>
              </div>
              <div>
                <label className="text-sm text-slate-500">问题描述</label>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{selectedTask.description}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500 mb-2 block">相关信息</label>
                <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                  <p className="text-sm text-blue-800">⚠️ 施工临时改道未同步到地图</p>
                  <p className="text-sm text-blue-700">请居民代表现场确认改道路线是否正确，确认后标记已同步。</p>
                  <p className="text-sm text-blue-600">如改道方案有问题，请退回给街道规划员小姜处理。</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-500 mb-2 block">复核意见 *</label>
                <textarea
                  value={reviewOpinion}
                  onChange={(e) => setReviewOpinion(e.target.value)}
                  className="input-field resize-none h-24"
                  placeholder="请输入复核意见，说明现场情况..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedTask(null)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={() => handleReview('rejected')}
                disabled={!reviewOpinion}
                className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                复核不通过
              </button>
              <button
                onClick={() => handleReview('approved')}
                disabled={!reviewOpinion}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                复核通过
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
