import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  X,
  MessageSquare,
  Music,
  FileImage,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate } from '../utils/boundaryRules';
import { ReviewStatus } from '../types';

export default function Review() {
  const navigate = useNavigate();
  const reviewTasks = useStore((state) => state.reviewTasks);
  const updateReviewTask = useStore((state) => state.updateReviewTask);
  const updateRecord = useStore((state) => state.updateRecord);
  const getRecordById = useStore((state) => state.getRecordById);
  const getTrackById = useStore((state) => state.getTrackById);
  const getContractById = useStore((state) => state.getContractById);
  const currentUser = useStore((state) => state.currentUser);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const filteredTasks = reviewTasks.filter((t) => {
    if (filter === 'all') return true;
    return t.reviewStatus === filter;
  });

  const handleReview = (taskId: string, recordId: string, status: ReviewStatus) => {
    updateReviewTask(taskId, {
      reviewStatus: status,
      reviewComment,
      reviewedBy: currentUser.name,
      reviewedAt: new Date(),
    });

    if (status === 'approved') {
      updateRecord(recordId, { status: 'reviewed' }, currentUser.name);
    }

    setReviewComment('');
    setExpandedId(null);
  };

  const getStatusTag = (status: ReviewStatus) => {
    switch (status) {
      case 'pending':
        return <span className="tag tag-pending">待复核</span>;
      case 'approved':
        return <span className="tag tag-approved">已通过</span>;
      case 'rejected':
        return <span className="tag tag-rejected">已驳回</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary-800">
          异常复核工作台
        </h1>
        <p className="text-gray-600 mt-1">
          处理含返工原因的轨道记录，复核后决定是否归入正常统计
        </p>
      </div>

      <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-danger-800">返工原因判定规则</p>
          <p className="text-xs text-danger-700 mt-0.5">
            轨道备注中包含「返工、重录、补录、修正、重新」关键词时，系统自动标记为待复核，
            不归入正常统计。版权运营复核通过后，可归入正常统计。
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'all', label: '全部', count: reviewTasks.length },
          { key: 'pending', label: '待复核', count: reviewTasks.filter((t) => t.reviewStatus === 'pending').length },
          { key: 'approved', label: '已通过', count: reviewTasks.filter((t) => t.reviewStatus === 'approved').length },
          { key: 'rejected', label: '已驳回', count: reviewTasks.filter((t) => t.reviewStatus === 'rejected').length },
        ].map((item) => (
          <button
            key={item.key}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === item.key
                ? 'bg-primary-700 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
            onClick={() => setFilter(item.key as typeof filter)}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredTasks.map((task) => {
          const record = getRecordById(task.recordId);
          const track = record ? getTrackById(record.trackId) : undefined;
          const contract = record ? getContractById(record.contractId) : undefined;
          const isExpanded = expandedId === task.id;

          if (!record) return null;

          return (
            <div key={task.id} className="card">
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusTag(task.reviewStatus)}
                    <span className="text-sm font-medium text-primary-800">
                      {record.personName}
                    </span>
                    <span className="text-sm text-gray-500">
                      {track?.trackName || '未知曲目'}
                    </span>
                  </div>
                  <p className="text-sm text-amber-700 bg-amber-50 inline-block px-2 py-1 rounded">
                    🚨 {task.reworkReason}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {task.reviewedAt && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        复核人：{task.reviewedBy}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(task.reviewedAt)}
                      </p>
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        轨道备注
                      </h4>
                      <div className="remark-preserve text-sm text-gray-700">
                        {record.trackRemark}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <Music className="w-3.5 h-3.5" />
                        关联曲目
                      </h4>
                      <p className="text-sm text-gray-700">
                        {track?.trackName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        别名：{track?.aliasName}
                      </p>
                      <button
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/aliases');
                        }}
                      >
                        查看曲目别名表 →
                      </button>
                    </div>
                  </div>

                  {contract && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <FileImage className="w-3.5 h-3.5" />
                        关联合同截图
                      </h4>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-16 rounded overflow-hidden bg-primary-100 flex-shrink-0">
                          <img
                            src={contract.fileUrl}
                            alt={contract.fileName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 truncate">
                            {contract.fileName}
                          </p>
                          <button
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/contracts');
                            }}
                          >
                            查看合同页截图 →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {task.reviewStatus === 'pending' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">
                          复核意见
                        </label>
                        <textarea
                          className="textarea-field text-sm"
                          rows={2}
                          placeholder="请输入复核意见..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-success flex items-center gap-2 text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReview(task.id, task.recordId, 'approved');
                          }}
                        >
                          <Check className="w-4 h-4" />
                          复核通过，归入正常统计
                        </button>
                        <button
                          className="btn-danger flex items-center gap-2 text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReview(task.id, task.recordId, 'rejected');
                          }}
                        >
                          <X className="w-4 h-4" />
                          驳回，保留异常标记
                        </button>
                      </div>
                    </div>
                  )}

                  {task.reviewComment && (
                    <div className="p-3 bg-primary-50 rounded-lg">
                      <h4 className="text-xs font-medium text-primary-700 mb-1">
                        复核意见
                      </h4>
                      <p className="text-sm text-primary-800">{task.reviewComment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
