import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Workflow as WorkflowIcon,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Wrench,
  UserCheck,
  FileText,
  User,
  Package,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  UserCheck as UserCheckIcon,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import WorkflowProgress from '../components/WorkflowProgress';
import ManualReviewModal from '../components/ManualReviewModal';
import { cn } from '../lib/utils';

const stepConfig: Record<string, { label: string; icon: any; color: string }> = {
  import: { label: '数据导入', icon: FileText, color: 'bg-primary-500' },
  engineer_review: { label: '工程师复核', icon: Wrench, color: 'bg-warning-500' },
  coach_review: { label: '教练审核', icon: UserCheck, color: 'bg-primary-500' },
  report: { label: '报告生成', icon: FileText, color: 'bg-success-500' },
};

const Workflow = () => {
  const navigate = useNavigate();
  const {
    workflowTasks,
    thresholds,
    getDeviceById,
    currentRole,
    advanceWorkflow,
    getTasksByAssignee,
    getBatchById,
    getManualReviewByThresholdId,
    verifyConsistency,
  } = useThresholdStore();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    thresholdId?: string;
    reviewId?: string;
  }>({ open: false });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const myTasks = getTasksByAssignee(currentRole);
  const pendingTasks = myTasks.filter((t) => t.status === 'pending');
  const inProgressTasks = myTasks.filter((t) => t.status === 'in_progress');
  const completedTasks = myTasks.filter((t) => t.status === 'completed');

  const getTaskThreshold = (taskId: string) => {
    const task = workflowTasks.find((t) => t.id === taskId);
    if (!task) return null;
    return thresholds.find((th) => th.id === task.thresholdId);
  };

  const handleAdvance = (taskId: string, threshold: any) => {
    const review = threshold?.id ? getManualReviewByThresholdId(threshold.id) : undefined;
    const task = workflowTasks.find((t) => t.id === taskId);

    if (
      task?.step === 'coach_review' &&
      review &&
      review.decision === 'pending'
    ) {
      showToast('请先完成人工复核再推进工作流', 'warning');
      return;
    }

    if (
      threshold?.hasUnitMix &&
      review?.decision === 'pending'
    ) {
      const ok = window.confirm(
        '⚠️ 存在未复核的单位混用，按流程应先交教练复核，是否仍推进？'
      );
      if (!ok) return;
    }

    advanceWorkflow(taskId);
    showToast('工作流已推进');
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const TaskCard = ({ task }: { task: typeof myTasks[0] }) => {
    const threshold = getTaskThreshold(task.id);
    const device = threshold ? getDeviceById(threshold.deviceId) : undefined;
    const batch = threshold?.importBatchId ? getBatchById(threshold.importBatchId) : undefined;
    const review = threshold?.id ? getManualReviewByThresholdId(threshold.id) : undefined;
    const consistency = threshold?.id ? verifyConsistency(threshold.id) : null;
    const step = stepConfig[task.step];
    const StepIcon = step.icon;
    const isSelected = selectedTask === task.id;
    const hasPendingReview = review?.decision === 'pending' || threshold?.hasUnitMix;
    const isCoachReviewBlocked =
      task.step === 'coach_review' && review?.decision === 'pending';

    return (
      <div
        className={cn(
          'bg-industrial-600 rounded-xl border transition-all cursor-pointer',
          isSelected ? 'border-primary-500 shadow-lg shadow-primary-500/20' : 'border-industrial-500 hover:border-industrial-400'
        )}
        onClick={() => setSelectedTask(isSelected ? null : task.id)}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', step.color)}>
                <StepIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">{threshold?.name}</p>
                <p className="text-industrial-400 text-sm">{device?.name}</p>
                {batch && (
                  <div className="flex items-center gap-1 mt-1">
                    <Package className="w-3 h-3 text-industrial-500" />
                    <span className="text-industrial-500 text-xs font-mono">
                      {batch.batchNo}
                    </span>
                    <span className="text-industrial-600 text-xs">· {batch.id.slice(0, 8)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                task.status === 'pending' ? 'bg-warning-500/20 text-warning-400' :
                task.status === 'in_progress' ? 'bg-primary-500/20 text-primary-400' :
                'bg-success-500/20 text-success-400'
              )}>
                {task.status === 'pending' ? '待处理' : task.status === 'in_progress' ? '进行中' : '已完成'}
              </span>
              {hasPendingReview && task.status !== 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewModal({
                      open: true,
                      thresholdId: threshold?.id,
                      reviewId: review?.id,
                    });
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-warning-500/20 hover:bg-warning-500/30 text-warning-400 border border-warning-500/30 rounded text-xs transition-colors"
                >
                  <UserCheckIcon className="w-3 h-3" />
                  人工复核
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-industrial-300">
              <User className="w-4 h-4" />
              {task.assignee === 'engineer' ? '何工' : '训练教练'}
            </div>
            <div className="flex items-center gap-1.5 text-industrial-400">
              <Clock className="w-4 h-4" />
              {new Date(task.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>

          {threshold?.hasUnitMix && (
            <div className="mt-3 flex items-center gap-1.5 text-warning-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              存在单位混用，需重点复核
            </div>
          )}

          {isSelected && consistency && !consistency.ok && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <div className="flex items-start gap-2 mb-2">
                <AlertOctagon className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-400 font-medium text-sm">
                  一致性检查发现 {consistency.issues.length} 个问题
                </p>
              </div>
              <ul className="space-y-1 ml-6">
                {consistency.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-red-300">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isSelected && consistency?.ok && (
            <div className="mt-3 rounded-lg border border-success-500/30 bg-success-500/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-400" />
                <p className="text-success-400 font-medium text-sm">状态一致 ✓</p>
              </div>
            </div>
          )}
        </div>

        {isSelected && (
          <div className="border-t border-industrial-500 p-5">
            <WorkflowProgress currentStep={task.step} />
            
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/threshold/${threshold?.id}`);
                }}
                className="flex items-center gap-2 text-primary-400 hover:text-primary-300"
              >
                查看详情
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {task.status !== 'completed' && (
                <div className="flex items-center gap-2">
                  {isCoachReviewBlocked && (
                    <span className="text-xs text-warning-400 flex items-center gap-1 bg-warning-500/10 px-2 py-1 rounded">
                      <AlertTriangle className="w-3 h-3" />
                      先完成人工复核再推进
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdvance(task.id, threshold);
                    }}
                    disabled={isCoachReviewBlocked}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                      isCoachReviewBlocked
                        ? 'bg-industrial-700 text-industrial-500 cursor-not-allowed'
                        : 'bg-primary-500 hover:bg-primary-600 text-white'
                    )}
                  >
                    <CheckCircle className="w-4 h-4" />
                    完成并推进
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={cn(
            'fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-xl border animate-pulse',
            toast.type === 'success'
              ? 'bg-success-500/20 text-success-400 border-success-500/30'
              : 'bg-warning-500/20 text-warning-400 border-warning-500/30'
          )}
        >
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white mb-1">工作流中心</h1>
        <p className="text-industrial-300">
          当前角色：<span className="text-primary-400 font-medium">{currentRole === 'engineer' ? '设备工程师 何工' : '训练教练'}</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-warning-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingTasks.length}</p>
              <p className="text-industrial-400 text-sm">待处理</p>
            </div>
          </div>
        </div>
        <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
              <WorkflowIcon className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{inProgressTasks.length}</p>
              <p className="text-industrial-400 text-sm">进行中</p>
            </div>
          </div>
        </div>
        <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-success-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{completedTasks.length}</p>
              <p className="text-industrial-400 text-sm">已完成</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-400" />
            待处理任务 ({pendingTasks.length})
          </h2>
          <div className="space-y-4">
            {pendingTasks.length > 0 ? (
              pendingTasks.map((task) => <TaskCard key={task.id} task={task} />)
            ) : (
              <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-success-400 mx-auto mb-3" />
                <p className="text-industrial-300">暂无待处理任务</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success-400" />
            已完成任务 ({completedTasks.length})
          </h2>
          <div className="space-y-4">
            {completedTasks.length > 0 ? (
              completedTasks.map((task) => <TaskCard key={task.id} task={task} />)
            ) : (
              <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-8 text-center">
                <Clock className="w-12 h-12 text-industrial-400 mx-auto mb-3" />
                <p className="text-industrial-300">暂无已完成任务</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ManualReviewModal
        open={reviewModal.open}
        onClose={() => setReviewModal({ open: false })}
        thresholdId={reviewModal.thresholdId}
        reviewId={reviewModal.reviewId}
      />
    </div>
  );
};

export default Workflow;
