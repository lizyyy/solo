import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  MessageSquare,
  Thermometer,
  ExternalLink,
  RefreshCw,
  Send,
  Eye,
} from 'lucide-react';
import type { TemperatureRecord, SafetyThreshold, Equipment, ReviewTask } from '@/types';
import { useReviewStore } from '@/store/useReviewStore';
import { useRecordStore } from '@/store/useRecordStore';
import { useThresholdStore } from '@/store/useThresholdStore';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatDateShort } from '@/utils/helpers';

export function Review() {
  const navigate = useNavigate();
  const tasks = useReviewStore(state => state.tasks);
  const approveTask = useReviewStore(state => state.approveTask);
  const rejectTask = useReviewStore(state => state.rejectTask);
  const resetToMock = useReviewStore(state => state.resetToMock);
  const getRecordById = useRecordStore(state => state.getRecordById);
  const updateRecord = useRecordStore(state => state.updateRecord);
  const getThresholdById = useThresholdStore(state => state.getThresholdById);
  const getEquipmentById = useEquipmentStore(state => state.getEquipmentById);

  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const filteredTasks = tasks.filter(t => filter === 'all' ? true : t.status === filter);

  const handleApprove = () => {
    if (!selectedTask || !reviewComment.trim()) return;
    
    approveTask(selectedTask.id, 'user-002', reviewComment);
    updateRecord(
      selectedTask.recordId,
      { reviewReason: reviewComment, status: 'normal' },
      'user-002',
      '设备工程师小王',
      reviewComment
    );
    
    setSelectedTask(null);
    setReviewComment('');
  };

  const handleReject = () => {
    if (!selectedTask || !reviewComment.trim()) return;
    
    rejectTask(selectedTask.id, 'user-002', reviewComment);
    updateRecord(
      selectedTask.recordId,
      { reviewReason: reviewComment, status: 'error' },
      'user-002',
      '设备工程师小王',
      reviewComment
    );
    
    setSelectedTask(null);
    setReviewComment('');
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">复核工作台</h1>
          <p className="text-gray-500 mt-1">
            处理人工修改系数的复核任务，确保数据准确性
          </p>
        </div>
        <button
          onClick={resetToMock}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重置数据
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="待复核"
          value={pendingTasks.length}
          bgColor="bg-amber-50"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
          label="已通过"
          value={tasks.filter(t => t.status === 'approved').length}
          bgColor="bg-green-50"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          label="已驳回"
          value={tasks.filter(t => t.status === 'rejected').length}
          bgColor="bg-red-50"
        />
        <StatCard
          icon={<ClipboardCheck className="w-5 h-5 text-primary-500" />}
          label="全部任务"
          value={tasks.length}
          bgColor="bg-blue-50"
        />
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-96 flex flex-col gap-4 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2">
              {(['pending', 'all', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'pending' && '待处理'}
                  {f === 'all' && '全部'}
                  {f === 'approved' && '已通过'}
                  {f === 'rejected' && '已驳回'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold text-gray-800">任务列表</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <ClipboardCheck className="w-12 h-12 mb-2 text-gray-300" />
                  <p className="text-sm">暂无任务</p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const record = getRecordById(task.recordId);
                  return (
                    <button
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setReviewComment('');
                      }}
                      className={`w-full p-4 border-b text-left transition-colors ${
                        selectedTask?.id === task.id
                          ? 'bg-primary-50 border-primary-200'
                          : 'hover:bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-gray-800">
                          {record?.temperature}°C
                        </span>
                        <StatusBadge status={record?.status || 'normal'} />
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        分配给：{task.assigneeName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {formatDateShort(task.createdAt)}
                        </span>
                        {record?.manualCoefficient && (
                          <span className="text-xs font-mono text-amber-600">
                            ×{record.manualCoefficient}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
          {selectedTask ? (
            <ReviewDetail
              task={selectedTask}
              reviewComment={reviewComment}
              onCommentChange={setReviewComment}
              onApprove={handleApprove}
              onReject={handleReject}
              getRecordById={getRecordById}
              getThresholdById={getThresholdById}
              getEquipmentById={getEquipmentById}
              navigate={navigate}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">请选择一个复核任务</p>
                <p className="text-sm mt-1">从左侧列表选择待处理的任务</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewDetail({
  task,
  reviewComment,
  onCommentChange,
  onApprove,
  onReject,
  getRecordById,
  getThresholdById,
  getEquipmentById,
  navigate,
}: {
  task: ReviewTask;
  reviewComment: string;
  onCommentChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  getRecordById: (id: string) => TemperatureRecord | undefined;
  getThresholdById: (id: string) => SafetyThreshold | undefined;
  getEquipmentById: (id: string) => Equipment | undefined;
  navigate: (path: string) => void;
}) {
  const record = getRecordById(task.recordId);
  const threshold = record ? getThresholdById(record.thresholdId) : undefined;
  const equipment = record ? getEquipmentById(record.equipmentId) : undefined;

  const isProcessed = task.status !== 'pending';

  return (
    <>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">复核详情</h3>
            <p className="text-sm text-gray-500 mt-1">
              任务ID: {task.id}
            </p>
          </div>
          <StatusBadge status={record?.status || 'normal'} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">实测温度</p>
            <p className="text-2xl font-bold font-mono text-gray-800">
              {record?.temperature}°C
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs text-amber-600 mb-1">人工系数</p>
            <p className="text-2xl font-bold font-mono text-amber-700">
              ×{record?.manualCoefficient}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">修正后温度</p>
            <p className="text-2xl font-bold font-mono text-primary-600">
              {record && record.manualCoefficient
                ? (record.temperature * record.manualCoefficient).toFixed(1)
                : record?.temperature}°C
            </p>
          </div>
        </div>

        {record?.remark && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-600 font-medium mb-1">训练教练老唐的备注</p>
            <p className="text-sm text-blue-800">{record.remark}</p>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">溯源信息</h4>
          
          <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium mb-1">安全阈值表</p>
                <p className="text-sm font-mono text-amber-800">
                  {threshold?.thresholdCode || '未关联'}
                </p>
                <p className="text-xs text-amber-600 mt-1">{threshold?.description}</p>
              </div>
              <button
                onClick={() => navigate('/thresholds')}
                className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
              >
                查看 <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-amber-200">
              <div>
                <p className="text-xs text-amber-500">最低</p>
                <p className="text-sm font-mono text-amber-700">{threshold?.minTemp}°C</p>
              </div>
              <div>
                <p className="text-xs text-amber-500">预警</p>
                <p className="text-sm font-mono text-amber-700">{threshold?.warningTemp}°C</p>
              </div>
              <div>
                <p className="text-xs text-amber-500">最高</p>
                <p className="text-sm font-mono text-amber-700">{threshold?.maxTemp}°C</p>
              </div>
            </div>
          </div>

          <div className="p-4 border border-green-200 bg-green-50 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium mb-1">设备铭牌参数</p>
                <p className="text-sm text-green-800">{equipment?.equipmentName}</p>
                <p className="text-xs text-green-600 mt-1 font-mono">{equipment?.equipmentCode}</p>
              </div>
              <button
                onClick={() => navigate('/equipment')}
                className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800"
              >
                查看 <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-green-200">
              <div>
                <p className="text-xs text-green-500">型号</p>
                <p className="text-sm font-mono text-green-700">{equipment?.model}</p>
              </div>
              <div>
                <p className="text-xs text-green-500">精度</p>
                <p className="text-sm font-mono text-green-700">±{equipment?.accuracy}°C</p>
              </div>
            </div>
          </div>
        </div>

        {record?.reviewReason && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">已填写修改原因</p>
                <p className="text-sm text-green-700 mt-1">{record.reviewReason}</p>
              </div>
            </div>
          </div>
        )}

        {!record?.reviewReason && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">未填写修改原因</p>
                <p className="text-sm text-red-700 mt-1">
                  训练教练老唐修改了人工系数但未填写原因，需要您复核确认
                </p>
              </div>
            </div>
          </div>
        )}

        {!isProcessed && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              复核意见（必填）
            </label>
            <textarea
              value={reviewComment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="请输入复核意见，说明通过或驳回的原因..."
              className="w-full p-4 border border-gray-200 rounded-xl text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        )}

        {isProcessed && task.reviewComment && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-2">
              {task.status === 'approved' ? '通过意见' : '驳回意见'}
            </p>
            <p className="text-sm text-gray-700">{task.reviewComment}</p>
            <p className="text-xs text-gray-400 mt-2">
              由 {task.reviewedBy === 'user-002' ? '设备工程师小王' : task.reviewedBy} 于{' '}
              {task.reviewedAt && formatDate(task.reviewedAt)} 处理
            </p>
          </div>
        )}
      </div>

      {!isProcessed && (
        <div className="p-6 border-t flex items-center justify-end gap-3">
          <button
            onClick={onReject}
            disabled={!reviewComment.trim()}
            className="px-6 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            驳回
          </button>
          <button
            onClick={onApprove}
            disabled={!reviewComment.trim()}
            className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            通过
          </button>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-5`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}
