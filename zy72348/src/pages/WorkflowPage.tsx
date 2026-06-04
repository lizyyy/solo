import { useState } from 'react';
import { format } from 'date-fns';
import {
  Workflow,
  CheckCircle2,
  Circle,
  XCircle,
  Loader,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { StepStatus, WorkflowStep } from '@/types';

const STEP_LABELS = [
  '老师批注首次导入',
  '数据分析师补看抽样名单',
  '课堂演示结果更新',
] as const;

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  blocked: '已阻塞',
};

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'text-gray-500',
  in_progress: 'text-blue-400',
  completed: 'text-[#16c784]',
  blocked: 'text-[#e94560]',
};

const STEP_ICON_COLORS: Record<StepStatus, string> = {
  pending: 'text-gray-500 border-gray-500',
  in_progress: 'text-blue-400 border-blue-400',
  completed: 'text-[#16c784] border-[#16c784]',
  blocked: 'text-[#e94560] border-[#e94560]',
};

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-8 h-8" />;
    case 'in_progress':
      return <Loader className="w-8 h-8 animate-pulse" />;
    case 'blocked':
      return <XCircle className="w-8 h-8" />;
    default:
      return <Circle className="w-8 h-8" />;
  }
}

function ConnectorLine({ completed }: { completed: boolean }) {
  return (
    <div className="flex-1 flex items-center px-2">
      <div
        className={`h-0.5 w-full ${
          completed ? 'bg-[#16c784]' : 'bg-[#2a2a4a]'
        }`}
      />
    </div>
  );
}

function StepDetail({ step }: { step: WorkflowStep }) {
  if (!step) return null;

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${STATUS_COLORS[step.status]}`}>
          {STATUS_TEXT[step.status]}
        </span>
      </div>
      {step.startedAt && (
        <p className="text-xs text-gray-400">
          开始时间：{format(new Date(step.startedAt), 'yyyy-MM-dd HH:mm:ss')}
        </p>
      )}
      {step.completedAt && (
        <p className="text-xs text-gray-400">
          完成时间：{format(new Date(step.completedAt), 'yyyy-MM-dd HH:mm:ss')}
        </p>
      )}
      {step.operator && (
        <p className="text-xs text-gray-400">操作人：{step.operator}</p>
      )}
      {step.status === 'blocked' && step.snapshot && (
        <div className="flex items-start gap-1.5 mt-1">
          <AlertTriangle className="w-4 h-4 text-[#e94560] shrink-0 mt-0.5" />
          <p className="text-xs text-[#e94560]">阻塞原因：{step.snapshot}</p>
        </div>
      )}
    </div>
  );
}

export default function WorkflowPage() {
  const currentBatchId = useAppStore((s) => s.currentBatchId);
  const getWorkflowByBatch = useAppStore((s) => s.getWorkflowByBatch);
  const getConflictsByBatch = useAppStore((s) => s.getConflictsByBatch);
  const advanceWorkflow = useAppStore((s) => s.advanceWorkflow);
  const blockWorkflow = useAppStore((s) => s.blockWorkflow);
  const logAction = useAppStore((s) => s.logAction);

  const [showBlockModal, setShowBlockModal] = useState(false);

  if (!currentBatchId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500 gap-3">
        <Workflow className="w-12 h-12" />
        <p className="text-lg">请先在数据导入页创建批次</p>
      </div>
    );
  }

  const steps = getWorkflowByBatch(currentBatchId);
  const conflicts = getConflictsByBatch(currentBatchId);

  const hasPendingConflicts = conflicts.some(
    (c) => c.status === 'pending' || c.status === 'needs_review'
  );

  const currentStep = steps.find(
    (s) => s.status === 'in_progress'
  );

  const canAdvance =
    currentStep !== undefined && !hasPendingConflicts;

  function handleAdvance() {
    if (!currentStep || !canAdvance) return;

    if (currentStep.stepIndex === 3) {
      const hasDenominatorConflicts = conflicts.some(
        (c) => c.conflictType === 'denominator_zero_empty'
      );
      if (hasDenominatorConflicts) {
        setShowBlockModal(true);
        return;
      }
    }

    advanceWorkflow(currentBatchId);
    logAction(currentBatchId, 'advance_workflow', currentStep.operator, `步骤 ${currentStep.stepIndex} 完成，推进到下一步`);
  }

  function handleBlock() {
    blockWorkflow(currentBatchId, '检测到分母为0空字符串项，不可直接归为正常，需数据复核人复核');
    logAction(currentBatchId, 'block_workflow', currentStep?.operator ?? 'system', '分母为0空字符串冲突阻塞工作流');
    setShowBlockModal(false);
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Workflow className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-semibold text-white">工作流追踪</h1>
      </div>

      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2 min-w-[140px]">
              <div
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                  step.status === 'in_progress'
                    ? 'bg-[#0f3460] border-blue-400'
                    : step.status === 'completed'
                    ? 'bg-[#16c784]/10 border-[#16c784]'
                    : step.status === 'blocked'
                    ? 'bg-[#e94560]/10 border-[#e94560]'
                    : 'border-gray-500'
                } ${STEP_ICON_COLORS[step.status]}`}
              >
                <StepIcon status={step.status} />
              </div>
              <span className="text-xs text-gray-300 text-center leading-tight">
                {STEP_LABELS[step.stepIndex - 1]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ConnectorLine completed={step.status === 'completed'} />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <StepDetail key={step.id} step={step} />
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleAdvance}
          disabled={!canAdvance}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            canAdvance
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-[#2a2a4a] text-gray-500 cursor-not-allowed'
          }`}
        >
          推进到下一步
        </button>
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[#e94560] shrink-0 mt-0.5" />
              <p className="text-sm text-gray-200">
                检测到分母为0空字符串项，不可直接归为正常，需数据复核人复核
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBlock}
                className="px-4 py-2 text-sm bg-[#e94560] hover:bg-[#e94560]/80 text-white rounded-lg transition-colors"
              >
                阻塞工作流
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
