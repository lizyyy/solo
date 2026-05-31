import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Copy, RotateCcw, GitBranch, User, Clock, FileText } from 'lucide-react';
import ChangeTimeline from '@/components/timeline/ChangeTimeline';
import StatusBadge from '@/components/common/StatusBadge';
import { useRecordStore } from '@/store/useRecordStore';
import { formatDate } from '@/utils/export';
import { RecordStatus, TYPE_LABELS } from '@/types';

const RecordDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const record = useRecordStore((state) =>
    state.records.find((r) => r.id === id)
  );
  const recordHistory = useRecordStore((state) =>
    state.getRecordHistory(id || '')
  );
  const updateRecordStatus = useRecordStore((state) => state.updateRecordStatus);
  const currentUser = useRecordStore((state) => state.currentUser);

  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<RecordStatus | null>(null);
  const [reason, setReason] = useState('');

  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">记录不存在</p>
        <Link
          to="/"
          className="text-blue-600 hover:text-blue-800"
        >
          返回列表
        </Link>
      </div>
    );
  }

  const actions: { type: RecordStatus; label: string; icon: React.ElementType; color: string }[] = [
    { type: 'approved', label: '通过', icon: Check, color: 'bg-green-600 hover:bg-green-700' },
    { type: 'rejected', label: '驳回', icon: X, color: 'bg-red-600 hover:bg-red-700' },
    { type: 'duplicate', label: '标记重复', icon: Copy, color: 'bg-gray-600 hover:bg-gray-700' },
    { type: 'pending', label: '退回待处理', icon: RotateCcw, color: 'bg-orange-600 hover:bg-orange-700' },
  ];

  const handleAction = (type: RecordStatus) => {
    setActionType(type);
    setShowActionModal(true);
    setReason('');
  };

  const confirmAction = () => {
    if (actionType && reason.trim()) {
      updateRecordStatus(record.id, actionType, reason);
      setShowActionModal(false);
      setActionType(null);
      setReason('');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <h2 className="text-lg font-semibold text-gray-900">记录详情</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              基本信息
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  记录ID
                </label>
                <p className="text-sm text-gray-900 font-mono">{record.id}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  状态
                </label>
                <StatusBadge status={record.status} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  来源
                </label>
                <p className="text-sm text-gray-900">{record.source}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  类型
                </label>
                <p className="text-sm text-gray-900">{TYPE_LABELS[record.type]}</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  内容
                </label>
                <p className="text-sm text-gray-900 bg-gray-50 rounded p-3">
                  {record.content}
                </p>
              </div>
              {record.pendingReason && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    待处理原因
                  </label>
                  <p className="text-sm text-orange-700 bg-orange-50 rounded p-3">
                    {record.pendingReason}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  创建时间
                </label>
                <p className="text-sm text-gray-600">{formatDate(record.createdAt)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  更新时间
                </label>
                <p className="text-sm text-gray-600">{formatDate(record.updatedAt)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  处理人
                </label>
                <p className="text-sm text-gray-900 flex items-center gap-1">
                  <User className="w-4 h-4 text-gray-400" />
                  {record.handlerName || '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              来源链路
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded p-3">
              {record.sourceChain.split(' → ').map((step, index, arr) => (
                <React.Fragment key={index}>
                  <span className="px-2 py-1 bg-white rounded border border-gray-200">
                    {step}
                  </span>
                  {index < arr.length - 1 && (
                    <span className="text-gray-400">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              变更历史
            </h3>
            <ChangeTimeline history={recordHistory} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">操作</h3>
            <div className="space-y-2">
              {actions.map((action) => {
                const Icon = action.icon;
                const isDisabled = record.status === action.type;
                return (
                  <button
                    key={action.type}
                    onClick={() => handleAction(action.type)}
                    disabled={isDisabled || !currentUser}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-sm text-white transition-colors ${
                      isDisabled
                        ? 'bg-gray-300 cursor-not-allowed'
                        : action.color
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">操作提示</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• 所有操作都会记录变更历史</li>
              <li>• 必须填写操作原因才能执行</li>
              <li>• 来源信息不可修改，只能追溯</li>
            </ul>
          </div>
        </div>
      </div>

      {showActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">确认操作</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要将记录状态变更吗？请填写操作原因：
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入操作原因..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmAction}
                disabled={!reason.trim()}
                className="px-4 py-2 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordDetail;
